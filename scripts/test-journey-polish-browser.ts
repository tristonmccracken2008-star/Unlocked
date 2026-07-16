import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import next from "next";
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
type Session = { token: string };
const store = new Map<string, StoredValue>();
const outputDirectory = "/tmp/unlocked-journey-polish";
let kvDelayMs = 0;

function liveValue(key: string) {
  const item = store.get(key);
  if (item?.expiresAt && item.expiresAt <= Date.now()) { store.delete(key); return undefined; }
  return item;
}

async function listen(server: net.Server, port = 0) {
  await new Promise<void>((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve));
  return (server.address() as net.AddressInfo).port;
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function createKvServer() {
  return http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    if (kvDelayMs) await new Promise((resolve) => setTimeout(resolve, kvDelayMs));
    const command = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown[];
    const operation = String(command[0] ?? "");
    let result: unknown = null;
    if (operation === "GET") result = liveValue(String(command[1]))?.value ?? null;
    else if (operation === "SET") {
      const key = String(command[1]);
      if (!command.includes("NX") || !liveValue(key)) {
        const expiryIndex = command.indexOf("EX");
        store.set(key, { value: command[2], expiresAt: expiryIndex >= 0 ? Date.now() + Number(command[expiryIndex + 1]) * 1000 : undefined });
        result = "OK";
      }
    } else if (operation === "DEL") result = store.delete(String(command[1])) ? 1 : 0;
    else if (operation === "EVAL") {
      const key = String(command[3]);
      if (liveValue(key)?.value === command[4]) { store.delete(key); result = 1; } else result = 0;
    } else if (operation === "SMEMBERS" || operation === "LRANGE") result = [];
    else if (operation === "SADD" || operation === "LPUSH") result = 1;
    else if (operation === "LTRIM") result = "OK";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function seedSession(label: string, state: "empty" | "sparse" | "populated" | "long", dark = false): Promise<Session> {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const { opportunities } = await import("../data/opportunities");
  const source = opportunities.filter((item) => item.type === "Career");
  const selected = state === "long" ? source.slice(0, 12) : state === "empty" ? [] : [source[0]];
  const statuses = ["Applying", "Submitted", "Interview", "Accepted", "Completed"] as const;
  const tracker = Object.fromEntries(selected.map((opportunity, index) => {
    const day = String(index + 1).padStart(2, "0");
    return [opportunity.id, {
      id: opportunity.id,
      status: state === "sparse" ? "Saved" as const : state === "long" ? statuses[index % statuses.length] : "Applying" as const,
      savedAt: `2026-01-${day}T12:00:00.000Z`,
      updatedAt: `2026-02-${day}T12:00:00.000Z`,
      version: 0,
      history: [],
    }];
  }));
  const user = await upsertUser({ googleSub: `journey-polish-${label}`, email: `journey-polish-${label}@example.test`, name: `Jordan ${label}` });
  const now = "2026-07-16T12:00:00.000Z";
  await mergeAccountData(user.id, {
    profile: {
      firstName: "Jordan",
      lastName: label,
      schoolSlug: "university-of-chicago",
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Quantitative Finance",
      interests: "Finance, Research",
      onboardingCompletedAt: now,
    },
    onboardingComplete: true,
    activity: { viewed: selected.map((item) => item.id), saved: selected.map((item) => item.id), claimed: [], tracked: tracker },
    savedOpportunities: selected.map((item, index) => ({ opportunityId: item.id, savedAt: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z` })),
    tracker,
    preferences: { appearance: dark ? "midnight" : "light", updatedAt: now },
  });
  if (dark) await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  return await createSession(user);
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

async function openJourney(page: Page, origin: string, expectedTheme: "light" | "midnight" = "light") {
  const started = performance.now();
  const response = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(response?.status(), 200);
  const root = page.locator("[data-journey-editorial]");
  await root.waitFor({ state: "visible" });
  await root.locator("h1").waitFor({ state: "visible" });
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, expectedTheme);
  return { root, meaningfulMs: performance.now() - started };
}

async function baseAssertions(page: Page, label: string) {
  const root = page.locator("[data-journey-editorial]");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} must not create horizontal overflow; received ${overflow}px.`);
  assert.equal(await root.locator("[data-responsive-open-line]").count(), 1, `${label} must mount one responsive Open Line.`);
  assert.equal(await root.locator("svg[data-open-line-renderer]").count(), 1, `${label} must render one Open Line SVG rather than hidden responsive variants.`);
  const h1Size = Number.parseFloat(await root.locator("h1").evaluate((node) => getComputedStyle(node).fontSize));
  const otherSizes = await root.locator("h2, h3").evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent !== null).map((node) => Number.parseFloat(getComputedStyle(node).fontSize)));
  assert.ok(otherSizes.every((size) => h1Size > size), `${label} identity must remain the dominant headline.`);
  assert.equal(await root.getByText(/Journey progress|completion percentage|Skills gained|Pathprint|branch intelligence/i).count(), 0, `${label} must not expose dashboard or implementation language.`);
  assert.ok(await root.locator("*").count() < 850, `${label} must keep the initial DOM bounded.`);
}

async function verifyPopulated(page: Page, origin: string, label: string, expectedTheme: "light" | "midnight" = "light") {
  const { root, meaningfulMs } = await openJourney(page, origin, expectedTheme);
  await baseAssertions(page, label);
  assert.ok(meaningfulMs < 2_500, `${label} warm meaningful content must appear under 2.5s; received ${meaningfulMs.toFixed(0)}ms.`);
  const state = await root.getAttribute("data-journey-state");
  assert.ok(state === "active" || state === "validated");
  await root.getByRole("heading", { name: /you’re beginning to turn|you’re turning your work/i }).waitFor({ state: "visible" });
  await root.locator("#journey-waypoint-title").waitFor({ state: "visible" });
  const primary = root.getByRole("button", { name: /choose this opportunity|start this application|mark as submitted|record an interview|record acceptance|complete this experience|resume this direction/i });
  await primary.waitFor({ state: "visible" });
  assert.equal(await primary.count(), 1, `${label} must expose one dominant waypoint action.`);
  const initialMoments = await root.locator("[data-journey-moment]").evaluateAll((nodes) => nodes.filter((node) => !node.closest("[data-earlier-chapters]")).length);
  assert.ok(initialMoments <= 4, `${label} must initially show at most four moments.`);
  assert.equal(await root.locator("[data-horizon-item]:visible").count(), 1, `${label} must initially show one Horizon direction.`);
  const actionBox = await primary.boundingBox();
  if ((page.viewportSize()?.width ?? 0) <= 420) assert.ok(actionBox && actionBox.y + actionBox.height < (page.viewportSize()?.height ?? 0) - 60, `${label} primary action must remain above fixed navigation.`);
  return { root, meaningfulMs };
}

async function screenshot(page: Page, label: string) {
  await page.screenshot({ path: path.join(outputDirectory, `${label}.png`), fullPage: true });
}

async function contextFor(browser: Browser, viewport: { width: number; height: number }, reducedMotion: "reduce" | "no-preference" = "no-preference") {
  return await browser.newContext({ viewport, reducedMotion, colorScheme: "light" });
}

const rootDirectory = process.cwd();
const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "journey-polish-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "journey-polish-browser-token";
process.env.NEXT_PUBLIC_OPEN_LINE_DIAGNOSTICS = "0";
const requestedAppPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${requestedAppPort}`;

const populatedSession = await seedSession("Populated", "long");
const darkSession = await seedSession("Dark", "long", true);
const sparseSession = await seedSession("Sparse", "sparse");
const emptySession = await seedSession("Empty", "empty");
const applicationSession = await seedSession("Application", "populated");

const app = next({ dev: true, dir: rootDirectory, hostname: "127.0.0.1", port: requestedAppPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
const appPort = await listen(server, requestedAppPort);
const origin = `http://127.0.0.1:${appPort}`;
mkdirSync(outputDirectory, { recursive: true });

const performanceResults: Record<string, number> = {};
const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
try {
  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, populatedSession.token);
    const page = await context.newPage();
    await openJourney(page, origin); // Warm route compilation outside measurements.
    const result = await verifyPopulated(page, origin, "populated-desktop-light");
    performanceResults.desktopMeaningfulMs = result.meaningfulMs;
    await screenshot(page, "populated-desktop-light");

    const waypointDetail = result.root.locator(".does-not-exist").or(result.root.getByText("See why this matters", { exact: true }));
    await waypointDetail.click();
    await screenshot(page, "current-waypoint-expanded");

    const moment = result.root.locator("[data-journey-moment]:visible").last();
    await moment.locator("summary").click();
    await moment.getByText("What changed", { exact: true }).waitFor({ state: "visible" });
    await screenshot(page, "historical-moment-expanded");

    const horizon = result.root.locator("[data-journey-horizon]");
    await horizon.scrollIntoViewIfNeeded();
    await horizon.locator("[data-horizon-detail] > summary").first().click();
    await screenshot(page, "horizon-expanded");
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, darkSession.token);
    const page = await context.newPage();
    await verifyPopulated(page, origin, "populated-desktop-dark", "midnight");
    const contrast = await page.locator("[data-journey-editorial] h1").evaluate((node) => ({ color: getComputedStyle(node).color, background: getComputedStyle(document.querySelector("[data-journey-editorial]")!).backgroundColor }));
    assert.notEqual(contrast.color, contrast.background, "Dark mode text must remain distinguishable from its canvas.");
    await screenshot(page, "populated-desktop-dark");
    await context.close();
  }

  for (const scenario of [
    { label: "populated-tablet", viewport: { width: 820, height: 1000 }, browser: chromiumBrowser, reduced: "reduce" as const },
    { label: "populated-mobile-390", viewport: { width: 390, height: 844 }, browser: chromiumBrowser, reduced: "no-preference" as const },
    { label: "populated-mobile-320", viewport: { width: 320, height: 780 }, browser: webkitBrowser, reduced: "reduce" as const },
  ]) {
    const context = await contextFor(scenario.browser, scenario.viewport, scenario.reduced);
    await installSession(context, origin, populatedSession.token);
    const page = await context.newPage();
    await verifyPopulated(page, origin, scenario.label);
    const expectedMode = scenario.viewport.width <= 672 ? "mobile" : "tablet";
    await page.waitForFunction((mode) => document.querySelector("[data-responsive-open-line]")?.getAttribute("data-open-line-mode") === mode, expectedMode);
    await screenshot(page, scenario.label);
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, sparseSession.token);
    const page = await context.newPage();
    const { root } = await openJourney(page, origin);
    await baseAssertions(page, "sparse-journey");
    assert.equal(await root.getAttribute("data-journey-state"), "sparse");
    assert.equal(await root.locator("#journey-history-title").count(), 0, "Sparse Journey must not render an empty history chapter.");
    assert.equal(await root.locator("[data-horizon-item]:visible").count(), 1);
    await screenshot(page, "sparse-journey");
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, emptySession.token);
    const page = await context.newPage();
    const { root } = await openJourney(page, origin);
    await baseAssertions(page, "empty-journey");
    assert.equal(await root.getAttribute("data-journey-state"), "empty");
    await root.getByRole("heading", { name: "Every path begins with one meaningful choice." }).waitFor({ state: "visible" });
    await root.getByRole("link", { name: "Find my first opportunity" }).waitFor({ state: "visible" });
    assert.equal(await root.locator("#journey-history-title").count(), 0);
    assert.equal(await root.locator("[data-journey-horizon]").count(), 0);
    await screenshot(page, "empty-journey");
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1100, height: 850 });
    await installSession(context, origin, applicationSession.token);
    const page = await context.newPage();
    const { root } = await verifyPopulated(page, origin, "application-management");
    const manage = root.getByText("Manage applications", { exact: true }).first();
    await manage.click();
    await root.getByRole("link", { name: "Open application management" }).waitFor({ state: "visible" });
    await screenshot(page, "application-management");

    await page.route("**/api/journey/transition", (route) => route.abort("failed"));
    const primary = root.getByRole("button", { name: /mark as submitted/i });
    const clickStart = performance.now();
    await primary.click();
    await root.getByText("Saving…", { exact: true }).waitFor({ state: "visible" });
    performanceResults.clickFeedbackMs = performance.now() - clickStart;
    assert.ok(performanceResults.clickFeedbackMs < 100, `Click feedback must appear under 100ms; received ${performanceResults.clickFeedbackMs.toFixed(1)}ms.`);
    await root.getByRole("alert").waitFor({ state: "visible" });
    assert.match(await root.getByRole("alert").innerText(), /couldn’t reach UnlockED/i);
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, populatedSession.token);
    const page = await context.newPage();
    kvDelayMs = 650;
    const navigation = page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const loading = page.locator('[aria-label="Preparing your Journey"]');
    await loading.waitFor({ state: "visible", timeout: 10_000 });
    await screenshot(page, "loading-state");
    kvDelayMs = 0;
    await navigation;
    await context.close();
  }
} finally {
  kvDelayMs = 0;
  await chromiumBrowser.close();
  await webkitBrowser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
}

console.log(JSON.stringify({ message: "Journey polish browser checks passed in Chromium and WebKit.", screenshots: outputDirectory, performance: Object.fromEntries(Object.entries(performanceResults).map(([key, value]) => [key, Number(value.toFixed(1))])) }, null, 2));
process.exit(0);
