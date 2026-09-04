import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { mkdir } from "node:fs/promises";
import next from "next";
import { chromium, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const output = "/tmp/unlocked-careers";
const live = (key: string) => { const item = store.get(key); if (item?.expiresAt && item.expiresAt <= Date.now()) { store.delete(key); return undefined; } return item; };
async function listen(server: net.Server, port = 0) { await new Promise<void>((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve)); return (server.address() as net.AddressInfo).port; }
async function freePort() { const server = net.createServer(); const port = await listen(server); await new Promise<void>((resolve) => server.close(() => resolve())); return port; }
function kvServer() { return http.createServer(async (request, response) => {
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const command = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown[]; const [operation, rawKey, ...rest] = command; const key = String(rawKey); let result: unknown = null;
  if (operation === "GET") result = live(key)?.value ?? null;
  else if (operation === "SET") { if (!rest.includes("NX") || !live(key)) { const expiry = rest.indexOf("EX"); store.set(key, { value: rest[0], expiresAt: expiry >= 0 ? Date.now() + Number(rest[expiry + 1]) * 1000 : undefined }); result = "OK"; } }
  else if (operation === "DEL") result = store.delete(key) ? 1 : 0;
  else if (operation === "EVAL") { const lockKey = String(command[3]); if (String(command[1]).includes("INCR")) { const current = Number(live(lockKey)?.value ?? 0) + 1; store.set(lockKey, { value: current, expiresAt: Date.now() + Number(command[4]) * 1000 }); result = current; } else if (live(lockKey)?.value === command[4]) { store.delete(lockKey); result = 1; } }
  else if (["PFADD","HINCRBY","ZINCRBY","EXPIRE","ZADD","SADD","LPUSH","LTRIM"].includes(String(operation))) result = 1;
  else if (["ZRANGEBYSCORE","ZREVRANGE","SMEMBERS","LRANGE"].includes(String(operation))) result = [];
  response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ result }));
}); }
async function install(context: BrowserContext, origin: string, token: string) { await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now()/1000)+3600 }]); await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ status: 204, body: "" })); }
function observe(page: Page) { const errors: string[] = []; page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("_vercel")) errors.push(message.text()); }); page.on("pageerror", (error) => errors.push(error.message)); return () => assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`); }
async function noOverflow(page: Page, label: string) { const overflow = await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth); assert.ok(overflow <= 1, `${label} has ${overflow}px horizontal overflow.`); }

await mkdir(output, { recursive: true }); const kv = kvServer(); const kvPort = await listen(kv);
process.env.AUTH_SECRET = "careers-browser-secret-with-sufficient-length"; process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`; process.env.KV_REST_API_TOKEN = "careers-browser-token";
const appPort = await freePort(); process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const { createSession, mergeAccountData, upsertUser } = await import("../lib/auth-store");
const user = await upsertUser({ googleSub: "careers-browser-owner", email: "career@example.test", name: "Career Explorer" });
await mergeAccountData(user.id, { profile: { firstName: "Career", schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2029", year: "Sophomore", careerGoal: "Explore", interests: "Research", onboardingCompletedAt: "2026-09-03T12:00:00.000Z" }, onboardingComplete: true, firstLaunchComplete: true, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, savedOpportunities: [], tracker: {}, preferences: { appearance: "light", updatedAt: "2026-09-03T12:00:00.000Z" } });
const session = await createSession(user); const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: appPort }); await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response)); await listen(server, appPort); const origin = `http://127.0.0.1:${appPort}`; const browser = await chromium.launch({ headless: true }); let failure: unknown;
try {
  const signedOut = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const signedOutPage = await signedOut.newPage(); const signedOutResponse = await signedOutPage.goto(`${origin}/careers`, { waitUntil: "networkidle" }); assert.ok([200, 307, 308].includes(signedOutResponse?.status() ?? 0)); assert.equal(await signedOutPage.locator("[data-careers-explorer]").count(), 0, "Signed-out users must not receive Careers content."); await signedOut.close();
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" }); await install(desktop, origin, session.token); const page = await desktop.newPage(); const noErrors = observe(page);
  await page.goto(`${origin}/careers`, { waitUntil: "domcontentloaded", timeout: 60000 }); await page.getByRole("heading", { name: "Explore Careers" }).waitFor(); await page.getByText(/151 career paths/).waitFor(); await noOverflow(page, "Careers 1440");
  const search = page.getByRole("searchbox", { name: "Search careers" }); await page.keyboard.press("/"); assert.equal(await search.evaluate((element) => element === document.activeElement), true, "The slash shortcut must focus career search."); await search.fill("quant"); await page.getByRole("link", { name: "Quantitative Trader", exact: true }).waitFor();
  await search.fill(""); const compare = page.getByRole("button", { name: "+ Compare" }); await compare.nth(0).click(); await compare.nth(1).click(); await page.getByRole("heading", { name: "Compare tradeoffs, not winners." }).waitFor();
  await page.getByRole("link", { name: "Accountant", exact: true }).first().click(); await page.getByRole("heading", { name: "Accountant", exact: true }).waitFor(); await page.getByRole("heading", { name: "Eight lenses, with reasons" }).waitFor(); await page.getByRole("heading", { name: "Safe opportunities" }).waitFor(); assert.match((await page.getByRole("link", { name: "Find related opportunities" }).getAttribute("href")) ?? "", /^\/opportunities\?query=/); assert.ok(await page.locator('[data-career-detail="accountant"] a[href^="/careers/"]').count(), "Career details must link to related careers."); await noOverflow(page, "Career detail 1440"); await page.screenshot({ path: `${output}/accountant-1440.png`, fullPage: true }); noErrors(); await desktop.close();
  for (const width of [1728,1280,640,390]) { const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 950 }, reducedMotion: "reduce", colorScheme: width === 390 ? "dark" : "light" }); await install(context, origin, session.token); const responsive = await context.newPage(); await responsive.goto(`${origin}/careers`, { waitUntil: "domcontentloaded", timeout: 60000 }); await responsive.getByRole("heading", { name: "Explore Careers" }).waitFor(); if (width === 390) await responsive.evaluate(() => { document.documentElement.dataset.theme = "midnight"; }); await noOverflow(responsive, `Careers ${width}`); if (width === 390) await responsive.screenshot({ path: `${output}/careers-mobile-dark-390.png`, fullPage: true }); await context.close(); }
  console.log("Careers browser checks passed", { browser: "Chromium", viewports: [1728,1440,1280,640,390], states: ["signed_out", "search", "compare", "detail", "dark", "reduced_motion"] });
} catch (error) { failure = error; } finally { await browser.close(); server.closeAllConnections(); await Promise.race([new Promise<void>((resolve) => server.close(() => resolve())),new Promise<void>((resolve) => setTimeout(resolve,2000))]); await Promise.race([app.close(),new Promise<void>((resolve) => setTimeout(resolve,5000))]); kv.closeAllConnections(); await Promise.race([new Promise<void>((resolve) => kv.close(() => resolve())),new Promise<void>((resolve) => setTimeout(resolve,2000))]); }
if (failure) { console.error("Careers browser checks failed", failure); process.exit(1); }
