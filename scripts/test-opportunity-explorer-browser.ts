import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { mkdir } from "node:fs/promises";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";
import type { AccountData } from "../lib/account-types";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const output = "/tmp/unlocked-opportunity-explorer";
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
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ status: 204, body: "" }));
}
function observe(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("_vercel")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`);
}
async function assertNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} created ${overflow}px of horizontal overflow.`);
}

await mkdir(output, { recursive: true });
const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "opportunity-explorer-browser-secret-with-sufficient-length";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "opportunity-explorer-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
const now = "2026-08-24T12:00:00.000Z";
async function seed(label: string, senior = false) {
  const user = await upsertUser({ googleSub: `explorer-browser-${label}`, email: `${label.toLowerCase()}@example.test`, name: `${label} Student` });
  const account: Partial<AccountData> = {
    profile: {
      firstName: label, schoolSlug: "university-of-chicago", schoolName: "University of Chicago", major: senior ? "English" : "Mathematics", secondaryMajor: senior ? undefined : "Computer Science", graduationYear: senior ? "2027" : "2030", year: senior ? "Fourth year" : "First year", careerGoal: senior ? "Public Policy" : "Quantitative Finance", interests: senior ? "Writing, Museums" : "Data Science, Research", fieldInterests: senior ? ["Writing"] : ["Data Science", "Research"], specificCareerInterests: senior ? ["Public Policy"] : ["Quantitative Finance"], goals: ["Explore opportunities"], topics: senior ? ["Museums"] : ["Research"], onboardingCompletedAt: now,
      institutionType: "university", enrollmentStatus: "enrolled", degreeLevel: "undergraduate", citizenshipStatus: "us_citizen", workAuthorization: "us_authorized", transferStatus: "not_transfer", financialNeedStatus: "unknown", meritStatus: "unknown",
    },
    onboardingComplete: true, firstLaunchComplete: true, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, savedOpportunities: [], tracker: {}, watchedOpportunities: [], pathPreferences: {}, preferences: { appearance: senior ? "midnight" : "light", updatedAt: now },
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
  await signedOutPage.goto(`${origin}/explore`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(new URL(signedOutPage.url()).pathname, "/", "Signed-out users must not access Explorer.");
  await signedOut.close();

  const desktop = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await install(desktop, origin, firstYear.token);
  const page = await desktop.newPage();
  const noErrors = observe(page);
  await page.goto(`${origin}/explore`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Discover what’s possible." }).waitFor();
  await page.getByRole("heading", { name: "Areas connected to what you study" }).waitFor();
  await page.getByRole("link", { name: /Research Work with faculty/ }).click();
  await page.getByRole("heading", { name: "Research", exact: true }).last().waitFor();
  assert.match(page.url(), /type=research/);
  await page.getByRole("link", { name: /Explore all in Discover/ }).last().waitFor();
  await page.getByRole("heading", { name: "Things you can do now" }).waitFor();
  await page.getByRole("heading", { name: "Explore by experience" }).waitFor();
  assert.ok(await page.getByText("First-year eligibility supported", { exact: true }).count() === 0, "Landing should keep eligibility detail inside the current examples, not add clutter.");
  await assertNoOverflow(page, "Explorer landing 1440");
  await page.screenshot({ path: `${output}/landing-1440.png`, fullPage: true, caret: "initial" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await assertNoOverflow(page, "Explorer landing 1280");
  await page.getByRole("link", { name: /Mathematics & Data/ }).first().click();
  await page.getByRole("heading", { name: "Mathematics & Data" }).waitFor();
  await page.getByRole("heading", { name: "Quantitative finance" }).waitFor();
  await page.getByText("This is a map, not a ranking.").waitFor();
  await assertNoOverflow(page, "Explorer area 1280");
  const discover = page.getByRole("link", { name: /Explore all in Discover/ }).first();
  assert.ok((await discover.getAttribute("href"))?.startsWith("/opportunities?"), "Landscape must hand off through deterministic Discover filters.");
  const add = page.getByRole("button", { name: /Add to Journey/ }).first();
  await add.click();
  await page.getByText("Added to Journey", { exact: true }).first().waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(/In Journey/).first().waitFor();
  noErrors();
  await desktop.close();

  const wide = await chromiumBrowser.newContext({ viewport: { width: 1728, height: 1100 }, reducedMotion: "no-preference" });
  await install(wide, origin, senior.token);
  const widePage = await wide.newPage();
  await widePage.goto(`${origin}/explore/humanities-communication`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await widePage.getByRole("heading", { name: "Humanities, Writing & Culture" }).waitFor();
  await widePage.getByRole("heading", { name: "Museums & archives" }).waitFor();
  await widePage.getByRole("link", { name: /View Humanities & Writing Path/ }).waitFor();
  await assertNoOverflow(widePage, "Humanities Explorer 1728");
  await widePage.screenshot({ path: `${output}/humanities-1728.png`, fullPage: true, caret: "initial" });
  await wide.close();

  const mobile = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await install(mobile, origin, senior.token);
  const mobilePage = await mobile.newPage();
  const mobileNoErrors = observe(mobilePage);
  await mobilePage.goto(`${origin}/explore`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await mobilePage.getByRole("heading", { name: "Discover what’s possible." }).waitFor();
  await mobilePage.evaluate(() => { document.documentElement.dataset.theme = "midnight"; document.documentElement.style.colorScheme = "dark"; });
  const colors = await mobilePage.locator("[data-opportunity-explorer]").evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
  assert.deepEqual(colors, { color: "rgb(244, 247, 251)", background: "rgb(11, 17, 27)" });
  const sectionHeadingColor = await mobilePage.getByRole("heading", { name: "Areas connected to what you study" }).evaluate((element) => getComputedStyle(element).color);
  const areaHeadingColor = await mobilePage.getByText("Computer Science", { exact: true }).first().evaluate((element) => getComputedStyle(element).color);
  assert.equal(sectionHeadingColor, "rgb(244, 247, 251)");
  assert.equal(areaHeadingColor, "rgb(244, 247, 251)");
  await assertNoOverflow(mobilePage, "Explorer mobile WebKit");
  await mobilePage.screenshot({ path: `${output}/landing-mobile-webkit-dark.png`, fullPage: true, caret: "initial" });
  mobileNoErrors();
  await mobile.close();

  const reflow = await chromiumBrowser.newContext({ viewport: { width: 640, height: 900 }, reducedMotion: "reduce" });
  await install(reflow, origin, firstYear.token);
  const reflowPage = await reflow.newPage();
  await reflowPage.goto(`${origin}/explore/mathematics-data`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await reflowPage.getByRole("heading", { name: "Mathematics & Data" }).waitFor();
  await assertNoOverflow(reflowPage, "Explorer 200% reflow equivalent");
  await reflow.close();

  console.log("Opportunity Explorer browser checks passed", { browsers: ["Chromium", "WebKit"], viewports: [1280, 1440, 1728, 640, 390], states: ["signed_out", "free_first_year", "pro_humanities", "journey_handoff", "dark", "reduced_motion", "reflow"] });
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
if (failure) { console.error("Opportunity Explorer browser checks failed", failure); process.exit(1); }
process.exit(0);
