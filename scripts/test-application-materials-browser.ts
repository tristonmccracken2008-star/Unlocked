import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { mkdir } from "node:fs/promises";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const output = "/tmp/unlocked-application-materials";
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
async function noOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} has ${overflow}px horizontal overflow.`);
}

await mkdir(output, { recursive: true });
const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "application-materials-browser-secret-with-sufficient-length";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "application-materials-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;

const { opportunities } = await import("../data/opportunities");
const { materialTypeForRequirement } = await import("../lib/application-materials");
const { trustedApplicationRequirements } = await import("../lib/application-workspace");
const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
const { updateApplicationMaterials } = await import("../lib/application-material-service");
const opportunity = opportunities.find((item) => trustedApplicationRequirements(item).some((requirement) => materialTypeForRequirement(requirement)))!;
assert.ok(opportunity);
const requirement = trustedApplicationRequirements(opportunity).find((item) => materialTypeForRequirement(item))!;
const materialType = materialTypeForRequirement(requirement)!;
const now = "2026-08-24T12:00:00.000Z";
async function seed(label: string, withMaterial: boolean) {
  const user = await upsertUser({ googleSub: `materials-browser-${label}`, email: `${label.toLowerCase()}@example.test`, name: `${label} Student` });
  const tracked = { id: opportunity.id, status: "Applying" as const, savedAt: now, updatedAt: now, version: 1, history: [] };
  await mergeAccountData(user.id, {
    profile: { firstName: label, schoolSlug: "university-of-chicago", major: "Computer Science", graduationYear: "2028", year: "Junior", careerGoal: "Software Engineering", interests: "Software, Research", onboardingCompletedAt: now },
    onboardingComplete: true, firstLaunchComplete: true,
    activity: { viewed: [], saved: [opportunity.id], claimed: [], tracked: { [opportunity.id]: tracked } }, savedOpportunities: [{ opportunityId: opportunity.id, savedAt: now }], tracker: { [opportunity.id]: tracked },
    preferences: { appearance: withMaterial ? "midnight" : "light", updatedAt: now },
  });
  if (withMaterial) {
    await updateAccountBilling(user.id, { tier: "pro", status: "active" });
    await updateApplicationMaterials(user, { action: "create", expectedVersion: 0, idempotencyKey: `materials:browser:${label}`, type: materialType, title: "Current Application Material", versionLabel: "2027", status: "ready", contexts: ["general"] });
  }
  return createSession(user);
}
const owner = await seed("Avery", true);
const other = await seed("Jordan", false);
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
  await signedOutPage.goto(`${origin}/materials`, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(signedOutPage.url()).pathname, "/");
  await signedOut.close();

  const desktop = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await install(desktop, origin, owner.token);
  const page = await desktop.newPage();
  const noErrors = observe(page);
  await page.goto(`${origin}/materials`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByRole("heading", { name: "Materials", exact: true }).waitFor();
  await page.getByRole("heading", { name: "What you can reuse" }).waitFor();
  await page.getByText("Current Application Material", { exact: true }).waitFor();
  assert.equal(await page.locator('input[type="file"]').count(), 0, "Metadata-only Materials must not present a fake upload control.");
  await noOverflow(page, "Materials desktop");
  await page.screenshot({ path: `${output}/materials-dark-1440.png`, fullPage: true });

  await page.setViewportSize({ width: 720, height: 900 });
  await noOverflow(page, "Materials at 200% desktop zoom equivalent");
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto(`${origin}/?q=${encodeURIComponent(opportunity.title)}#journey-record-${opportunity.id}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByRole("button", { name: `Continue application for ${opportunity.title}` }).click();
  const selector = page.getByRole("combobox", { name: new RegExp(`Choose ${applicationMaterialTypeLabel(materialType)}`, "i") });
  const selectedValue = await selector.locator("option").nth(1).getAttribute("value");
  assert.ok(selectedValue);
  await selector.selectOption(selectedValue);
  await page.getByText("Material selected for this application.", { exact: true }).waitFor();
  await page.getByText(/Selected · marked Ready by you/).waitFor();
  noErrors();

  const mobile = await chromiumBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await install(mobile, origin, owner.token);
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${origin}/materials`, { waitUntil: "networkidle", timeout: 60_000 });
  await noOverflow(mobilePage, "Materials mobile");
  await mobilePage.screenshot({ path: `${output}/materials-mobile-390.png`, fullPage: true });
  await mobile.close();

  const isolated = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 900 } });
  await install(isolated, origin, other.token);
  const isolatedPage = await isolated.newPage();
  await isolatedPage.goto(`${origin}/materials`, { waitUntil: "networkidle", timeout: 60_000 });
  await isolatedPage.getByRole("heading", { name: "Keep reusable application materials here." }).waitFor();
  assert.equal(await isolatedPage.getByText("Current Application Material", { exact: true }).count(), 0, "Material metadata must not cross accounts.");
  await isolated.close();

  const webkitContext = await webkitBrowser.newContext({ viewport: { width: 1280, height: 900 } });
  await install(webkitContext, origin, owner.token);
  const webkitPage = await webkitContext.newPage();
  await webkitPage.goto(`${origin}/materials`, { waitUntil: "networkidle", timeout: 60_000 });
  await webkitPage.getByRole("heading", { name: "Materials", exact: true }).waitFor();
  await noOverflow(webkitPage, "Materials WebKit");
  await webkitContext.close();
  await desktop.close();
} catch (error) { failure = error; }
finally {
  await Promise.all([chromiumBrowser.close(), webkitBrowser.close()]);
  server.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => server.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  kv.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => kv.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
}
if (failure) { console.error("Application Materials browser checks failed", failure); process.exitCode = 1; }
else console.log("Application Materials browser checks passed", { chromium: true, webkit: true, mobile: true, darkMode: true, reducedMotion: true, zoom200Percent: true, accountIsolation: true });
process.exit(process.exitCode ?? 0);

function applicationMaterialTypeLabel(type: typeof materialType) {
  return type.replaceAll("_", " ");
}
