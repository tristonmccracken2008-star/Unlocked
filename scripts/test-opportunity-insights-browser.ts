import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { mkdir } from "node:fs/promises";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";

type Stored = { value: unknown; expiresAt?: number };
const store = new Map<string, Stored>();
const output = "/tmp/unlocked-opportunity-insights";
const live = (key: string) => { const item = store.get(key); if (item?.expiresAt && item.expiresAt <= Date.now()) { store.delete(key); return undefined; } return item; };
async function listen(server: net.Server, port = 0) { await new Promise<void>((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve)); return (server.address() as net.AddressInfo).port; }
async function freePort() { const server = net.createServer(); const port = await listen(server); await new Promise<void>((resolve) => server.close(() => resolve())); return port; }
function kvServer() { return http.createServer(async (request, response) => {
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const command = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown[];
  const [operation, rawKey, ...rest] = command; const key = String(rawKey); let result: unknown = null;
  if (operation === "GET") result = live(key)?.value ?? null;
  else if (operation === "SET") { if (!rest.includes("NX") || !live(key)) { const expiry = rest.indexOf("EX"); store.set(key, { value: rest[0], expiresAt: expiry >= 0 ? Date.now() + Number(rest[expiry + 1]) * 1_000 : undefined }); result = "OK"; } }
  else if (operation === "DEL") result = store.delete(key) ? 1 : 0;
  else if (operation === "EVAL") { const lockKey = String(command[3]); if (String(command[1]).includes("INCR")) { const current = Number(live(lockKey)?.value ?? 0) + 1; store.set(lockKey, { value: current, expiresAt: Date.now() + Number(command[4]) * 1_000 }); result = current; } else if (live(lockKey)?.value === command[4]) { store.delete(lockKey); result = 1; } }
  else if (["PFADD", "HINCRBY", "ZINCRBY", "EXPIRE", "ZADD", "SADD", "LPUSH", "LTRIM"].includes(String(operation))) result = 1;
  else if (["ZRANGEBYSCORE", "ZREVRANGE", "SMEMBERS", "LRANGE"].includes(String(operation))) result = [];
  response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ result }));
}); }
async function install(context: BrowserContext, origin: string, token: string) { await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]); await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ status: 204, body: "" })); }
function observe(page: Page) { const errors: string[] = []; page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("_vercel")) errors.push(message.text()); }); page.on("pageerror", (error) => errors.push(error.message)); return () => assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`); }
async function noOverflow(page: Page, label: string) { const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(overflow <= 1, `${label} has ${overflow}px horizontal overflow.`); }

await mkdir(output, { recursive: true });
const kv = kvServer(); const kvPort = await listen(kv);
process.env.AUTH_SECRET = "opportunity-insights-browser-secret-with-sufficient-length";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`; process.env.KV_REST_API_TOKEN = "insights-browser-token";
const appPort = await freePort(); process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const { opportunities } = await import("../data/opportunities");
const { createSession, mergeAccountData, upsertUser } = await import("../lib/auth-store");
const selected = opportunities.filter((item) => ["Career", "Research", "Scholarship"].includes(item.type)).slice(0, 12);
assert.equal(selected.length, 12);
const now = "2026-08-24T12:00:00.000Z";
async function seed(label: string, rich: boolean) {
  const user = await upsertUser({ googleSub: `insights-browser-${label}`, email: `${label}@example.test`, name: `${label} Student` });
  const records = rich ? selected.map((item, index) => { const year = 2023 + index % 4; const savedAt = `${year}-0${index % 8 + 1}-02T12:00:00.000Z`; const submitted = index < 8; const accepted = index >= 4 && index < 6; const rejected = index >= 6 && index < 8; const history = submitted ? [{ id: `submit-${index}`, transition: "submit" as const, priorStatus: "Applying" as const, resultingStatus: "Submitted" as const, professionalStageId: "application_submitted", occurredAt: `${year}-0${index % 8 + 1}-10T12:00:00.000Z` }, ...(accepted ? [{ id: `accept-${index}`, transition: "accept" as const, priorStatus: "Submitted" as const, resultingStatus: "Accepted" as const, professionalStageId: "accepted", occurredAt: `${year}-0${index % 8 + 1}-18T12:00:00.000Z` }] : []), ...(rejected ? [{ id: `close-${index}`, transition: "close" as const, priorStatus: "Submitted" as const, resultingStatus: "Rejected" as const, professionalStageId: "not_selected", occurredAt: `${year}-0${index % 8 + 1}-20T12:00:00.000Z` }] : [])] : []; const status = accepted ? "Accepted" as const : rejected ? "Rejected" as const : submitted ? "Submitted" as const : "Saved" as const; return { id: item.id, status, professionalStageId: accepted ? "accepted" : rejected ? "not_selected" : submitted ? "application_submitted" : "saved", savedAt, updatedAt: history.at(-1)?.occurredAt ?? savedAt, version: 1, history }; }) : selected.slice(0, 1).map((item) => ({ id: item.id, status: "Saved" as const, savedAt: now, updatedAt: now, version: 1, history: [] }));
  const tracker = Object.fromEntries(records.map((record) => [record.id, record]));
  await mergeAccountData(user.id, { profile: { firstName: label, schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2028", year: "Junior", careerGoal: "Research", interests: "Research", onboardingCompletedAt: now }, onboardingComplete: true, firstLaunchComplete: true, activity: { viewed: [], saved: records.map((record) => record.id), claimed: [], tracked: tracker }, savedOpportunities: records.map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })), tracker });
  return createSession(user);
}
const richSession = await seed("Avery", true); const sparseSession = await seed("Jordan", false);
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: appPort }); await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response)); await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`; const chromiumBrowser = await chromium.launch({ headless: true }); const webkitBrowser = await webkit.launch({ headless: true });
let failure: unknown;
try {
  const signedOut = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 800 } }); const signedOutPage = await signedOut.newPage(); await signedOutPage.goto(`${origin}/insights`, { waitUntil: "domcontentloaded" }); assert.equal(new URL(signedOutPage.url()).pathname, "/"); await signedOut.close();
  const desktop = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", colorScheme: "light" }); await install(desktop, origin, richSession.token); const page = await desktop.newPage(); const noErrors = observe(page); await page.goto(`${origin}/insights`, { waitUntil: "networkidle", timeout: 60_000 }); await page.getByRole("heading", { name: "Insights", exact: true }).waitFor(); await page.getByRole("heading", { name: "Where recorded applications stand" }).waitFor(); assert.equal(await page.getByText(/acceptance rate/i).count(), 0); await noOverflow(page, "Insights 1440"); await page.screenshot({ path: `${output}/insights-rich-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 }); await noOverflow(page, "Insights 1280"); await page.screenshot({ path: `${output}/insights-rich-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 1728, height: 1117 }); await noOverflow(page, "Insights 1728"); await page.screenshot({ path: `${output}/insights-rich-1728.png`, fullPage: true });
  await page.getByRole("link", { name: "This year" }).click(); await page.waitForURL(/period=current_year/); await page.getByText("2026", { exact: true }).first().waitFor(); noErrors(); await desktop.close();
  const sparse = await chromiumBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: "dark" }); await install(sparse, origin, sparseSession.token); const sparsePage = await sparse.newPage(); await sparsePage.goto(`${origin}/insights`, { waitUntil: "networkidle", timeout: 60_000 }); await sparsePage.getByRole("heading", { name: "There is not much history to summarize yet." }).waitFor(); await noOverflow(sparsePage, "Insights mobile"); await sparsePage.screenshot({ path: `${output}/insights-sparse-mobile-dark.png`, fullPage: true }); await sparse.close();
  const zoom = await chromiumBrowser.newContext({ viewport: { width: 720, height: 900 }, reducedMotion: "reduce" }); await install(zoom, origin, richSession.token); const zoomPage = await zoom.newPage(); await zoomPage.goto(`${origin}/insights`, { waitUntil: "networkidle", timeout: 60_000 }); await noOverflow(zoomPage, "Insights 200% zoom equivalent"); await zoom.close();
  const webkitContext = await webkitBrowser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" }); await install(webkitContext, origin, richSession.token); const webkitPage = await webkitContext.newPage(); await webkitPage.goto(`${origin}/insights`, { waitUntil: "networkidle", timeout: 60_000 }); await webkitPage.getByRole("heading", { name: "Insights", exact: true }).waitFor(); await noOverflow(webkitPage, "Insights WebKit"); await webkitContext.close();
} catch (error) { failure = error; } finally { await Promise.all([chromiumBrowser.close(), webkitBrowser.close()]); server.closeAllConnections(); await Promise.race([new Promise<void>((resolve) => server.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]); await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]); kv.closeAllConnections(); await Promise.race([new Promise<void>((resolve) => kv.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]); }
if (failure) { console.error("Opportunity Insights browser checks failed", failure); process.exitCode = 1; } else console.log("Opportunity Insights browser checks passed", { chromium: true, webkit: true, desktopWidths: [1280, 1440, 1728], mobile: true, darkMode: true, reducedMotion: true, zoom200Percent: true, sparseAndRich: true });
process.exit(process.exitCode ?? 0);
