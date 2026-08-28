import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "../data/student-activity";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const output = "/tmp/unlocked-personal-opportunity-strategy";

function live(key: string) { const item = store.get(key); if (item?.expiresAt && item.expiresAt <= Date.now()) { store.delete(key); return undefined; } return item; }
async function listen(server: net.Server, port = 0) { await new Promise<void>((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve)); return (server.address() as net.AddressInfo).port; }
async function freePort() { const server = net.createServer(); const port = await listen(server); await new Promise<void>((resolve) => server.close(() => resolve())); return port; }
function createKvServer() {
  return http.createServer(async (request, response) => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const command = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown[];
    const operation = String(command[0] ?? ""); const key = String(command[1] ?? ""); let result: unknown = null;
    if (operation === "GET") result = live(key)?.value ?? null;
    else if (operation === "SET") { if (!command.includes("NX") || !live(key)) { const expiry = command.indexOf("EX"); store.set(key, { value: command[2], expiresAt: expiry >= 0 ? Date.now() + Number(command[expiry + 1]) * 1_000 : undefined }); result = "OK"; } }
    else if (operation === "DEL") result = store.delete(key) ? 1 : 0;
    else if (operation === "EVAL") { const lockKey = String(command[3]); if (live(lockKey)?.value === command[4]) { store.delete(lockKey); result = 1; } else result = 0; }
    else if (["PFADD", "HINCRBY", "ZINCRBY", "EXPIRE", "ZADD", "SADD", "LPUSH"].includes(operation)) result = 1;
    else if (["ZRANGEBYSCORE", "ZREVRANGE", "SMEMBERS", "LRANGE"].includes(operation)) result = [];
    else if (operation === "LTRIM") result = "OK";
    response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ result }));
  });
}

function tracked(id: string, status: OpportunityTrackerStatus, index: number): TrackedOpportunity {
  return { id, status, savedAt: `2026-07-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`, updatedAt: `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`, version: 1, history: [] };
}

async function seed(label: string, pro: boolean) {
  const { createSession, mergeAccountData, updateAccountBilling, updateFollowedOpportunityPath, updateWatchedOpportunity, upsertUser } = await import("../lib/auth-store");
  const { listPublishedOpportunities } = await import("../lib/content-store");
  const opportunities = await listPublishedOpportunities();
  const research = opportunities.filter((item) => item.type === "Research").slice(0, 4);
  const watched = opportunities.find((item) => item.type === "Career" && !research.some((candidate) => candidate.id === item.id));
  assert.equal(research.length, 4);
  assert.ok(watched);
  const records = research.map((item, index) => tracked(item.id, index === 3 ? "Submitted" : "Applying", index));
  const tracker = Object.fromEntries(records.map((record) => [record.id, record]));
  const user = await upsertUser({ googleSub: `strategy-${label}`, email: `${label}@example.test`, name: `${label} Student` });
  await mergeAccountData(user.id, {
    profile: { firstName: label, schoolSlug: "university-of-chicago", major: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Research", interests: "Research, software", onboardingCompletedAt: "2026-08-01T12:00:00.000Z" },
    onboardingComplete: true, firstLaunchComplete: true,
    activity: { viewed: [], saved: records.map((record) => record.id), claimed: [], tracked: tracker },
    savedOpportunities: records.map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })), tracker,
    preferences: { appearance: pro ? "midnight" : "light", updatedAt: "2026-08-01T12:00:00.000Z" },
  });
  if (pro) await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  await updateWatchedOpportunity(user.id, watched.id, true);
  await updateFollowedOpportunityPath(user.id, "research-graduate-study", true);
  return (await createSession(user)).token;
}

async function install(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
  await context.route(/\/api\/(?:analytics\/event|return-experience)(?:\?|$)/, (route) => route.fulfill({ status: 204 }));
  await context.route("**/_next/image**", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"/>' }));
  await context.route("**/*", (route) => route.request().resourceType() === "image" && new URL(route.request().url()).origin !== origin
    ? route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"/>' })
    : route.continue());
}

async function verify(page: Page, label: string, pro: boolean) {
  const errors: string[] = []; page.on("console", (message) => {
    const url = message.location().url;
    const isolatedStoreBackgroundRequest = /\/api\/(?:analytics\/event|return-experience)(?:\?|$)/.test(url);
    if (message.type() === "error" && !isolatedStoreBackgroundRequest) errors.push(`${message.text()} [${url || "unknown"}]`);
  }); page.on("pageerror", (error) => errors.push(error.message));
  const strategy = page.locator("[data-guide-anchor='journey-strategy']");
  await strategy.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>("[data-guide-anchor='journey-strategy']");
    return root && getComputedStyle(root).borderTopStyle !== "none";
  }, undefined, { timeout: 10_000 });
  await strategy.getByRole("heading", { name: "How your current opportunities fit together" }).waitFor();
  await strategy.getByRole("heading", { name: "Current mix" }).waitFor();
  await strategy.getByRole("heading", { name: "Timing" }).waitFor();
  const relationshipSummary = (await strategy.locator(":scope > header > span").textContent())?.trim();
  assert.equal(relationshipSummary, "4 pursuing · 1 watching");
  if (pro) {
    await strategy.getByRole("heading", { name: "Similar opportunities" }).waitFor();
    await strategy.getByRole("heading", { name: "Your goals" }).waitFor();
    assert.equal(await strategy.getByRole("link", { name: "View Pro" }).count(), 0);
  } else {
    await strategy.getByRole("link", { name: "View Pro" }).waitFor();
    assert.equal(await strategy.getByRole("heading", { name: "Your goals" }).count(), 0);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} has ${overflow}px horizontal overflow.`);
  const undersized = await strategy.locator("a:visible, summary:visible").evaluateAll((nodes) => nodes.flatMap((node) => { const box = (node as HTMLElement).getBoundingClientRect(); const style = getComputedStyle(node); return box.width < 44 || box.height < 44 ? [`${(node.textContent ?? "control").trim()} (${box.width.toFixed(1)}x${box.height.toFixed(1)}; ${style.display}; min ${style.minHeight}; pad ${style.paddingBlockStart}/${style.paddingBlockEnd})`] : []; }));
  assert.deepEqual(undersized, [], `${label} has undersized controls: ${undersized.join(", ")}`);
  assert.doesNotMatch(await strategy.textContent() ?? "", /you should|optimal|too many|acceptance chance|success score/i);
  await strategy.screenshot({ path: path.join(output, `${label}.png`), caret: "initial" });
  assert.deepEqual(errors, [], `${label} emitted browser errors: ${errors.join(" | ")}`);
}

const kv = createKvServer(); const kvPort = await listen(kv);
process.env.AUTH_SECRET = "strategy-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`; process.env.KV_REST_API_TOKEN = "strategy-browser-token";
const port = await freePort(); process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${port}`;
const freeToken = await seed("Free", false); const proToken = await seed("Pro", true);
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port }); await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response)); await listen(server, port);
const origin = `http://127.0.0.1:${port}`; mkdirSync(output, { recursive: true });
const browsers = { chromium: await chromium.launch({ headless: true }), webkit: await webkit.launch({ headless: true }) };
let failure: unknown;
try {
  for (const [engine, browser] of Object.entries(browsers)) {
    for (const scenario of [{ id: "desktop-pro", token: proToken, pro: true, viewport: { width: 1440, height: 1000 } }, { id: "mobile-free", token: freeToken, pro: false, viewport: { width: 390, height: 844 } }]) {
      const context = await browser.newContext({ viewport: scenario.viewport, reducedMotion: scenario.id.includes("mobile") ? "reduce" : "no-preference", colorScheme: scenario.pro ? "dark" : "light" });
      await install(context, origin, scenario.token); const page = await context.newPage(); await page.goto(origin, { waitUntil: "domcontentloaded" });
      await verify(page, `${engine}-${scenario.id}`, scenario.pro); await context.close();
    }
  }
} catch (error) { failure = error; }
await Promise.all(Object.values(browsers).map((browser) => browser.close())); await new Promise<void>((resolve) => server.close(() => resolve())); await app.close(); await new Promise<void>((resolve) => kv.close(() => resolve()));
if (failure) throw failure;
console.log("Personal Opportunity Strategy browser checks passed", { engines: Object.keys(browsers), scenarios: 4, output });
