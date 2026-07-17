import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import next from "next";
import { chromium, webkit, type BrowserType, type Page } from "playwright";

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

async function queue(page: Page) {
  return await page.evaluate(() => JSON.parse(localStorage.getItem("unlocked-analytics-queue-v1") ?? "[]") as Array<{ name: string; visitorId: string; attempts: number; properties: Record<string, unknown> }>);
}

async function exercise(browserType: BrowserType, origin: string) {
  console.log(`[analytics-browser] ${browserType.name()} starting`);
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  const received: Array<{ events?: Array<{ id: string; name: string; properties: Record<string, unknown> }> }> = [];
  let rejectRequests = false;
  const page = await context.newPage();
  await page.route("**/api/analytics/event", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as { events?: Array<{ id: string; name: string; properties: Record<string, unknown> }> };
    received.push(body);
    await route.fulfill(rejectRequests
      ? { status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily unavailable" }) }
      : { status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, acceptedIds: body.events?.map((event) => event.id) ?? [] }) });
  });
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__unlockedAnalyticsTest));
  console.log(`[analytics-browser] ${browserType.name()} transport ready`);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__unlockedAnalyticsTest!.clear());
  console.log(`[analytics-browser] ${browserType.name()} queue cleared`);

  await page.evaluate(() => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }));
  console.log(`[analytics-browser] ${browserType.name()} offline`);
  await page.evaluate(() => {
    window.__unlockedAnalyticsTest!.track("journey_viewed_v1", { status: "active" });
    window.__unlockedAnalyticsTest!.track("journey_viewed_v1", { status: "active" });
  });
  assert.equal((await queue(page)).length, 1, `${browserType.name()} must deduplicate a repeated action.`);
  console.log(`[analytics-browser] ${browserType.name()} dedupe complete`);

  await page.evaluate(() => {
    window.__unlockedAnalyticsTest!.clear();
    window.__unlockedAnalyticsTest!.track("recommendation_opportunity_opened_v1", {
      recommendationId: "recommendation-browser-1",
      opportunityId: "opportunity-browser-1",
      gpa: 4,
      narrative: "private story",
      essay: "private essay",
    } as never);
  });
  const privateQueue = await queue(page);
  assert.deepEqual(privateQueue[0]?.properties, { opportunityId: "opportunity-browser-1", recommendationId: "recommendation-browser-1" }, `${browserType.name()} must strip private fields before persistence.`);
  const firstVisitor = privateQueue[0]?.visitorId;
  await page.evaluate(() => window.__unlockedAnalyticsTest!.bindAccount("account-one"));
  await page.evaluate(() => window.__unlockedAnalyticsTest!.bindAccount("account-two"));
  assert.equal((await queue(page)).length, 0, `${browserType.name()} must clear the queue on account switch.`);
  assert.equal(await page.evaluate(() => localStorage.getItem("unlocked-anonymous-analytics-id-v1")), null, `${browserType.name()} must rotate the anonymous ID on account switch.`);

  await page.evaluate(() => {
    window.__unlockedAnalyticsTest!.setEnabled(false);
    window.__unlockedAnalyticsTest!.track("journey_horizon_opened_v1");
  });
  assert.equal((await queue(page)).length, 0, `${browserType.name()} must respect analytics-disabled mode.`);
  await page.evaluate(() => window.__unlockedAnalyticsTest!.setEnabled(true));
  await page.evaluate(() => {
    window.__unlockedAnalyticsTest!.track("path_moment_downloaded_v1", { format: "story" });
    window.__unlockedAnalyticsTest!.track("semester_story_shared_v1", { format: "square" });
    window.__unlockedAnalyticsTest!.track("product_health_timing_v1", { component: "journey", metric: "server_projection", durationMs: 18 });
    window.__unlockedAnalyticsTest!.track("product_operational_error_v1", { component: "path_moment", errorType: "export", action: "download" });
  });
  const coverage = await queue(page);
  assert.deepEqual(new Set(coverage.map((event) => event.name)), new Set(["path_moment_downloaded_v1", "semester_story_shared_v1", "product_health_timing_v1", "product_operational_error_v1"]));
  assert.ok(firstVisitor);
  await page.evaluate(() => window.__unlockedAnalyticsTest!.bindAccount(null));
  assert.equal((await queue(page)).length, 0, `${browserType.name()} logout must discard pending analytics.`);

  await page.evaluate(() => window.__unlockedAnalyticsTest!.track("journey_viewed_v1", { status: "active" }));
  rejectRequests = true;
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    void window.__unlockedAnalyticsTest!.flush();
  });
  await page.waitForTimeout(250);
  assert.ok((await queue(page))[0]?.attempts >= 1, `${browserType.name()} must retain and mark a failed batch for retry.`);
  rejectRequests = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  console.log(`[analytics-browser] ${browserType.name()} online`);
  for (let attempt = 0; attempt < 30 && (await queue(page)).length; attempt += 1) {
    await page.evaluate(() => { void window.__unlockedAnalyticsTest!.flush(); });
    await page.waitForTimeout(100);
  }
  assert.equal((await queue(page)).length, 0, `${browserType.name()} must drain the queue after reconnect.`);
  console.log(`[analytics-browser] ${browserType.name()} reconnect flush complete`);
  assert.ok(received.some((batch) => batch.events?.some((event) => event.name === "journey_viewed_v1")), `${browserType.name()} must flush queued events after reconnect.`);

  await context.close();
  await browser.close();
  console.log(`[analytics-browser] ${browserType.name()} complete`);
  return { browser: browserType.name(), batches: received.length };
}

process.env.AUTH_SECRET = "journey-analytics-browser-secret-with-at-least-thirty-two-bytes";
process.env.NEXT_PUBLIC_OPEN_LINE_DIAGNOSTICS = "0";
const port = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${port}`;
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, port);
const origin = `http://127.0.0.1:${port}`;

try {
  const results = [];
  for (const browser of [chromium, webkit]) results.push(await exercise(browser, origin));
  console.log("Journey analytics browser checks passed", results);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
}
process.exit(0);
