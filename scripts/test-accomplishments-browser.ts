import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { mkdir } from "node:fs/promises";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";
import type { AccomplishmentRecord } from "../data/accomplishments";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const output = "/tmp/unlocked-accomplishments";
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

function records(count: number): Record<string, AccomplishmentRecord> {
  const result: Record<string, AccomplishmentRecord> = {};
  for (let index = 0; index < count; index += 1) {
    const id = `manual:browser-${index}`;
    const year = 2023 + index % 4;
    result[id] = {
      id,
      source: "manual",
      snapshot: {
        title: index === 0 ? "Undergraduate Research Assistant" : `College accomplishment ${index + 1}`,
        organization: index === 0 ? "Center for Quantitative Research and Public Policy" : `Campus organization ${index + 1}`,
        capturedAt: `${year}-05-20T12:00:00.000Z`,
      },
      kind: index % 4 === 0 ? "research" : index % 4 === 1 ? "internship" : index % 4 === 2 ? "scholarship" : "competition",
      outcome: index % 4 === 2 ? "awarded" : index % 4 === 3 ? "finalist" : "completed",
      outcomeDate: `${year}-05-20`,
      roleTitle: index === 0 ? "Research Assistant for Longitudinal Policy Analysis" : undefined,
      notes: index === 0 ? "Private browser fixture note" : undefined,
      hidden: false,
      createdAt: `${year}-05-20T12:00:00.000Z`,
      updatedAt: `${year}-05-20T12:00:00.000Z`,
      version: 0,
    };
  }
  return result;
}

async function seed(label: string, count: number, dark = false) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const user = await upsertUser({ googleSub: `accomplishment-browser-${label}`, email: `${label.toLowerCase()}@example.test`, name: `${label} Student` });
  await mergeAccountData(user.id, {
    profile: { firstName: label, schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2027", year: "Senior", careerGoal: "Research", interests: "Research", onboardingCompletedAt: "2026-01-01T12:00:00.000Z" },
    onboardingComplete: true,
    firstLaunchComplete: true,
    accomplishments: records(count),
    preferences: { appearance: dark ? "midnight" : "light", updatedAt: "2026-08-23T12:00:00.000Z" },
  });
  if (dark) await updateAccountBilling(user.id, { tier: "pro", status: "active" });
  return await createSession(user);
}

async function install(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
}
function observe(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("_vercel")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`);
}
async function assertNoOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
    }).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) })),
  }));
  assert.ok(result.overflow <= 1, `${label} created ${result.overflow}px horizontal overflow: ${JSON.stringify(result.offenders)}`);
}

await mkdir(output, { recursive: true });
const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "accomplishments-browser-secret-with-sufficient-length";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "accomplishments-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const firstYear = await seed("Avery", 0);
const senior = await seed("Jordan", 20, true);
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
  await signedOutPage.goto(`${origin}/accomplishments`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(new URL(signedOutPage.url()).pathname, "/", "Signed-out users must not access the private accomplishment record.");
  await signedOut.close();

  const desktop = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await install(desktop, origin, firstYear.token);
  const page = await desktop.newPage();
  const noErrors = observe(page);
  await page.goto(`${origin}/accomplishments`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your accomplishments will appear here." }).waitFor();
  await page.screenshot({ path: `${output}/empty-desktop.png`, fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Add something you’ve done" }).click();
  await page.getByRole("heading", { name: "Something you’ve done" }).waitFor();
  await page.getByLabel("Title", { exact: true }).fill("Campus Research Fellow");
  await page.getByLabel("Organization").fill("University Data Lab");
  await page.getByLabel("Outcome date").fill("2026-05-15");
  await page.getByLabel(/Private notes/).fill("Keep this private note out of search and analytics.");
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("heading", { name: "Campus Research Fellow" }).waitFor();
  await page.getByText("1 accomplishment").waitFor();
  const record = page.locator("article").filter({ hasText: "Campus Research Fellow" });
  await record.getByText("Details", { exact: true }).click();
  await record.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel(/Role or title/).fill("Research Fellow");
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByText("Research Fellow", { exact: true }).waitFor();
  const editAgain = record.getByRole("button", { name: "Edit details" });
  if (!await editAgain.isVisible()) await record.getByText("Details", { exact: true }).click();
  await editAgain.click();
  await page.getByRole("button", { name: "Remove record" }).click();
  await page.getByRole("button", { name: "Confirm remove" }).click();
  await page.getByRole("heading", { name: "Your accomplishments will appear here." }).waitFor();

  await page.getByRole("button", { name: "Add something you’ve done" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Preserved after failure");
  await page.getByLabel("Organization").fill("Campus Program");
  await page.getByLabel("Outcome date").fill("2026-06-10");
  noErrors();
  await page.route("**/api/accomplishments", (route) => route.request().method() === "POST" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "The record could not be saved right now." }) }) : route.continue());
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("Title", { exact: true }).inputValue(), "Preserved after failure");
  await page.unroute("**/api/accomplishments");
  await page.getByRole("button", { name: "Close" }).click();
  await desktop.close();

  const mobile = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await install(mobile, origin, senior.token);
  const mobilePage = await mobile.newPage();
  const mobileNoErrors = observe(mobilePage);
  await mobilePage.goto(`${origin}/accomplishments`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await mobilePage.getByRole("heading", { name: "Accomplishments", exact: true }).waitFor();
  await mobilePage.getByText("20 accomplishments").waitFor();
  await mobilePage.evaluate(() => { document.documentElement.dataset.theme = "midnight"; document.documentElement.style.colorScheme = "dark"; });
  assert.equal(await mobilePage.locator('html[data-theme="midnight"]').count(), 1, "The accomplishment record must honor the selected dark theme.");
  assert.equal(await mobilePage.locator("[data-accomplishments]").evaluate((element) => getComputedStyle(element).color), "rgb(251, 243, 232)", "The record must inherit the active dark-theme text token.");
  await assertNoOverflow(mobilePage, "Mobile accomplishment record");
  await mobilePage.screenshot({ path: `${output}/senior-mobile-dark.png`, fullPage: true, caret: "initial" });
  mobileNoErrors();

  await install(mobile, origin, firstYear.token);
  await mobilePage.reload({ waitUntil: "domcontentloaded" });
  await mobilePage.getByRole("heading", { name: "Your accomplishments will appear here." }).waitFor();
  assert.equal(await mobilePage.getByText("20 accomplishments").count(), 0, "Prior account accomplishments must not survive an account switch.");
  await mobile.close();

  const reflow = await chromiumBrowser.newContext({ viewport: { width: 640, height: 900 }, reducedMotion: "reduce" });
  await install(reflow, origin, senior.token);
  const reflowPage = await reflow.newPage();
  await reflowPage.goto(`${origin}/accomplishments`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await reflowPage.getByText("20 accomplishments").waitFor();
  await assertNoOverflow(reflowPage, "200% reflow-equivalent accomplishment record");
  await reflow.close();
  console.log("Accomplishments browser checks passed", { browsers: ["Chromium", "WebKit"], states: ["empty", "manual_crud", "failure_recovery", "senior_20", "dark", "account_switch"], viewports: [1440, 640, 390] });
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
  console.error("Accomplishments browser checks failed", failure);
  process.exit(1);
}
process.exit(0);
