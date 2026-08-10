import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();

function live(key: string) {
  const item = store.get(key);
  if (item?.expiresAt && item.expiresAt <= Date.now()) { store.delete(key); return undefined; }
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
      if (live(lockKey)?.value === command[4]) { store.delete(lockKey); result = 1; } else result = 0;
    } else if (operation === "SADD") {
      const values = live(key)?.value instanceof Set ? live(key)!.value as Set<string> : new Set<string>();
      const before = values.size;
      for (const value of rest) values.add(String(value));
      store.set(key, { value: values });
      result = values.size - before;
    } else if (operation === "SMEMBERS") result = [...(live(key)?.value as Set<string> ?? [])];
    else if (["PFADD", "HINCRBY", "ZINCRBY", "EXPIRE", "ZADD"].includes(String(operation))) result = 1;
    else if (operation === "ZRANGEBYSCORE" || operation === "ZREVRANGE") result = [];
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function seed(label: string, withJourney: boolean) {
  const { opportunities } = await import("../data/opportunities");
  const { createSession, mergeAccountData, upsertUser } = await import("../lib/auth-store");
  const opportunity = opportunities.find((item) => /NASA/i.test(`${item.title} ${item.organization}`) && item.type === "Career") ?? opportunities.find((item) => /NASA/i.test(`${item.title} ${item.organization}`))!;
  const user = await upsertUser({ googleSub: `search-${label}`, email: `${label}@example.test`, name: `${label} Student` });
  const record = { id: opportunity.id, status: "Applying" as const, savedAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-09T12:00:00.000Z", version: 1, history: [{ id: `history-${label}`, transition: "start" as const, priorStatus: "Saved" as const, resultingStatus: "Applying" as const, occurredAt: "2026-08-09T12:00:00.000Z", details: { notes: `private-${label}-note`, source: "student_reported" as const } }] };
  await mergeAccountData(user.id, {
    profile: { firstName: label, schoolSlug: "university-of-chicago", major: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Software Engineering", interests: "Software, Research", onboardingCompletedAt: "2026-08-01T12:00:00.000Z" },
    onboardingComplete: true,
    firstLaunchComplete: true,
    activity: { viewed: [], saved: withJourney ? [opportunity.id] : [], claimed: [], tracked: withJourney ? { [opportunity.id]: record } : {} },
    savedOpportunities: withJourney ? [{ opportunityId: opportunity.id, savedAt: record.savedAt }] : [],
    tracker: withJourney ? { [opportunity.id]: record } : {},
    applicationWorkspaces: withJourney ? { [opportunity.id]: { opportunityId: opportunity.id, tasks: { resume: { id: "resume", title: "Update résumé", dueDate: "2026-08-18", source: "user", completed: false, createdAt: record.savedAt, updatedAt: record.updatedAt, version: 0 } }, createdAt: record.savedAt, updatedAt: record.updatedAt, version: 0 } } : {},
  });
  return { session: await createSession(user), opportunity };
}

async function install(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
}

function observe(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.includes("_vercel") && !text.includes("ERR_NAME_NOT_RESOLVED") && !text.includes("specified hostname could not be found")) errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`);
}

const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "universal-search-browser-secret-with-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "universal-search-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;

const owner = await seed("Owner", true);
const other = await seed("Other", false);
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
  const desktopReady = page.waitForResponse((response) => response.url().includes("/api/auth/session") && response.status() === 200);
  await page.goto(`${origin}/opportunities`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await desktopReady;
  const trigger = page.getByRole("button", { name: "Search UnlockED" });
  await trigger.waitFor();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search UnlockED" });
  await dialog.waitFor();
  const input = dialog.getByRole("combobox", { name: "Search UnlockED" });
  assert.equal(await input.evaluate((node) => document.activeElement === node), true, "Opening from the visible trigger must focus the search field.");
  await input.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.keyboard.press("Meta+k");
  await dialog.waitFor();
  assert.equal(await input.evaluate((node) => document.activeElement === node), true, "Opening with the shortcut must focus the search field.");
  await input.fill("NASA");
  await dialog.getByRole("group", { name: "Your Journey" }).waitFor({ timeout: 60_000 });
  await dialog.getByRole("group", { name: "Opportunities" }).waitFor();
  assert.ok(await dialog.getByText(owner.opportunity.title, { exact: true }).count() >= 1);
  const response = await page.evaluate(async () => await (await fetch("/api/search?q=NASA", { credentials: "same-origin" })).json());
  assert.doesNotMatch(JSON.stringify(response), /private-Owner-note|Owner@example\.test|Computer Science/);
  await input.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await trigger.evaluate((node) => document.activeElement === node), true, "Escape must restore focus to the visible trigger.");
  await trigger.click();
  await input.fill("zzqv92841");
  await dialog.getByText(/No results for/).waitFor({ timeout: 60_000 });
  await dialog.getByRole("link", { name: /Search all opportunities in Discover/ }).waitFor();
  await input.press("Escape");
  noDesktopErrors();
  await desktop.close();

  const isolated = await chromiumBrowser.newContext({ viewport: { width: 1024, height: 768 } });
  await install(isolated, origin, other.session.token);
  const isolatedPage = await isolated.newPage();
  const isolatedReady = isolatedPage.waitForResponse((response) => response.url().includes("/api/auth/session") && response.status() === 200);
  await isolatedPage.goto(`${origin}/opportunities`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await isolatedReady;
  await isolatedPage.getByRole("button", { name: "Search UnlockED" }).click();
  const isolatedDialog = isolatedPage.getByRole("dialog", { name: "Search UnlockED" });
  await isolatedDialog.getByRole("combobox").fill("NASA");
  await isolatedDialog.getByRole("group", { name: "Opportunities" }).waitFor({ timeout: 60_000 });
  assert.equal(await isolatedDialog.getByRole("group", { name: "Your Journey" }).count(), 0, "Another account must not see the owner's Journey group.");
  await isolated.close();

  const mobile = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await install(mobile, origin, owner.session.token);
  const mobilePage = await mobile.newPage();
  const noMobileErrors = observe(mobilePage);
  const mobileReady = mobilePage.waitForResponse((response) => response.url().includes("/api/auth/session") && response.status() === 200);
  await mobilePage.goto(`${origin}/opportunities`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await mobileReady;
  await mobilePage.getByRole("button", { name: "Search UnlockED" }).click();
  const mobileDialog = mobilePage.getByRole("dialog", { name: "Search UnlockED" });
  const box = await mobileDialog.boundingBox();
  assert.ok(box && box.width >= 389 && box.height >= 843, "Mobile Universal Search must use the available screen rather than a desktop popover.");
  assert.equal(await mobileDialog.evaluate((node) => getComputedStyle(node).animationName), "none", "Reduced motion must suppress panel motion.");
  const mobileInput = mobileDialog.getByRole("combobox");
  await mobileInput.fill("Journey Card");
  await mobileDialog.getByRole("group", { name: "Learn UnlockED" }).waitFor();
  const targets = await mobileDialog.locator("a, button").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).getBoundingClientRect().height));
  assert.ok(targets.every((height) => height >= 44), "Mobile command targets must remain at least 44px tall.");
  const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Universal Search created ${overflow}px mobile overflow.`);
  noMobileErrors();
  await mobile.close();

  console.log("Universal Search browser checks passed", { browsers: ["Chromium", "WebKit"], viewports: ["desktop", "mobile"], accountIsolation: true, keyboard: true, reducedMotion: true });
} catch (error) {
  failure = error;
} finally {
  await Promise.all([chromiumBrowser.close(), webkitBrowser.close()]);
  server.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => server.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  await new Promise<void>((resolve) => kv.close(() => resolve()));
}
if (failure) throw failure;
