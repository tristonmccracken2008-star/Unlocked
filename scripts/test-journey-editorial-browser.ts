import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import next from "next";
import { chromium, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const outputDirectory = "/tmp/unlocked-journey-editorial";

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
      if (liveValue(key)?.value === command[4]) { store.delete(key); result = 1; } else result = 0;
    } else if (operation === "SMEMBERS" || operation === "LRANGE") result = [];
    else if (operation === "SADD" || operation === "LPUSH") result = 1;
    else if (operation === "LTRIM") result = "OK";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function seedSession(label: string, populated: boolean, dark = false, longHistory = false) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const { opportunities } = await import("../data/opportunities");
  const selectedOpportunities = longHistory ? opportunities.slice(0, 8) : [opportunities[0]];
  const opportunity = selectedOpportunities[0];
  const now = "2026-07-14T12:00:00.000Z";
  const longStatuses = ["Applying", "Submitted", "Interview", "Accepted", "Completed"] as const;
  const tracker = populated ? Object.fromEntries(selectedOpportunities.map((item, index) => {
    const day = String(index + 1).padStart(2, "0");
    return [item.id, {
      id: item.id,
      status: longHistory ? longStatuses[index % longStatuses.length] : "Applying" as const,
      savedAt: longHistory ? `2026-01-${day}T12:00:00.000Z` : now,
      updatedAt: longHistory ? `2026-02-${day}T12:00:00.000Z` : now,
    }];
  })) : {};
  const user = await upsertUser({ googleSub: `journey-${label}`, email: `journey-${label}@example.test`, name: `Jordan ${label}` });
  await mergeAccountData(user.id, {
    profile: {
      firstName: "Jordan",
      lastName: label,
      schoolSlug: "university-of-chicago",
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Quantitative Finance",
      interests: "Finance, Research",
      onboardingCompletedAt: now,
    },
    onboardingComplete: true,
    activity: populated ? { viewed: [opportunity.id], saved: selectedOpportunities.map((item) => item.id), claimed: [], tracked: tracker } : { viewed: [], saved: [], claimed: [], tracked: {} },
    savedOpportunities: populated ? selectedOpportunities.map((item, index) => ({ opportunityId: item.id, savedAt: longHistory ? `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z` : now })) : [],
    tracker,
    preferences: { appearance: dark ? "midnight" : "light", updatedAt: now },
  });
  if (dark) await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  return await createSession(user);
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

async function verifyPage(page: Page, origin: string, label: string, expectedTheme: "light" | "midnight" = "light") {
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const root = page.locator("[data-journey-editorial]");
  await root.waitFor({ state: "visible" });
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, expectedTheme);
  const state = await root.getAttribute("data-journey-state");
  const story = root.locator("h1");
  await story.waitFor({ state: "visible" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} must not create horizontal overflow; received ${overflow}px.`);
  const storySize = Number.parseFloat(await story.evaluate((element) => getComputedStyle(element).fontSize));
  const otherHeadingSizes = await root.locator("h2, h3").evaluateAll((elements) => elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)));
  assert.ok(otherHeadingSizes.every((size) => storySize > size), `${label} story must remain the largest text.`);

  if (state === "populated") {
    const waypoint = root.locator("#journey-waypoint-title");
    const action = root.getByRole("link", { name: /Open opportunity|Explore ways to start/ });
    await waypoint.waitFor({ state: "visible" });
    await action.waitFor({ state: "visible" });
    const waypointBox = await waypoint.boundingBox();
    const actionBox = await action.boundingBox();
    const minimumWaypointLeft = (page.viewportSize()?.width ?? 0) < 680 ? 70 : 0;
    assert.ok(waypointBox && waypointBox.x >= minimumWaypointLeft, `${label} waypoint must clear the mobile rail.`);
    if ((page.viewportSize()?.width ?? 0) < 680) assert.ok(actionBox && actionBox.y + actionBox.height < (page.viewportSize()?.height ?? 0) - 64, `${label} primary action must remain above the mobile navigation.`);

    const moment = root.locator("[data-journey-moment]").last();
    await moment.waitFor({ state: "visible" });
    const summary = moment.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    assert.equal(await moment.getAttribute("open"), "", `${label} Journey moment must expand from the keyboard.`);
    await moment.getByText("Why it mattered", { exact: true }).waitFor({ state: "visible" });
    await page.keyboard.press("Enter");
    assert.equal(await moment.getAttribute("open"), null, `${label} Journey moment must collapse from the keyboard.`);

    const earlier = root.locator("[data-earlier-chapters]");
    if (await earlier.count()) {
      const earlierSummary = earlier.locator(":scope > summary");
      await earlierSummary.scrollIntoViewIfNeeded();
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await earlierSummary.click();
      assert.equal(await earlier.getAttribute("open"), "", `${label} earlier chapters must expand inline.`);
      assert.equal(await page.evaluate(() => window.scrollY), scrollBefore, `${label} expanding earlier chapters must preserve scroll position.`);
      await earlierSummary.click();
      assert.equal(await earlier.getAttribute("open"), null, `${label} earlier chapters must collapse inline.`);
    }
  } else {
    await root.getByRole("link", { name: "Find my first opportunity" }).waitFor({ state: "visible" });
    await root.getByText("Choose one opportunity worth pursuing.").waitFor({ state: "visible" });
  }
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: path.join(outputDirectory, `${label}.png`), fullPage: true });
}

const root = process.cwd();
const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "journey-editorial-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "journey-editorial-browser-token";
process.env.NEXT_PUBLIC_OPEN_LINE_DIAGNOSTICS = "0";
const requestedAppPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${requestedAppPort}`;
const populatedSession = await seedSession("Populated", true);
const emptySession = await seedSession("Empty", false);
const darkSession = await seedSession("Dark", true, true);
const longHistorySession = await seedSession("LongHistory", true, false, true);

const app = next({ dev: true, dir: root, hostname: "127.0.0.1", port: requestedAppPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
const appPort = await listen(server, requestedAppPort);
const origin = `http://127.0.0.1:${appPort}`;
mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const scenario of [
    { label: "desktop-populated", viewport: { width: 1440, height: 1000 }, session: populatedSession, theme: "light" as const },
    { label: "desktop-long-history", viewport: { width: 1440, height: 1000 }, session: longHistorySession, theme: "light" as const },
    { label: "tablet-populated", viewport: { width: 900, height: 1000 }, session: populatedSession, theme: "light" as const },
    { label: "mobile-populated", viewport: { width: 390, height: 844 }, session: populatedSession, theme: "light" as const },
    { label: "desktop-empty", viewport: { width: 1440, height: 1000 }, session: emptySession, theme: "light" as const },
    { label: "desktop-dark", viewport: { width: 1440, height: 1000 }, session: darkSession, theme: "midnight" as const },
  ]) {
    const context = await browser.newContext({ viewport: scenario.viewport, reducedMotion: scenario.label === "tablet-populated" ? "reduce" : "no-preference" });
    await installSession(context, origin, scenario.session.token);
    const page = await context.newPage();
    await verifyPage(page, origin, scenario.label, scenario.theme);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
}

console.log(`Journey editorial browser checks passed. Screenshots: ${outputDirectory}`);
process.exit(0);
