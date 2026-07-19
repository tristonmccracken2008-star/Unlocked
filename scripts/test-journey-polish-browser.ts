import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import next from "next";
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
type Session = { token: string };
const store = new Map<string, StoredValue>();
const outputDirectory = "/tmp/unlocked-journey-polish";
let kvDelayMs = 0;

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
    if (kvDelayMs) await new Promise((resolve) => setTimeout(resolve, kvDelayMs));
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

async function seedSession(label: string, state: "empty" | "sparse" | "populated" | "long", dark = false, appearance?: "light" | "midnight" | "system"): Promise<Session> {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const { opportunities } = await import("../data/opportunities");
  const source = opportunities.filter((item) => item.type === "Career");
  const selected = state === "long" ? source.slice(0, 12) : state === "empty" ? [] : [source[0]];
  const statuses = ["Applying", "Submitted", "Interview", "Accepted", "Completed"] as const;
  const tracker = Object.fromEntries(selected.map((opportunity, index) => {
    const day = String(index + 1).padStart(2, "0");
    return [opportunity.id, {
      id: opportunity.id,
      status: state === "sparse" ? "Saved" as const : state === "long" ? statuses[index % statuses.length] : "Applying" as const,
      savedAt: `2026-01-${day}T12:00:00.000Z`,
      updatedAt: `2026-02-${day}T12:00:00.000Z`,
      version: 0,
      history: [],
    }];
  }));
  const user = await upsertUser({ googleSub: `journey-polish-${label}`, email: `journey-polish-${label}@example.test`, name: `Jordan ${label}` });
  const now = "2026-07-16T12:00:00.000Z";
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
    activity: { viewed: selected.map((item) => item.id), saved: selected.map((item) => item.id), claimed: [], tracked: tracker },
    savedOpportunities: selected.map((item, index) => ({ opportunityId: item.id, savedAt: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z` })),
    tracker,
    preferences: { appearance: appearance ?? (dark ? "midnight" : "light"), updatedAt: now },
  });
  if (dark || appearance === "midnight" || appearance === "system") await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  return await createSession(user);
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

async function openJourney(page: Page, origin: string, expectedTheme: "light" | "midnight" = "light") {
  const started = performance.now();
  const response = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(response?.status(), 200);
  const root = page.locator("[data-journey-editorial]");
  await root.waitFor({ state: "visible" });
  await root.locator("h1").waitFor({ state: "visible" });
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, expectedTheme);
  return { root, meaningfulMs: performance.now() - started };
}

async function baseAssertions(page: Page, label: string) {
  const root = page.locator("[data-journey-editorial]");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} must not create horizontal overflow; received ${overflow}px.`);
  assert.equal(await root.locator("[data-journey-living-path]").count(), 1, `${label} must mount one concise living path.`);
  assert.equal(await root.locator("[data-journey-living-path] [data-path-position]").count(), 3, `${label} must orient the student across past, current, and next states.`);
  assert.equal(await root.locator("svg[data-open-line-renderer]").count(), 0, `${label} must not hydrate the retired decorative Open Line SVG.`);
  assert.equal(await root.locator("h1").count(), 1, `${label} must expose exactly one H1.`);
  assert.equal(await root.getAttribute("aria-labelledby"), "journey-story-title", `${label} main content must have an accessible name.`);
  assert.ok(await root.locator("section[aria-labelledby]").count() >= 2, `${label} must expose named Journey regions.`);
  const headingLevels = await root.locator("h1, h2, h3, h4, h5, h6").evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent !== null).map((node) => Number(node.tagName.slice(1))));
  assert.equal(headingLevels[0], 1, `${label} heading order must begin with H1.`);
  for (let index = 1; index < headingLevels.length; index += 1) assert.ok(headingLevels[index] - headingLevels[index - 1] <= 1, `${label} heading hierarchy cannot skip from H${headingLevels[index - 1]} to H${headingLevels[index]}.`);
  const livingPath = root.locator("[data-journey-living-path]");
  assert.equal(await livingPath.getAttribute("tabindex"), null, `${label} living path cannot enter keyboard order.`);
  assert.ok(await livingPath.getAttribute("aria-label"), `${label} living path needs an accessible text label.`);
  if (await root.locator("[data-journey-text-timeline]").count()) assert.ok(await root.locator("[data-journey-text-timeline] ol").count() >= 1, `${label} history must use ordered-list semantics.`);
  const targetSizes = await root.locator("a:visible, button:visible, summary:visible, select:visible").evaluateAll((nodes) => nodes.filter((node) => !(node as HTMLButtonElement).disabled).map((node) => {
    const bounds = (node as HTMLElement).getBoundingClientRect();
    return { name: (node.textContent ?? node.getAttribute("aria-label") ?? "control").trim().slice(0, 42), width: bounds.width, height: bounds.height };
  }));
  const undersized = targetSizes.filter((target) => target.width < 44 || target.height < 44);
  assert.deepEqual(undersized, [], `${label} controls must preserve 44px targets: ${JSON.stringify(undersized)}`);
  const h1Size = Number.parseFloat(await root.locator("h1").evaluate((node) => getComputedStyle(node).fontSize));
  const otherSizes = await root.locator("h2, h3").evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent !== null).map((node) => Number.parseFloat(getComputedStyle(node).fontSize)));
  assert.ok(otherSizes.every((size) => h1Size > size), `${label} identity must remain the dominant headline.`);
  assert.equal(await root.getByText(/Journey progress|completion percentage|Skills gained|Pathprint|branch intelligence/i).count(), 0, `${label} must not expose dashboard or implementation language.`);
  assert.ok(await root.locator("*").count() < 850, `${label} must keep the initial DOM bounded.`);
}

async function verifyPopulated(page: Page, origin: string, label: string, expectedTheme: "light" | "midnight" = "light") {
  const { root, meaningfulMs } = await openJourney(page, origin, expectedTheme);
  await baseAssertions(page, label);
  assert.ok(meaningfulMs < 2_500, `${label} warm meaningful content must appear under 2.5s; received ${meaningfulMs.toFixed(0)}ms.`);
  const state = await root.getAttribute("data-journey-state");
  assert.ok(state === "active" || state === "validated");
  await root.getByRole("heading", { level: 1 }).waitFor({ state: "visible" });
  await root.locator("#journey-next-step-title").waitFor({ state: "visible" });
  const primary = root.getByRole("button", { name: /choose this opportunity|start this application|mark as submitted|record an interview|record acceptance|complete this experience|resume this direction/i });
  await primary.waitFor({ state: "visible" });
  assert.equal(await primary.count(), 1, `${label} must expose one dominant waypoint action.`);
  const initialMoments = await root.locator("[data-journey-moment]").evaluateAll((nodes) => nodes.filter((node) => !node.closest("[data-earlier-chapters]")).length);
  assert.ok(initialMoments <= 4, `${label} must initially show at most four moments.`);
  assert.equal(await root.locator("[data-horizon-item]:visible").count(), 1, `${label} must initially show one Horizon direction.`);
  const actionBox = await primary.boundingBox();
  if ((page.viewportSize()?.width ?? 0) <= 420) assert.ok(actionBox && actionBox.y + actionBox.height < (page.viewportSize()?.height ?? 0) - 60, `${label} primary action must remain above fixed navigation: ${JSON.stringify({ actionBox, viewport: page.viewportSize() })}`);
  return { root, meaningfulMs };
}

async function screenshot(page: Page, label: string) {
  await page.screenshot({ path: path.join(outputDirectory, `${label}.png`), fullPage: true });
}

async function contextFor(browser: Browser, viewport: { width: number; height: number }, reducedMotion: "reduce" | "no-preference" = "no-preference") {
  const context = await browser.newContext({ viewport, reducedMotion, colorScheme: "light" });
  await context.addInitScript(() => {
    const metrics = { cls: 0, longTasks: 0 };
    (window as typeof window & { __journeyPerformance?: typeof metrics }).__journeyPerformance = metrics;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => { metrics.longTasks += list.getEntries().length; }).observe({ type: "longtask", buffered: true });
    } catch {
      // Older browser engines may not expose these optional performance entry types.
    }
  });
  return context;
}

const rootDirectory = process.cwd();
const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "journey-polish-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "journey-polish-browser-token";
process.env.NEXT_PUBLIC_OPEN_LINE_DIAGNOSTICS = "0";
const requestedAppPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${requestedAppPort}`;

const populatedSession = await seedSession("Populated", "long");
const darkSession = await seedSession("Dark", "long", true);
const darkSparseSession = await seedSession("DarkSparse", "sparse", true);
const darkEmptySession = await seedSession("DarkEmpty", "empty", true);
const systemSession = await seedSession("System", "long", false, "system");
const sparseSession = await seedSession("Sparse", "sparse");
const emptySession = await seedSession("Empty", "empty");
const applicationSession = await seedSession("Application", "populated");

const app = next({ dev: true, dir: rootDirectory, hostname: "127.0.0.1", port: requestedAppPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
const appPort = await listen(server, requestedAppPort);
const origin = `http://127.0.0.1:${appPort}`;
mkdirSync(outputDirectory, { recursive: true });

const performanceResults: Record<string, number> = {};
const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
try {
  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, populatedSession.token);
    const page = await context.newPage();
    await openJourney(page, origin); // Warm route compilation outside measurements.
    const result = await verifyPopulated(page, origin, "populated-desktop-light");
    performanceResults.desktopMeaningfulMs = result.meaningfulMs;
    const hydrationMetrics = await page.evaluate(() => (window as typeof window & { __journeyPerformance?: { cls: number; longTasks: number } }).__journeyPerformance ?? { cls: 0, longTasks: 0 });
    performanceResults.hydrationCls = hydrationMetrics.cls;
    assert.ok(hydrationMetrics.cls < .1, `Journey hydration must keep CLS below 0.1; received ${hydrationMetrics.cls.toFixed(3)}.`);
    await screenshot(page, "populated-desktop-light");

    const primaryAction = result.root.getByRole("button", { name: /choose this opportunity|start this application|mark as submitted|record an interview|record acceptance|complete this experience|resume this direction/i });
    await primaryAction.focus();
    assert.equal(await primaryAction.evaluate((node) => node === document.activeElement), true, "The primary Journey action must be keyboard focusable.");
    await screenshot(page, "keyboard-focus-light");

    const waypointDetail = result.root.getByText("Why this step", { exact: true });
    await result.root.locator("[data-journey-living-path]").evaluate((node) => node.setAttribute("data-performance-identity", "stable"));
    performanceResults.disclosureMs = await waypointDetail.evaluate(async (node) => {
      const started = performance.now();
      (node as HTMLElement).click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return performance.now() - started;
    });
    await result.root.locator("details").filter({ hasText: "Why this step" }).locator("p").waitFor({ state: "visible" });
    assert.ok(performanceResults.disclosureMs < 100, `Waypoint disclosure must respond under 100ms; received ${performanceResults.disclosureMs.toFixed(1)}ms.`);
    assert.equal(await result.root.locator('[data-journey-living-path][data-performance-identity="stable"]').count(), 1, "Disclosure must not replace or duplicate the living path.");
    await screenshot(page, "current-waypoint-expanded");

    const moment = result.root.locator("[data-journey-moment]:visible").last();
    await moment.locator("summary").click();
    await moment.getByText("What changed", { exact: true }).waitFor({ state: "visible" });
    await screenshot(page, "historical-moment-expanded");

    const horizon = result.root.locator("[data-journey-horizon]");
    await horizon.scrollIntoViewIfNeeded();
    await horizon.locator("[data-horizon-detail] > summary").first().click();
    await screenshot(page, "horizon-expanded");
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, darkSession.token);
    const page = await context.newPage();
    const { root } = await verifyPopulated(page, origin, "populated-desktop-dark", "midnight");
    const contrast = await page.locator("[data-journey-editorial] h1").evaluate((node) => ({ color: getComputedStyle(node).color, background: getComputedStyle(document.querySelector("[data-journey-editorial]")!).backgroundColor }));
    assert.notEqual(contrast.color, contrast.background, "Dark mode text must remain distinguishable from its canvas.");
    await screenshot(page, "populated-desktop-dark");
    await root.getByText("Why this step", { exact: true }).click();
    await screenshot(page, "current-waypoint-dark");
    const moment = root.locator("[data-journey-moment]:visible").last();
    await moment.locator("summary").click();
    await screenshot(page, "expanded-history-dark");
    const horizon = root.locator("[data-journey-horizon]");
    await horizon.scrollIntoViewIfNeeded();
    await horizon.locator("[data-horizon-detail] > summary").first().click();
    await screenshot(page, "expanded-horizon-dark");
    const primary = root.getByRole("button", { name: /choose this opportunity|start this application|mark as submitted|record an interview|record acceptance|complete this experience|resume this direction/i });
    await primary.focus();
    await screenshot(page, "focus-visible-dark");
    await context.close();
  }

  for (const scenario of [
    { label: "sparse-dark", session: darkSparseSession },
    { label: "empty-dark", session: darkEmptySession },
  ]) {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: "dark" });
    await installSession(context, origin, scenario.session.token);
    const page = await context.newPage();
    const { root } = await openJourney(page, origin, "midnight");
    await baseAssertions(page, scenario.label);
    await screenshot(page, scenario.label);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "midnight");
    await context.close();
  }

  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });
    await installSession(context, origin, darkSession.token);
    const page = await context.newPage();
    await verifyPopulated(page, origin, "populated-mobile-dark", "midnight");
    await screenshot(page, "populated-mobile-dark");
    await context.close();
  }

  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: "dark", forcedColors: "active" });
    await installSession(context, origin, darkSession.token);
    const page = await context.newPage();
    await openJourney(page, origin, "midnight");
    await screenshot(page, "forced-colors-dark");
    await context.close();
  }

  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: "dark" });
    await installSession(context, origin, systemSession.token);
    const page = await context.newPage();
    await openJourney(page, origin, "midnight");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-journey-editorial]").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "midnight", "System preference cookie and server projection must agree after preference is available.");
    await installSession(context, origin, populatedSession.token);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light", "Account switching cannot retain another account's dark theme.");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("unlocked-account-session-change", { detail: { authenticated: false, user: null, data: null } })));
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    await context.close();
  }

  for (const scenario of [
    { label: "populated-tablet", viewport: { width: 820, height: 1000 }, browser: chromiumBrowser, reduced: "reduce" as const },
    { label: "populated-mobile-390", viewport: { width: 390, height: 844 }, browser: chromiumBrowser, reduced: "no-preference" as const },
    { label: "populated-mobile-320", viewport: { width: 320, height: 780 }, browser: webkitBrowser, reduced: "reduce" as const },
  ]) {
    const context = await contextFor(scenario.browser, scenario.viewport, scenario.reduced);
    await installSession(context, origin, populatedSession.token);
    const page = await context.newPage();
    await verifyPopulated(page, origin, scenario.label);
    await page.locator("[data-journey-living-path]").waitFor({ state: "visible" });
    await screenshot(page, scenario.label);
    if (scenario.viewport.width === 390) {
      await page.evaluate(() => {
        const metrics = (window as typeof window & { __journeyPerformance?: { cls: number; longTasks: number } }).__journeyPerformance;
        if (metrics) metrics.longTasks = 0;
      });
      const scrollStarted = performance.now();
      await page.evaluate(async () => {
        const maximum = document.documentElement.scrollHeight - innerHeight;
        for (let step = 1; step <= 8; step += 1) {
          scrollTo(0, maximum * step / 8);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      });
      performanceResults.mobileScrollMs = performance.now() - scrollStarted;
      const longTasks = await page.evaluate(() => (window as typeof window & { __journeyPerformance?: { longTasks: number } }).__journeyPerformance?.longTasks ?? 0);
      performanceResults.mobileScrollLongTasks = longTasks;
      assert.equal(longTasks, 0, "Journey mobile scrolling cannot create a main-thread task over 50ms.");
    }
    if (scenario.viewport.width === 820) await screenshot(page, "zoom-equivalent-200-percent");
    if (scenario.viewport.width === 320) await screenshot(page, "zoom-equivalent-400-percent");
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, sparseSession.token);
    const page = await context.newPage();
    const { root } = await openJourney(page, origin);
    await baseAssertions(page, "sparse-journey");
    assert.equal(await root.getAttribute("data-journey-state"), "sparse");
    assert.equal(await root.locator("#journey-history-title").count(), 0, "Sparse Journey must not render an empty history chapter.");
    assert.equal(await root.locator("[data-horizon-item]:visible").count(), 1);
    await screenshot(page, "sparse-journey");
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, emptySession.token);
    const page = await context.newPage();
    const { root } = await openJourney(page, origin);
    await baseAssertions(page, "empty-journey");
    assert.equal(await root.getAttribute("data-journey-state"), "empty");
    await root.getByRole("heading", { name: "Every path begins with one meaningful choice." }).waitFor({ state: "visible" });
    await root.getByRole("link", { name: "Find my first opportunity" }).waitFor({ state: "visible" });
    assert.equal(await root.locator("#journey-history-title").count(), 0);
    assert.equal(await root.locator("[data-journey-horizon]").count(), 0);
    await screenshot(page, "empty-journey");
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1100, height: 850 });
    await installSession(context, origin, applicationSession.token);
    const page = await context.newPage();
    const { root } = await verifyPopulated(page, origin, "application-management");
    const manage = root.getByText("Manage applications", { exact: true }).first();
    await manage.click();
    await root.getByRole("link", { name: "Open application management" }).waitFor({ state: "visible" });
    await screenshot(page, "application-management");

    await page.route("**/api/journey/transition", (route) => route.abort("failed"));
    const primary = root.getByRole("button", { name: /mark as submitted/i });
    const clickStart = performance.now();
    await primary.click();
    await root.getByText("Saving…", { exact: true }).waitFor({ state: "visible" });
    performanceResults.clickFeedbackMs = performance.now() - clickStart;
    assert.ok(performanceResults.clickFeedbackMs < 100, `Click feedback must appear under 100ms; received ${performanceResults.clickFeedbackMs.toFixed(1)}ms.`);
    await root.getByRole("alert").waitFor({ state: "visible" });
    assert.match(await root.getByRole("alert").innerText(), /couldn’t reach UnlockED/i);
    await context.close();
  }

  {
    const context = await contextFor(chromiumBrowser, { width: 1440, height: 1000 });
    await installSession(context, origin, populatedSession.token);
    const page = await context.newPage();
    kvDelayMs = 650;
    const navigation = page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const loading = page.locator('[aria-label="Preparing your Journey"]');
    await loading.waitFor({ state: "visible", timeout: 10_000 });
    await screenshot(page, "loading-state");
    kvDelayMs = 0;
    await navigation;
    await context.close();
  }
} finally {
  kvDelayMs = 0;
  await chromiumBrowser.close();
  await webkitBrowser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
}

console.log(JSON.stringify({ message: "Journey polish browser checks passed in Chromium and WebKit.", screenshots: outputDirectory, performance: Object.fromEntries(Object.entries(performanceResults).map(([key, value]) => [key, Number(value.toFixed(1))])) }, null, 2));
process.exit(0);
