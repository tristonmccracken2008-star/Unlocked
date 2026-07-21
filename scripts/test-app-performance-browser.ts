import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import next from "next";
import { chromium, type BrowserContext, type Page, type Route } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
type ViewportScenario = { label: string; width: number; height: number };

const store = new Map<string, StoredValue>();
const outputDirectory = "/tmp/unlocked-app-performance";
const testDistDirectory = ".next-app-performance-browser";

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
      if (liveValue(key)?.value === command[4]) {
        store.delete(key);
        result = 1;
      } else result = 0;
    } else if (operation === "SMEMBERS" || operation === "LRANGE") result = [];
    else if (operation === "SADD" || operation === "LPUSH") result = 1;
    else if (operation === "LTRIM") result = "OK";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function seedSession() {
  const { createSession, mergeAccountData, upsertUser } = await import("../lib/auth-store");
  const now = "2026-07-18T12:00:00.000Z";
  const user = await upsertUser({ googleSub: "app-performance-browser", email: "performance@example.test", name: "Performance Student" });
  await mergeAccountData(user.id, {
    profile: {
      firstName: "Performance",
      lastName: "Student",
      schoolSlug: "university-of-chicago",
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Research",
      interests: "Statistics, Research",
      goals: ["Research"],
      topics: ["Statistics"],
      onboardingCompletedAt: now,
    },
    onboardingComplete: true,
    activity: { viewed: [], saved: [], claimed: [], tracked: {} },
    savedOpportunities: [],
    tracker: {},
  });
  return createSession(user);
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

function observePage(page: Page) {
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const detail = message.text();
    if (detail.includes("/_vercel/insights/") || detail.includes("/_vercel/speed-insights/") || detail.includes("net::ERR_NAME_NOT_RESOLVED")) return;
    consoleErrors.push(detail);
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    if (request.resourceType() === "image" && new URL(request.url()).origin !== new URL(page.url()).origin) return;
    requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`);
  });
  return { consoleErrors, requestFailures };
}

async function assertStableLayout(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} must not create horizontal overflow; received ${overflow}px.`);
}

async function verifyDiscover(page: Page, origin: string, screenshotLabel: string) {
  const startedAt = performance.now();
  let sessionRequests = 0;
  const catalogRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/auth/session") sessionRequests += 1;
    if (url.pathname === "/api/opportunities") catalogRequests.push(url.search);
  });
  await page.goto(`${origin}/opportunities`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("heading", { name: "Find the right opportunity." }).waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Open Opportunity" }).first().waitFor({ state: "visible", timeout: 45_000 });
  const coldReadyMs = Math.round(performance.now() - startedAt);
  assert.equal(catalogRequests.filter((search) => !new URLSearchParams(search).has("view")).length, 0, "Discover must never request the unbounded catalog.");
  assert.ok(catalogRequests.every((search) => new URLSearchParams(search).get("view") === "discover"), "Discover catalog requests must use the bounded projection.");
  assert.ok(sessionRequests <= 1, `Discover hydration must share one session request; received ${sessionRequests}.`);

  const cardsBefore = await page.getByRole("link", { name: "Open Opportunity" }).count();
  assert.ok(cardsBefore > 0 && cardsBefore <= 16, `Discover should render a bounded first window; received ${cardsBefore}.`);

  let releaseSearch!: () => void;
  const searchRelease = new Promise<void>((resolve) => { releaseSearch = resolve; });
  let searchRequestSeen!: () => void;
  const searchRequest = new Promise<void>((resolve) => { searchRequestSeen = resolve; });
  await page.route("**/api/opportunities?*", async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("query") === "engineering") {
      searchRequestSeen();
      await searchRelease;
    }
    await route.continue();
  });
  const search = page.getByPlaceholder("Search scholarships, internships, research, benefits...");
  await search.fill("engineering");
  await Promise.race([searchRequest, new Promise((_, reject) => setTimeout(() => reject(new Error("Discover search request did not start.")), 5000))]);
  assert.equal(await page.getByRole("link", { name: "Open Opportunity" }).count(), cardsBefore, "Discover must retain existing results while a refresh is pending.");
  await page.getByText("Updating results…", { exact: true }).waitFor({ state: "visible" });
  releaseSearch();
  await page.getByText("Updating results…", { exact: true }).waitFor({ state: "hidden", timeout: 10_000 });
  await page.unroute("**/api/opportunities?*");
  await assertStableLayout(page, screenshotLabel);
  await page.screenshot({ path: path.join(outputDirectory, `${screenshotLabel}-discover.png`), fullPage: true });

  const warmStartedAt = performance.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Open Opportunity" }).first().waitFor({ state: "visible", timeout: 20_000 });
  const warmReadyMs = Math.round(performance.now() - warmStartedAt);
  return { coldReadyMs, warmReadyMs, sessionRequests, catalogRequests: catalogRequests.length };
}

async function verifyPrimaryRoutes(page: Page, origin: string, screenshotLabel: string) {
  const forYouStartedAt = performance.now();
  await page.goto(`${origin}/advisor`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("heading", { name: /Opportunities selected around you|Your strongest matches, right now|No strong matches yet/ }).waitFor({ state: "visible", timeout: 45_000 });
  const forYouReadyMs = Math.round(performance.now() - forYouStartedAt);
  assert.equal(await page.getByRole("heading", { name: "We couldn’t load your shortlist." }).count(), 0, "For You must not enter an error state on the first authenticated visit.");
  await assertStableLayout(page, `${screenshotLabel} For You`);
  await page.screenshot({ path: path.join(outputDirectory, `${screenshotLabel}-for-you.png`), fullPage: true });

  const journeyStartedAt = performance.now();
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.locator("[data-journey-timeline]").waitFor({ state: "visible", timeout: 45_000 });
  const journeyReadyMs = Math.round(performance.now() - journeyStartedAt);
  await assertStableLayout(page, `${screenshotLabel} Journey`);
  await page.screenshot({ path: path.join(outputDirectory, `${screenshotLabel}-journey.png`), fullPage: true });
  return { forYouReadyMs, journeyReadyMs };
}

const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "app-performance-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "app-performance-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const session = await seedSession();
rmSync(testDistDirectory, { recursive: true, force: true });
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: appPort, conf: { distDir: testDistDirectory } });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
mkdirSync(outputDirectory, { recursive: true });

const viewports: ViewportScenario[] = [
  { label: "desktop", width: 1440, height: 960 },
  { label: "narrow-desktop", width: 1100, height: 820 },
  { label: "tablet", width: 834, height: 1112 },
  { label: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await installSession(context, origin, session.token);
    const page = await context.newPage();
    const observed = observePage(page);
    const discover = await verifyDiscover(page, origin, viewport.label);
    const primaryRoutes = await verifyPrimaryRoutes(page, origin, viewport.label);
    assert.deepEqual(observed.consoleErrors, [], `${viewport.label} browser console errors: ${observed.consoleErrors.join(" | ")}`);
    assert.deepEqual(observed.requestFailures, [], `${viewport.label} request failures: ${observed.requestFailures.join(" | ")}`);
    results.push({ viewport: viewport.label, ...discover, ...primaryRoutes });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
  rmSync(testDistDirectory, { recursive: true, force: true });
}

console.log(JSON.stringify({ message: "Full-app browser performance checks passed.", screenshots: outputDirectory, results }, null, 2));
