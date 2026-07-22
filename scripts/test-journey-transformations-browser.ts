import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import next from "next";
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "playwright";
import { applyJourneyTransition } from "../data/journey-transformations";
import { opportunities } from "../data/opportunities";
import type { JourneyProgressTransition, TrackedOpportunity } from "../data/student-activity";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const opportunityId = opportunities.find((item) => item.category === "Internships")?.id ?? opportunities[0].id;

function liveValue(key: string) {
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

function createKvServer() {
  return http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const command = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown[];
    const operation = String(command[0] ?? "");
    let result: unknown = null;
    if (operation === "GET") result = liveValue(String(command[1]))?.value ?? null;
    else if (operation === "SET") {
      const key = String(command[1]);
      if (!command.includes("NX") || !liveValue(key)) {
        const expiryIndex = command.indexOf("EX");
        store.set(key, { value: command[2], expiresAt: expiryIndex >= 0 ? Date.now() + Number(command[expiryIndex + 1]) * 1000 : undefined });
        result = "OK";
      }
    } else if (operation === "DEL") result = store.delete(String(command[1])) ? 1 : 0;
    else if (operation === "EVAL") {
      const key = String(command[3]);
      const isRateLimit = String(command[1]).includes("INCR");
      if (isRateLimit) {
        const current = Number(liveValue(key)?.value ?? 0) + 1;
        store.set(key, { value: current, expiresAt: Date.now() + Number(command[4]) * 1000 });
        result = current;
      } else if (liveValue(key)?.value === command[4]) { store.delete(key); result = 1; } else result = 0;
    } else if (operation === "SMEMBERS" || operation === "LRANGE") result = [];
    else if (operation === "SADD" || operation === "LPUSH") result = 1;
    else if (operation === "LTRIM") result = "OK";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

function recordAt(status: "Saved" | "Applying") {
  let record: TrackedOpportunity = {
    id: opportunityId,
    status: "Saved",
    savedAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    version: 0,
    history: [],
  };
  if (status === "Applying") {
    for (const [index, transition] of (["choose", "start"] as JourneyProgressTransition[]).entries()) {
      record = applyJourneyTransition(record, {
        transition,
        expectedStatus: record.status,
        expectedVersion: record.version ?? 0,
        idempotencyKey: `journey:seed:${status}:${index}`,
        occurredAt: `2026-07-0${index + 2}T12:00:00.000Z`,
      }).record;
    }
  }
  return record;
}

async function seedSession(label: string, status: "Saved" | "Applying" = "Saved") {
  const { createSession, mergeAccountData, upsertUser } = await import("../lib/auth-store");
  const record = recordAt(status);
  const user = await upsertUser({ googleSub: `journey-transform-${label}`, email: `${label}@example.test`, name: `Jordan ${label}` });
  await mergeAccountData(user.id, {
    profile: {
      firstName: "Jordan",
      schoolSlug: "university-of-chicago",
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Quantitative Finance",
      interests: "Finance, Research",
      onboardingCompletedAt: "2026-07-01T12:00:00.000Z",
    },
    onboardingComplete: true,
    activity: { viewed: [], saved: [record.id], claimed: [], tracked: { [record.id]: record } },
    tracker: { [record.id]: record },
    savedOpportunities: [{ opportunityId: record.id, savedAt: record.savedAt }],
  });
  return await createSession(user);
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

async function openUpdate(page: Page) {
  const action = page.getByRole("button", { name: "Update Journey" }).first();
  await action.waitFor({ state: "visible", timeout: 12_000 });
  await action.click();
  const dialog = page.locator("dialog[data-journey-update-dialog][open]");
  await dialog.waitFor({ state: "visible" });
  return dialog;
}

async function saveUpdate(page: Page, option?: RegExp, duplicate = false) {
  const dialog = page.locator("dialog[data-journey-update-dialog][open]");
  if (option) await dialog.getByText(option).first().click();
  let requestCount = 0;
  const count = (request: { url(): string }) => { if (request.url().includes("/api/journey/transition")) requestCount += 1; };
  page.on("request", count);
  const save = dialog.getByRole("button", { name: /Save milestone|Archive opportunity/ });
  if (duplicate) await save.evaluate((element) => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
  else await save.click();
  const result = dialog.locator("[data-journey-update-confirmation]");
  await result.waitFor({ state: "visible", timeout: 12_000 });
  assert.equal(requestCount, 1, "A duplicate click must create only one server mutation.");
  page.off("request", count);
  return result;
}

async function returnToJourney(page: Page) {
  const dialog = page.locator("dialog[data-journey-update-dialog][open]");
  await dialog.getByRole("button", { name: "Return to Journey" }).click();
  await dialog.waitFor({ state: "hidden" });
}

async function completeForwardSequence(page: Page) {
  const stages = [
    /Preparing application/,
    /Application submitted/,
    /Interview received/,
    /Final round interview/,
    /Offer received/,
    /^Accepted$/,
    /Completed program/,
  ];
  for (const [index, stage] of stages.entries()) {
    await openUpdate(page);
    const result = await saveUpdate(page, stage, index === 0);
    await result.getByText(stage).first().waitFor({ state: "visible" });
    await returnToJourney(page);
  }
  await page.getByText("Completed program", { exact: true }).first().waitFor({ state: "visible" });
  await page.getByRole("heading", { name: "Your record, year by year." }).waitFor({ state: "visible" });
}

async function verifyPauseResumeClose(page: Page) {
  await openUpdate(page);
  await saveUpdate(page, /Pause this opportunity/);
  await returnToJourney(page);
  const resumeDialog = await openUpdate(page);
  await resumeDialog.getByText(/Resume at Preparing application/).waitFor({ state: "visible" });
  await saveUpdate(page, /Resume at Preparing application/);
  await returnToJourney(page);
  await openUpdate(page);
  const result = await saveUpdate(page, /^Archived$/);
  await result.getByText(/Archived the opportunity/).waitFor({ state: "visible" });
}

async function verifyFailures(page: Page, origin: string) {
  const stale = await page.evaluate(async () => {
    const opportunity = document.querySelector<HTMLElement>("[data-journey-update-control]")?.dataset.opportunityId;
    const response = await fetch("/api/journey/transition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: opportunity, transition: "choose", expectedStatus: "Saved", expectedVersion: 99, idempotencyKey: "journey:browser:stale" }) });
    return response.status;
  });
  assert.equal(stale, 409, "Stale browser state must receive a conflict response.");

  await page.route("**/api/journey/transition", (route) => route.abort("failed"), { times: 1 });
  const dialog = await openUpdate(page);
  await dialog.getByRole("button", { name: "Save milestone" }).click();
  await dialog.getByText(/couldn’t reach UnlockED/i).waitFor({ state: "visible" });
  assert.ok(await dialog.getByRole("button", { name: "Save milestone" }).isEnabled(), "Network failure must restore the actionable prior state.");

  await page.context().clearCookies();
  await dialog.getByRole("button", { name: "Save milestone" }).click();
  await dialog.getByText(/session ended/i).waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).origin, origin);
}

async function runBrowser(browser: Browser, origin: string, sessions: Awaited<ReturnType<typeof seedSession>>[], full: boolean) {
  const context = await browser.newContext({ viewport: full ? { width: 1440, height: 1000 } : { width: 390, height: 844 }, reducedMotion: full ? "no-preference" : "reduce" });
  await installSession(context, origin, sessions[0].token);
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.locator("[data-journey-timeline]").waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Journey transformation UI must not overflow; received ${overflow}px.`);
  if (full) {
    await completeForwardSequence(page);

    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await installSession(context, origin, sessions[1].token);
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await verifyPauseResumeClose(page);

    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await installSession(context, origin, sessions[2].token);
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await verifyFailures(page, origin);

    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await installSession(context, origin, sessions[3].token);
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.route("**/api/journey/transition", async (route) => { await new Promise((resolve) => setTimeout(resolve, 600)); await route.continue(); }, { times: 1 });
    const dialog = await openUpdate(page);
    await dialog.getByRole("button", { name: "Save milestone" }).click();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("unlocked-account-session-change", { detail: { authenticated: false, user: null, data: null } })));
    await page.waitForTimeout(900);
    assert.equal(await page.locator("dialog[data-journey-update-dialog][open]").count(), 0, "Account changes must discard stale completion UI.");
  } else {
    const action = page.getByRole("button", { name: "Update Journey" }).first();
    await action.waitFor({ state: "visible" });
    const minimum = await action.boundingBox();
    assert.ok(minimum && minimum.height >= 44, "Mobile primary actions must be at least 44px high.");
    await action.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator("dialog[data-journey-update-dialog][open]");
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("button", { name: "Save milestone" }).click();
    await dialog.locator("[data-journey-update-confirmation]").waitFor({ state: "visible", timeout: 12_000 });
    assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true, "WebKit mobile must retain reduced-motion preference.");
  }
  await context.close();
}

const root = process.cwd();
const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "journey-transform-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "journey-transform-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const sessions = [
  await seedSession("forward"),
  await seedSession("pause", "Applying"),
  await seedSession("failure"),
  await seedSession("switch"),
  await seedSession("webkit"),
];
const app = next({ dev: true, dir: root, hostname: "127.0.0.1", port: appPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
await fetch(`${origin}/api/journey/transition`, { method: "GET" });

const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
try {
  await runBrowser(chromiumBrowser, origin, sessions, true);
  await runBrowser(webkitBrowser, origin, [sessions[4]], false);
} finally {
  await chromiumBrowser.close();
  await webkitBrowser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
}

console.log("Journey transformation browser checks passed in Chromium and WebKit.");
process.exit(0);
