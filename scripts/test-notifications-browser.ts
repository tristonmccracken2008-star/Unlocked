import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import next from "next";
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();

function live(key: string) {
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

function kvServer() {
  return http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const command = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown[];
    const [operation, rawKey, ...rest] = command;
    const key = String(rawKey);
    let result: unknown = null;
    if (operation === "GET") result = live(key)?.value ?? null;
    else if (operation === "SET") {
      if (!rest.includes("NX") || !live(key)) {
        const expiry = rest.indexOf("EX");
        store.set(key, { value: rest[0], expiresAt: expiry >= 0 ? Date.now() + Number(rest[expiry + 1]) * 1_000 : undefined });
        result = "OK";
      }
    } else if (operation === "DEL") result = store.delete(key) ? 1 : 0;
    else if (operation === "EVAL") {
      const lockKey = String(command[3]);
      if (live(lockKey)?.value === command[4]) {
        store.delete(lockKey);
        result = 1;
      } else result = 0;
    } else if (operation === "SADD") {
      const values = live(key)?.value instanceof Set ? live(key)!.value as Set<string> : new Set<string>();
      const before = values.size;
      for (const value of rest) values.add(String(value));
      store.set(key, { value: values });
      result = values.size - before;
    } else if (operation === "SMEMBERS") result = [...(live(key)?.value as Set<string> ?? [])];
    else if (operation === "PFADD" || operation === "HINCRBY" || operation === "ZINCRBY" || operation === "EXPIRE") result = 1;
    else if (operation === "ZADD") result = 1;
    else if (operation === "ZRANGEBYSCORE" || operation === "ZREVRANGE") result = [];
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function seedAccount(label: string, pro = false) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const user = await upsertUser({ googleSub: `notification-${label}`, email: `${label}@example.test`, name: `${label} Student` });
  await mergeAccountData(user.id, {
    profile: {
      firstName: label,
      schoolSlug: "university-of-chicago",
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Research",
      interests: "Research, Scholarships",
      currentPriority: "Finding research",
      preferredOpportunityTypes: ["Research"],
      goals: ["Finding research"],
      topics: ["Research"],
      gpaStatus: "none_yet",
      onboardingCompletedAt: "2026-03-01T12:00:00.000Z",
    },
    onboardingComplete: true,
    activity: { viewed: [], saved: [], claimed: [], tracked: {} },
  });
  if (pro) {
    await mergeAccountData(user.id, { preferences: { appearance: "midnight", updatedAt: "2026-07-27T12:00:00.000Z" } });
    await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  }
  return { user, session: await createSession(user) };
}

async function install(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
}

function observe(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("_vercel")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`);
}

async function exercise(browser: Browser, browserName: string, origin: string, token: string, expectedTitle: string, forbiddenTitle: string, viewport: { width: number; height: number }, expectedTheme: "light" | "midnight", reducedMotion: "reduce" | "no-preference", expectedGroups: string[], arrival?: { title: string; insert: () => Promise<void> }) {
  const context = await browser.newContext({ viewport, reducedMotion, colorScheme: "dark" });
  await install(context, origin, token);
  const page = await context.newPage();
  const assertNoErrors = observe(page);
  await page.route("**/api/notifications?cursor=0", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.continue();
  }, { times: 1 });
  await page.goto(`${origin}/notifications`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Useful updates, nothing more." }).waitFor();
  await page.locator("[data-notification-skeleton]").waitFor({ state: "visible" });
  await page.getByRole("heading", { name: expectedTitle }).waitFor();
  await page.locator("[data-notification-skeleton]").waitFor({ state: "hidden" });
  await assert.doesNotReject(async () => page.locator(`html[data-theme="${expectedTheme}"]`).waitFor({ timeout: 5_000 }));
  assert.equal(await page.getByText(forbiddenTitle, { exact: true }).count(), 0, "An account must never render another account's notification.");
  assert.ok(await page.getByRole("link", { name: /Notifications,/ }).isVisible());
  assert.deepEqual(await page.locator("[data-notification-group]").evaluateAll((groups) => groups.map((group) => group.getAttribute("data-notification-group"))), expectedGroups);
  if (arrival) {
    await arrival.insert();
    await page.evaluate(() => window.dispatchEvent(new Event("unlocked:notifications-updated")));
    const arrivedItem = page.locator("[data-notification-item]").filter({ hasText: arrival.title });
    await arrivedItem.waitFor();
    assert.equal(await arrivedItem.getAttribute("data-notification-item-arrived"), "true", "New notifications must enter through the arrival state.");
    await page.getByText("One new notification arrived.", { exact: true }).waitFor();
  }
  const notificationItem = page.locator("[data-notification-item]").filter({ hasText: expectedTitle });
  assert.equal(await notificationItem.locator("[data-visible='true']").first().count(), 1, "Unread notifications must expose the refined indicator.");
  assert.ok(await notificationItem.locator("svg").first().isVisible(), "Notification type must have a visible icon.");
  const markRead = page.getByRole("button", { name: `Mark as read: ${expectedTitle}` });
  await markRead.click();
  assert.equal(await notificationItem.getAttribute("data-read"), "true", "Read notifications must use the shared visual state.");
  assert.equal(await notificationItem.locator("[data-visible='false']").count(), 1, "Unread indicator must fade without a layout jump.");
  assert.equal(await notificationItem.locator("button[data-read='true']").count(), 1, "Read action must settle into a stable confirmed state.");
  await assert.doesNotReject(async () => page.getByRole("link", { name: "Notifications" }).waitFor({ timeout: 5_000 }));
  const sectionHeading = page.getByRole("heading", { name: expectedGroups[0]!, exact: true });
  assert.equal(await sectionHeading.evaluate((node) => getComputedStyle(node).position), "sticky");
  const actionTargets = await notificationItem.locator("a, button").evaluateAll((nodes) => nodes.map((node) => ({ width: (node as HTMLElement).getBoundingClientRect().width, height: (node as HTMLElement).getBoundingClientRect().height })));
  assert.ok(actionTargets.every((target) => target.width >= 44 && target.height >= 44), "Notification actions must preserve 44px touch targets.");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Notification center created ${overflow}px horizontal overflow at ${viewport.width}px.`);
  await page.screenshot({ path: `/tmp/unlocked-notifications-${browserName.toLowerCase()}-${viewport.width < 640 ? "mobile" : "desktop"}.png`, fullPage: true });
  assertNoErrors();
  await context.close();
}

const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "notification-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "notification-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;

const accountA = await seedAccount("Avery");
const accountB = await seedAccount("Jordan", true);
const emptyAccount = await seedAccount("Casey");
const { buildNotificationRecord, normalizeNotificationPreferences } = await import("../lib/notification-engine");
const { storeNotification } = await import("../lib/notification-store");
const now = new Date();
const preferences = normalizeNotificationPreferences(null, now.toISOString());
const recordA = buildNotificationRecord({
  type: "deadline_reminder", priority: "high", title: "Deadline tomorrow",
  body: "Verified Student Program is due tomorrow.", organization: "Official Organization",
  actionLabel: "View opportunity", actionHref: "/opportunities/verified-student-program",
  contentVersion: "a-v1", idempotencyKey: "browser-a-v1", now, preferences,
});
const recordB = buildNotificationRecord({
  type: "opportunity_change", priority: "normal", title: "The deadline changed",
  body: "Research Fellowship: March 10 → March 17.", organization: "Research Foundation",
  actionLabel: "View opportunity", actionHref: "/opportunities/research-fellowship",
  contentVersion: "b-v1", idempotencyKey: "browser-b-v1", now, preferences,
});
const yesterday = buildNotificationRecord({
  type: "journey_follow_up", priority: "normal", title: "Your Journey is ready",
  body: "A saved opportunity is ready for your next update.", organization: "UnlockED",
  actionLabel: "View Journey", actionHref: "/",
  contentVersion: "a-v2", idempotencyKey: "browser-a-v2", now: new Date(now.getTime() - 86_400_000), preferences,
});
const earlierThisWeek = buildNotificationRecord({
  type: "recommendation_update", priority: "normal", title: "New verified match",
  body: "A newly verified opportunity fits your profile.", organization: "UnlockED",
  actionLabel: "Review match", actionHref: "/advisor",
  contentVersion: "a-v3", idempotencyKey: "browser-a-v3", now: new Date(now.getTime() - 2 * 86_400_000), preferences,
});
const earlier = buildNotificationRecord({
  type: "weekly_digest", priority: "low", title: "Your earlier update",
  body: "A useful summary from your recent activity.", organization: "UnlockED",
  actionLabel: "View Journey", actionHref: "/",
  contentVersion: "a-v4", idempotencyKey: "browser-a-v4", now: new Date(now.getTime() - 8 * 86_400_000), preferences,
});
const arrival = buildNotificationRecord({
  type: "account", priority: "normal", title: "A new update arrived",
  body: "Your latest account update is ready.", organization: "UnlockED",
  actionLabel: "View profile", actionHref: "/profile",
  contentVersion: "a-v5", idempotencyKey: "browser-a-v5", now: new Date(now.getTime() + 1_000), preferences,
});
await storeNotification(accountA.user.id, recordA);
await storeNotification(accountA.user.id, yesterday);
await storeNotification(accountA.user.id, earlierThisWeek);
await storeNotification(accountA.user.id, earlier);
await storeNotification(accountB.user.id, recordB);

const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: appPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
let failure: unknown;
try {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const accountAGroups = ["Today", "Yesterday", ...(daysSinceMonday >= 2 ? ["Earlier This Week"] : []), "Earlier"];
  await exercise(chromiumBrowser, "Chromium", origin, accountA.session.token, recordA.title, recordB.title, { width: 1280, height: 900 }, "light", "no-preference", accountAGroups, {
    title: arrival.title,
    insert: async () => {
      await storeNotification(accountA.user.id, arrival);
    },
  });
  await exercise(webkitBrowser, "WebKit", origin, accountB.session.token, recordB.title, recordA.title, { width: 390, height: 844 }, "midnight", "reduce", ["Today"]);

  const emptyContext = await chromiumBrowser.newContext({ viewport: { width: 390, height: 844 } });
  await install(emptyContext, origin, emptyAccount.session.token);
  const emptyPage = await emptyContext.newPage();
  await emptyPage.goto(`${origin}/notifications`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await emptyPage.getByRole("heading", { name: "You’re all caught up." }).waitFor();
  await emptyPage.getByText("Important updates about your saved opportunities and Journey will appear here.").waitFor();
  assert.equal(await emptyPage.locator("[data-notification-item]").count(), 0);
  await emptyContext.close();

  const context = await chromiumBrowser.newContext({ viewport: { width: 1024, height: 768 } });
  await install(context, origin, accountA.session.token);
  const page = await context.newPage();
  await page.goto(`${origin}/profile#notifications`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const weekly = page.getByRole("checkbox", { name: /Weekly UnlockED summary/ });
  await weekly.waitFor();
  await weekly.check();
  await page.getByRole("button", { name: "Save notification settings" }).click();
  await page.getByText("Notification settings saved.").waitFor();
  const saved = await page.evaluate(async () => {
    const response = await fetch("/api/notifications/preferences", { credentials: "same-origin" });
    return await response.json();
  });
  assert.equal(saved.preferences.weeklyDigest, true);

  await context.addCookies([{ name: "unlocked_session", value: accountB.session.token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
  await page.goto(`${origin}/notifications`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: recordB.title }).waitFor();
  assert.equal(await page.getByText(recordA.title, { exact: true }).count(), 0);
  const forged = await page.evaluate(async (notificationId) => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", notificationId }),
    });
    return response.status;
  }, recordA.id);
  assert.equal(forged, 404, "Cross-account notification mutation must not reveal or update the record.");
  await context.close();
  console.log("Notification browser checks passed", { browsers: ["Chromium", "WebKit"], viewports: ["desktop", "mobile"], accounts: 3, states: ["loading", "arrival", "read", "empty"] });
} catch (error) {
  failure = error;
} finally {
  await Promise.all([chromiumBrowser.close(), webkitBrowser.close()]);
  server.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => server.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  kv.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => kv.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
}
if (failure) {
  console.error("Notification browser checks failed", failure);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
