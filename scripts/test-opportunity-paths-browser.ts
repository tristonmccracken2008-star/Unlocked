import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { mkdir } from "node:fs/promises";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";
import type { AccountData } from "../lib/account-types";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const output = "/tmp/unlocked-opportunity-paths";
const live = (key: string) => {
  const item = store.get(key);
  if (item?.expiresAt && item.expiresAt <= Date.now()) { store.delete(key); return undefined; }
  return item;
};
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
      if (String(command[1]).includes("INCR")) {
        const current = Number(live(lockKey)?.value ?? 0) + 1;
        store.set(lockKey, { value: current, expiresAt: Date.now() + Number(command[4]) * 1_000 });
        result = current;
      } else if (live(lockKey)?.value === command[4]) { store.delete(lockKey); result = 1; }
    } else if (["PFADD", "HINCRBY", "ZINCRBY", "EXPIRE", "ZADD", "SADD", "LPUSH", "LTRIM"].includes(String(operation))) result = 1;
    else if (["ZRANGEBYSCORE", "ZREVRANGE", "SMEMBERS", "LRANGE"].includes(String(operation))) result = [];
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function install(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin
    ? route.continue()
    : route.fulfill({ status: 204, body: "" }));
}
function observe(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("_vercel")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return Object.assign(
    () => assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`),
    { clear: () => { errors.length = 0; } },
  );
}
async function assertNoOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
    }).slice(0, 6).map((element) => ({ tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right) })),
  }));
  assert.ok(result.overflow <= 1, `${label} created horizontal overflow: ${JSON.stringify(result)}`);
}

await mkdir(output, { recursive: true });
const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "opportunity-paths-browser-secret-with-sufficient-length";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "opportunity-paths-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;

const { opportunities } = await import("../data/opportunities");
const { getOpportunityPath } = await import("../data/opportunity-paths");
const { buildOpportunityPathIndex } = await import("../lib/opportunity-paths");
const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
const quant = getOpportunityPath("quantitative-data")!;
const quantOpportunity = [...buildOpportunityPathIndex(opportunities).get(quant.id)!.values()].flat()[0]!;
const now = "2026-08-24T12:00:00.000Z";

async function seed(label: string, senior = false) {
  const user = await upsertUser({ googleSub: `path-browser-${label}`, email: `${label.toLowerCase()}@example.test`, name: `${label} Student` });
  const tracked = senior ? { id: quantOpportunity.id, status: "Applying" as const, savedAt: now, updatedAt: now, version: 1, history: [] } : null;
  const account: Partial<AccountData> = {
    profile: { firstName: label, schoolSlug: "university-of-chicago", major: senior ? "Mathematics" : "Computer Science", graduationYear: senior ? "2027" : "2030", year: senior ? "Senior" : "First year", careerGoal: senior ? "Quantitative Finance" : "Software Engineering", interests: senior ? "Finance, Data Science" : "Software, Research", onboardingCompletedAt: now },
    onboardingComplete: true,
    firstLaunchComplete: true,
    activity: { viewed: [], saved: tracked ? [tracked.id] : [], claimed: [], tracked: tracked ? { [tracked.id]: tracked } : {} },
    savedOpportunities: tracked ? [{ opportunityId: tracked.id, savedAt: now }] : [],
    tracker: tracked ? { [tracked.id]: tracked } : {},
    watchedOpportunities: senior ? [{ opportunityId: quantOpportunity.id, watchedAt: now, updatedAt: now, version: 1 }] : [],
    pathPreferences: senior ? { [quant.id]: { pathId: quant.id, followedAt: now, updatedAt: now, version: 1 } } : {},
    preferences: { appearance: senior ? "midnight" : "light", updatedAt: now },
  };
  await mergeAccountData(user.id, account);
  if (senior) await updateAccountBilling(user.id, { tier: "pro", status: "active" });
  return createSession(user);
}

const firstYear = await seed("Avery");
const senior = await seed("Jordan", true);
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: appPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
let failure: unknown;
try {
  const signedOut = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 900 } });
  const signedOutPage = await signedOut.newPage();
  await signedOutPage.goto(`${origin}/paths`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(new URL(signedOutPage.url()).pathname, "/", "Signed-out users must not access Paths.");
  await signedOut.close();

  const desktop = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await install(desktop, origin, firstYear.token);
  const page = await desktop.newPage();
  const noErrors = observe(page);
  await page.goto(`${origin}/paths`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "See how opportunities connect." }).waitFor();
  await page.getByRole("heading", { name: "Directions connected to your interests" }).waitFor();
  await assertNoOverflow(page, "Paths landing desktop");
  await page.screenshot({ path: `${output}/landing-1440.png`, fullPage: true, caret: "initial" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await assertNoOverflow(page, "Paths landing 1280");
  await page.getByRole("link", { name: /Software Engineering & Cybersecurity/ }).first().click();
  await page.getByRole("heading", { name: "Software Engineering & Cybersecurity" }).waitFor();
  assert.ok(await page.getByText(/Free preview shows one current example/).count() > 0, "Free must receive useful, bounded Path examples.");
  const follow = page.getByRole("button", { name: "Follow path" });
  await follow.click();
  await page.getByRole("button", { name: "Following" }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Following" }).waitFor();
  noErrors();
  await page.route("**/api/paths/follow", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Path could not be updated." }) }));
  await page.getByRole("button", { name: "Following" }).click();
  await page.getByText("Path could not be updated.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Following" }).waitFor();
  await page.unroute("**/api/paths/follow");
  noErrors.clear();
  const add = page.getByRole("button", { name: /Add to Journey/ }).first();
  await add.click();
  await page.getByText("Added to Journey", { exact: true }).first().waitFor();
  await assertNoOverflow(page, "Free Path detail desktop");
  noErrors();
  await desktop.close();

  const wide = await chromiumBrowser.newContext({ viewport: { width: 1728, height: 1100 } });
  await install(wide, origin, senior.token);
  const widePage = await wide.newPage();
  await widePage.goto(`${origin}/paths/quantitative-data`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await widePage.getByRole("heading", { name: "Quantitative Finance & Data" }).waitFor();
  await widePage.getByText(/^\d+ in Journey$/).first().waitFor();
  await widePage.getByRole("link", { name: /Open Planner/ }).waitFor();
  await widePage.screenshot({ path: `${output}/quant-senior-1728.png`, fullPage: true, caret: "initial" });
  await assertNoOverflow(widePage, "Senior Path detail wide");
  await wide.close();

  const mobile = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await install(mobile, origin, senior.token);
  const mobilePage = await mobile.newPage();
  const mobileNoErrors = observe(mobilePage);
  await mobilePage.goto(`${origin}/paths/quantitative-data`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await mobilePage.getByRole("heading", { name: "Quantitative Finance & Data" }).waitFor();
  await mobilePage.evaluate(() => { document.documentElement.dataset.theme = "midnight"; document.documentElement.style.colorScheme = "dark"; });
  const darkColors = await mobilePage.locator("[data-opportunity-paths]").evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
  assert.deepEqual(darkColors, { color: "rgb(251, 243, 232)", background: "rgb(33, 26, 22)" }, "Paths must consume the shared dark-theme color tokens correctly.");
  await assertNoOverflow(mobilePage, "Mobile WebKit Path detail");
  await mobilePage.screenshot({ path: `${output}/quant-mobile-webkit-dark.png`, fullPage: true, caret: "initial" });
  mobileNoErrors();

  await mobile.close();

  const switchedAccount = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await install(switchedAccount, origin, firstYear.token);
  const switchedPage = await switchedAccount.newPage();
  const switchedNoErrors = observe(switchedPage);
  await switchedPage.goto(`${origin}/paths/quantitative-data`, { waitUntil: "domcontentloaded" });
  await switchedPage.getByRole("button", { name: "Follow path" }).waitFor();
  assert.equal(await switchedPage.getByRole("button", { name: "Following" }).count(), 0, "The prior account's Quant follow state must not appear for another account.");
  switchedNoErrors();
  await switchedAccount.close();

  const reflow = await chromiumBrowser.newContext({ viewport: { width: 640, height: 900 }, reducedMotion: "reduce" });
  await install(reflow, origin, senior.token);
  const reflowPage = await reflow.newPage();
  await reflowPage.goto(`${origin}/paths/quantitative-data`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await reflowPage.getByRole("heading", { name: "Quantitative Finance & Data" }).waitFor();
  await assertNoOverflow(reflowPage, "200% reflow-equivalent Path detail");
  await reflow.close();

  console.log("Opportunity Paths browser checks passed", { browsers: ["Chromium", "WebKit"], viewports: [1280, 1440, 1728, 640, 390], states: ["signed_out", "free_first_year", "pro_senior", "follow", "failure_recovery", "journey_handoff", "account_switch", "dark", "reduced_motion"] });
} catch (error) {
  failure = error;
} finally {
  await Promise.race([Promise.all([chromiumBrowser.close(), webkitBrowser.close()]), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  server.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => server.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  kv.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => kv.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
}
if (failure) {
  console.error("Opportunity Paths browser checks failed", failure);
  process.exit(1);
}
process.exit(0);
