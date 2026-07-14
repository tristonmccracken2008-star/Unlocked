import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import next from "next";
import { chromium, webkit, type BrowserType, type Page, type Route } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
type BrowserResult = { engine: string; viewport: string; navigationMs: Record<string, number>; logoutStatus: number; logoutRequestId: string };

const authSecret = "auth-browser-production-secret-with-more-than-thirty-two-bytes";
const store = new Map<string, StoredValue>();

function liveValue(key: string) {
  const item = store.get(key);
  if (item?.expiresAt && item.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return item;
}

async function listen(server: net.Server, port = 0) {
  await new Promise<void>((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve));
  return (server.address() as net.AddressInfo).port;
}

function createKvServer() {
  return http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const command = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown[];
    const operation = String(command[0] ?? "");
    let result: unknown = null;
    if (operation === "GET") result = liveValue(String(command[1]))?.value ?? null;
    else if (operation === "SET") {
      const key = String(command[1]);
      const onlyIfMissing = command.includes("NX");
      if (!onlyIfMissing || !liveValue(key)) {
        const expiryIndex = command.indexOf("EX");
        store.set(key, { value: command[2], expiresAt: expiryIndex >= 0 ? Date.now() + Number(command[expiryIndex + 1]) * 1000 : undefined });
        result = "OK";
      }
    } else if (operation === "DEL") {
      result = store.delete(String(command[1])) ? 1 : 0;
    } else if (operation === "EVAL") {
      const script = String(command[1]);
      const key = String(command[3]);
      if (script.includes("INCR")) {
        const current = Number(liveValue(key)?.value ?? 0) + 1;
        store.set(key, { value: current, expiresAt: Date.now() + Number(command[4]) * 1000 });
        result = current;
      } else {
        const expected = command[4];
        if (liveValue(key)?.value === expected) {
          store.delete(key);
          result = 1;
        } else result = 0;
      }
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function newAuthenticatedSession(label: string) {
  const { createSession, mergeAccountData, upsertUser } = await import("../lib/auth-store");
  const user = await upsertUser({ googleSub: `browser-${label}`, email: `browser-${label}@example.edu`, name: `Browser ${label}` });
  await mergeAccountData(user.id, {
    profile: {
      firstName: "Browser",
      lastName: "Student",
      schoolSlug: "university-of-chicago",
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Research",
      interests: "Statistics, Research",
      goals: ["Research"],
      topics: ["Statistics"],
    },
    onboardingComplete: true,
  });
  return { ...(await createSession(user)), userId: user.id };
}

async function installSession(page: Page, origin: string, token: string) {
  await page.context().addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, secure: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

async function holdRoute(route: Route, release: Promise<void>) {
  await release;
  await route.continue().catch(() => undefined);
}

async function verifyNavigation(page: Page, origin: string, label: string, target: string, viewportName: string) {
  const stylesheetDiagnostics: Array<Record<string, unknown>> = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".css")) stylesheetDiagnostics.push({ event: "response", status: response.status(), url: response.url() });
  });
  page.on("requestfailed", (request) => {
    if (request.url().endsWith(".css")) stylesheetDiagnostics.push({ event: "failed", error: request.failure()?.errorText, url: request.url() });
  });
  await page.addInitScript(() => {
    const browserFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      if (new URL(rawUrl, window.location.href).pathname === "/api/auth/session") {
        document.documentElement.dataset.authSessionPending = "true";
        return new Promise<Response>(() => undefined);
      }
      return browserFetch(input, init);
    }) as typeof window.fetch;
  });
  await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).pathname, "/profile", "The signed session cookie must reach the first protected document request.");
  await page.waitForFunction(() => document.documentElement.dataset.authSessionPending === "true", undefined, { timeout: 3000 });
  await page.waitForLoadState("load");
  const navigation = page.locator(`nav[aria-label="${viewportName === "mobile" ? "Mobile navigation" : "Primary navigation"}"]`);
  try {
    await page.waitForFunction(({ label, display }) => {
      const element = document.querySelector(`nav[aria-label="${label}"]`);
      return element && getComputedStyle(element).display === display;
    }, { label: viewportName === "mobile" ? "Mobile navigation" : "Primary navigation", display: viewportName === "mobile" ? "grid" : "flex" }, { timeout: 5000 });
  } catch (error) {
    const styles = await page.evaluate(() => ({
      viewport: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth },
      navigations: [...document.querySelectorAll<HTMLElement>("nav")].map((element) => ({ label: element.getAttribute("aria-label"), display: getComputedStyle(element).display })),
      links: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) => link.href),
      sheets: [...document.styleSheets].map((sheet) => ({ href: sheet.href, rules: (() => { try { return sheet.cssRules.length; } catch { return -1; } })() })),
    }));
    console.error(JSON.stringify({ label, url: page.url(), styles, stylesheetDiagnostics }));
    throw error;
  }
  const link = navigation.getByRole("link", { name: label, exact: true });
  await link.waitFor({ state: "visible" });
  const navigationGeometry = await navigation.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement?.getBoundingClientRect();
    return { rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) }, parent: parent ? { top: Math.round(parent.top), height: Math.round(parent.height) } : null, display: getComputedStyle(element).display };
  });
  console.log(JSON.stringify({ label, url: page.url(), navigationGeometry }));
  const hitTest = await link.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      receivesClick: hit === element || element.contains(hit),
      pointerEvents: getComputedStyle(element).pointerEvents,
      ariaDisabled: element.getAttribute("aria-disabled"),
      rect: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
      hit: hit ? { tag: hit.tagName, className: String(hit.className), text: hit.textContent?.trim().slice(0, 80) } : null,
    };
  });
  console.log(JSON.stringify({ label, hitTest }));
  assert.equal(hitTest.receivesClick, true, `${label} must receive its own click without an overlay.`);
  assert.equal(hitTest.pointerEvents, "auto");
  assert.equal(hitTest.ariaDisabled, null);
  const startedAt = performance.now();
  const destinationRequest = page.waitForRequest((request) => new URL(request.url()).pathname === target && request.isNavigationRequest(), { timeout: 250 });
  await link.click({ noWaitAfter: true });
  await destinationRequest;
  const duration = Math.round(performance.now() - startedAt);
  await page.waitForURL((url) => url.pathname === target, { waitUntil: "commit", timeout: 8000 });
  return duration;
}

async function runBrowser(browserType: BrowserType, engine: string, origin: string, viewport: { width: number; height: number }, viewportName: string): Promise<BrowserResult> {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport });
  const consoleErrors: string[] = [];
  const observeConsole = (page: Page) => page.on("console", (message) => {
      if (message.type() !== "error") return;
      const detail = `${message.text()} ${message.location().url}`;
      if (detail.includes("/_vercel/insights/") || detail.includes("/_vercel/speed-insights/")) return;
      consoleErrors.push(detail.trim());
    });
  const navigationSession = await newAuthenticatedSession(`${engine}-${viewportName}-nav`);
  const cookiePage = await context.newPage();
  await installSession(cookiePage, origin, navigationSession.token);
  await cookiePage.close();
  const navigationMs: Record<string, number> = {};
  for (const [label, target] of [["Discover", "/opportunities"], ["For You", "/advisor"], ["Journey", "/"], ["Refer", "/referral"]] as const) {
    const navigationPage = await context.newPage();
    observeConsole(navigationPage);
    navigationMs[label] = await verifyNavigation(navigationPage, origin, label, target, viewportName);
    await navigationPage.close();
  }

  const logoutSession = await newAuthenticatedSession(`${engine}-${viewportName}-logout`);
  await context.clearCookies();
  const page = await context.newPage();
  observeConsole(page);
  await installSession(page, origin, logoutSession.token);
  await page.goto(`${origin}/about`, { waitUntil: "domcontentloaded" });
  let releaseAccount!: () => void;
  let signalAccountWrite!: () => void;
  let signalProfileRead!: () => void;
  let signalRecommendationRead!: () => void;
  const accountWriteStarted = new Promise<void>((resolve) => { signalAccountWrite = resolve; });
  const profileReadStarted = new Promise<void>((resolve) => { signalProfileRead = resolve; });
  const recommendationReadStarted = new Promise<void>((resolve) => { signalRecommendationRead = resolve; });
  const accountRelease = new Promise<void>((resolve) => { releaseAccount = resolve; });
  await page.route("**/api/account/data", async (route) => {
    if (route.request().method() === "PUT") {
      signalAccountWrite();
      void holdRoute(route, accountRelease);
    } else {
      signalProfileRead();
      void holdRoute(route, accountRelease);
    }
  });
  await page.route("**/api/advisor/for-you", (route) => {
    signalRecommendationRead();
    void holdRoute(route, accountRelease);
  });
  let logoutStatus = 0;
  let logoutRequestId = "";
  let logoutSetCookie = "";
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname !== "/api/auth/logout") return;
    logoutStatus = response.status();
    const headers = await response.allHeaders();
    logoutRequestId = headers["x-request-id"] ?? "";
    logoutSetCookie = headers["set-cookie"] ?? "";
  });
  await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    void fetch("/api/account/data", { credentials: "same-origin", cache: "no-store" }).catch(() => undefined);
    void fetch("/api/account/data", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined);
    void fetch("/api/advisor/for-you", { credentials: "same-origin", cache: "no-store" }).catch(() => undefined);
  });
  await Promise.race([
    Promise.all([profileReadStarted, accountWriteStarted, recommendationReadStarted]),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Background authenticated requests did not all start.")), 5000)),
  ]);
  const signOut = page.getByRole("button", { name: "Sign out", exact: true }).first();
  await signOut.waitFor({ state: "visible" });
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/", { waitUntil: "domcontentloaded", timeout: 8000 }),
    signOut.click(),
  ]);
  releaseAccount();
  assert.equal(logoutStatus, 200, "Logout must reach the server and return 200 while an account write is active.");
  assert.match(logoutRequestId, /^[0-9a-f-]{36}$/i, "Logout must return a safe request ID.");
  assert.match(logoutSetCookie, /unlocked_session=;[\s\S]*?Max-Age=0/i, "Logout must delete the session cookie.");
  const cookiesAfter = await context.cookies(origin);
  assert.equal(cookiesAfter.some((cookie) => cookie.name.startsWith("unlocked_") && cookie.value), false, "No UnlockED auth cookie may retain a value after logout.");
  const { getSession } = await import("../lib/auth-store");
  assert.equal(await getSession(logoutSession.token), null, "The browser logout must revoke the server-backed session.");
  await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => null);
  await page.waitForURL((url) => url.pathname !== "/profile", { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => null);
  assert.notEqual(new URL(page.url()).pathname, "/profile", "Browser Back must not restore the private profile page.");
  const repeatedPage = await context.newPage();
  observeConsole(repeatedPage);
  await repeatedPage.goto(origin, { waitUntil: "domcontentloaded" });
  const repeated = await repeatedPage.evaluate(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    return { status: response.status, body: await response.json() };
  });
  await repeatedPage.close();
  assert.deepEqual(repeated, { status: 200, body: { ok: true } }, "A second logout must be idempotent.");
  const switchedSession = await newAuthenticatedSession(`${engine}-${viewportName}-switch`);
  const switchedPage = await context.newPage();
  observeConsole(switchedPage);
  await installSession(switchedPage, origin, switchedSession.token);
  await switchedPage.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(switchedPage.url()).pathname, "/profile", "A different account must authenticate after logout without restoring the previous session.");
  assert.ok(await getSession(switchedSession.token), "The switched account must have its own active server session.");
  assert.equal(await getSession(logoutSession.token), null, "Account switching must not revive the previous session.");
  await switchedPage.close();
  assert.equal(consoleErrors.length, 0, `Browser console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  await browser.close();
  return { engine, viewport: viewportName, navigationMs, logoutStatus, logoutRequestId };
}

const kvServer = createKvServer();
const kvPort = await listen(kvServer);
const publicPort = await freePort();
const origin = `https://localhost:${publicPort}`;
Reflect.set(process.env, "NODE_ENV", "production");
process.env.AUTH_SECRET = authSecret;
process.env.RATE_LIMIT_SECRET = authSecret;
process.env.NEXT_PUBLIC_APP_URL = origin;
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "auth-browser-test-token";

const tlsDirectory = mkdtempSync(path.join(os.tmpdir(), "unlocked-auth-browser-"));
const keyPath = path.join(tlsDirectory, "key.pem");
const certPath = path.join(tlsDirectory, "cert.pem");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"], { stdio: "ignore" });
const nextApp = next({ dev: false, hostname: "localhost", port: publicPort });
await nextApp.prepare();
const handleNextRequest = nextApp.getRequestHandler();
const httpsServer = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, (request, response) => {
  request.headers["x-forwarded-host"] = `localhost:${publicPort}`;
  request.headers["x-forwarded-proto"] = "https";
  void handleNextRequest(request, response);
});

try {
  await listen(httpsServer, publicPort);
  const results = [
    await runBrowser(chromium, "chromium", origin, { width: 1440, height: 900 }, "desktop"),
    await runBrowser(webkit, "webkit", origin, { width: 1440, height: 900 }, "desktop"),
    await runBrowser(chromium, "chromium", origin, { width: 390, height: 844 }, "mobile"),
  ];
  console.log(JSON.stringify({ origin, secureCookies: true, productionBuild: true, results }, null, 2));
} finally {
  await new Promise<void>((resolve) => httpsServer.close(() => resolve()));
  await nextApp.close();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
  rmSync(tlsDirectory, { recursive: true, force: true });
}
