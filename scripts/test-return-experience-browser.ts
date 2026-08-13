import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";
import type { NotificationRecord } from "../lib/notification-types";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
function live(key: string) { const item = store.get(key); if (item?.expiresAt && item.expiresAt <= Date.now()) { store.delete(key); return undefined; } return item; }
async function listen(server: net.Server, port = 0) { await new Promise<void>((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve)); return (server.address() as net.AddressInfo).port; }
async function freePort() { const server = net.createServer(); const port = await listen(server); await new Promise<void>((resolve) => server.close(() => resolve())); return port; }

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
    else if (operation === "EVAL") { const lockKey = String(command[3]); if (live(lockKey)?.value === command[4]) { store.delete(lockKey); result = 1; } else result = 0; }
    else if (["PFADD", "HINCRBY", "ZINCRBY", "EXPIRE", "ZADD"].includes(String(operation))) result = 1;
    else if (operation === "ZRANGEBYSCORE" || operation === "ZREVRANGE" || operation === "SMEMBERS") result = [];
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function seed(label: string, active: boolean, withRecommendation: boolean) {
  const { opportunities } = await import("../data/opportunities");
  const { createSession, mergeAccountData, upsertUser } = await import("../lib/auth-store");
  const { storeNotification } = await import("../lib/notification-store");
  const opportunity = opportunities.find((item) => item.type === "Career" && item.verification_status === "verified") ?? opportunities.find((item) => item.type === "Career")!;
  const user = await upsertUser({ googleSub: `return-${label}`, email: `${label}@example.test`, name: `${label} Student` });
  const savedAt = "2026-08-01T12:00:00.000Z";
  const updatedAt = "2026-08-09T12:00:00.000Z";
  const record = { id: opportunity.id, status: "Applying" as const, savedAt, updatedAt, version: 1, history: [{ id: `return-history-${label}`, transition: "start" as const, priorStatus: "Saved" as const, resultingStatus: "Applying" as const, occurredAt: updatedAt }] };
  await mergeAccountData(user.id, {
    profile: { firstName: label, schoolSlug: "university-of-chicago", major: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Software Engineering", interests: "Software, Research", onboardingCompletedAt: savedAt },
    onboardingComplete: true,
    firstLaunchComplete: true,
    firstLaunchCompletedAt: savedAt,
    activity: { viewed: [], saved: active ? [opportunity.id] : [], claimed: [], tracked: active ? { [opportunity.id]: record } : {} },
    savedOpportunities: active ? [{ opportunityId: opportunity.id, savedAt }] : [],
    tracker: active ? { [opportunity.id]: record } : {},
    applicationWorkspaces: active ? { [opportunity.id]: { opportunityId: opportunity.id, tasks: { essay: { id: "essay", title: "Finish application essay", dueDate: "2026-08-12", source: "user", completed: false, createdAt: savedAt, updatedAt, version: 0 } }, createdAt: savedAt, updatedAt, version: 0 } } : {},
    preferences: { appearance: "light", notifications: { inAppEnabled: true, emailEnabled: false, deadlineReminders: true, journeyReminders: true, opportunityChanges: true, personalizedOpportunities: true, milestoneUpdates: true, accountUpdates: true, productAnnouncements: false, weeklyDigest: false, recommendationUpdates: false, frequency: "important_only", timezone: "America/New_York", quietHours: { enabled: true, startHour: 22, endHour: 8 }, updatedAt }, updatedAt },
  });
  if (withRecommendation) {
    const notification: NotificationRecord = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      type: "recommendation_update",
      priority: "normal",
      state: "delivered",
      title: "A new opportunity fits your profile",
      body: "A verified opportunity is a strong match based on your profile and eligibility.",
      opportunityId: "browser-return-match",
      actionLabel: "Review match",
      actionHref: "/advisor",
      createdAt: "2026-08-10T15:00:00.000Z",
      expiresAt: "2026-09-10T15:00:00.000Z",
      idempotencyKey: "return-browser-recommendation",
      contentVersion: "v1",
      channels: { inApp: { state: "delivered", deliveredAt: "2026-08-10T15:00:00.000Z" }, email: { state: "not_requested" } },
    };
    await storeNotification(user.id, notification);
  }
  return { session: await createSession(user), opportunity };
}

async function install(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
}

function observe(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => { const text = message.text(); if (message.type() === "error" && !text.includes("_vercel") && !text.includes("ERR_NAME_NOT_RESOLVED") && !text.includes("specified hostname could not be found")) errors.push(text); });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`);
}

const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "return-experience-browser-secret-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "return-experience-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const owner = await seed("Taylor", true, true);
const other = await seed("Other", false, false);
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: appPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
let failure: unknown;
try {
  const desktop = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 900 } });
  await install(desktop, origin, owner.session.token);
  const page = await desktop.newPage();
  const noDesktopErrors = observe(page);
  const receipt = page.waitForResponse((response) => response.url().endsWith("/api/return-experience") && response.status() === 200);
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const briefing = page.locator("[data-return-briefing]");
  await briefing.waitFor({ timeout: 60_000 });
  await receipt;
  assert.match(await briefing.getByRole("heading", { level: 2 }).innerText(), /Since your last visit/);
  assert.ok(await briefing.locator("li").count() <= 3, "The return briefing must never exceed three items.");
  await briefing.getByRole("link", { name: /Continue application|Review application/ }).click();
  await page.getByRole("dialog", { name: new RegExp(owner.opportunity.title) }).waitFor();
  await page.keyboard.press("Escape");
  const recommendation = briefing.getByText("A new match fits your profile", { exact: true });
  await recommendation.waitFor();
  await briefing.getByRole("button", { name: /Dismiss A new match fits your profile/ }).click();
  await recommendation.waitFor({ state: "hidden" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-return-briefing]").waitFor();
  assert.equal(await page.getByText("A new match fits your profile", { exact: true }).count(), 0, "Presented or dismissed recommendations must not be called new again.");
  noDesktopErrors();
  await desktop.close();

  const isolated = await chromiumBrowser.newContext({ viewport: { width: 1024, height: 768 } });
  await install(isolated, origin, other.session.token);
  const isolatedPage = await isolated.newPage();
  await isolatedPage.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(await isolatedPage.locator("[data-return-briefing]").count(), 0, "An account without activity must not receive another account’s briefing.");
  await isolated.close();

  const mobile = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await install(mobile, origin, owner.session.token);
  const mobilePage = await mobile.newPage();
  const noMobileErrors = observe(mobilePage);
  await mobilePage.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const mobileBriefing = mobilePage.locator("[data-return-briefing]");
  await mobileBriefing.waitFor({ timeout: 60_000 });
  assert.equal(await mobileBriefing.evaluate((node) => getComputedStyle(node).animationName), "none", "Reduced motion must suppress briefing entrance motion.");
  const targets = await mobileBriefing.locator("a, button").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).getBoundingClientRect().height));
  assert.ok(targets.every((height) => height >= 44), "Return actions must remain at least 44px tall on mobile.");
  const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Return briefing created ${overflow}px mobile overflow.`);
  noMobileErrors();
  await mobile.close();
  console.log("Smart Return Experience browser checks passed", { browsers: ["Chromium", "WebKit"], accountIsolation: true, freshness: true, directContinuation: true, mobile: true });
} catch (error) { failure = error; } finally {
  await Promise.all([chromiumBrowser.close(), webkitBrowser.close()]);
  server.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => server.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  await new Promise<void>((resolve) => kv.close(() => resolve()));
}
if (failure) throw failure;
process.exit(0);
