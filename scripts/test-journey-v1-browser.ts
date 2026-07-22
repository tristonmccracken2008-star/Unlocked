import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import next from "next";
import { chromium, webkit, type Browser, type BrowserContext, type Locator, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const outputDirectory = "/tmp/unlocked-journey-v1";

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

async function seedSession(label: string, state: "empty" | "sparse" | "rich" | "heavy", dark = false) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const { opportunities } = await import("../data/opportunities");
  const selected = state === "empty" ? [] : state === "sparse" ? opportunities.slice(0, 1) : state === "heavy" ? opportunities.slice(0, 300) : ["Career", "Research", "Scholarship", "Benefit", "AI"].flatMap((type) => opportunities.filter((item) => item.type === type).slice(0, 2));
  const statuses = ["Saved", "Interested", "Applying", "Submitted", "Interview", "Accepted", "Completed", "Paused", "Rejected", "Submitted"] as const;
  const tracker = Object.fromEntries(selected.map((opportunity, index) => {
    const day = String((index % 28) + 1).padStart(2, "0");
    return [opportunity.id, {
      id: opportunity.id,
      status: state === "sparse" ? "Saved" as const : statuses[index % statuses.length],
      savedAt: `2026-01-${day}T12:00:00.000Z`,
      updatedAt: `2026-02-${day}T12:00:00.000Z`,
      version: 0,
      history: [],
    }];
  }));
  const user = await upsertUser({ googleSub: `journey-v1-${label}`, email: `journey-v1-${label}@example.test`, name: `Jordan ${label}` });
  const now = "2026-07-16T12:00:00.000Z";
  await mergeAccountData(user.id, {
    profile: { firstName: "Jordan", lastName: label, schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2030", year: "First year", careerGoal: "Quantitative Finance", interests: "Finance, Research", onboardingCompletedAt: now },
    onboardingComplete: true,
    activity: { viewed: selected.map((item) => item.id), saved: selected.map((item) => item.id), claimed: [], tracked: tracker },
    savedOpportunities: selected.map((item, index) => ({ opportunityId: item.id, savedAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z` })),
    tracker,
    preferences: { appearance: dark ? "midnight" : "light", updatedAt: now },
    journeyProgress: state === "rich" || state === "heavy" ? { "milestone-first-application": true } : {},
  });
  if (dark) await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  return await createSession(user);
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (request.resourceType() === "image" && new URL(request.url()).origin !== origin) {
      await route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>' });
      return;
    }
    await route.continue();
  });
}

function watchConsole(page: Page, label: string) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], `${label} emitted browser errors: ${errors.join(" | ")}`);
}

async function assertBase(page: Page, label: string) {
  const root = page.locator("[data-journey-timeline]");
  await root.waitFor({ state: "visible", timeout: 45_000 });
  assert.equal(await root.locator("h1").count(), 1);
  assert.equal((await root.locator("h1").textContent())?.trim(), "Journey");
  assert.equal(await root.getByText("A timeline of the opportunities and milestones that have shaped your progress.", { exact: true }).count(), 1);
  assert.equal(await root.getByText(/next step|horizon|roadmap|recommendation/i).count(), 0, `${label} must not expose coaching language.`);
  assert.equal(await root.locator("[data-journey-editorial], [data-journey-board]").count(), 0, `${label} cannot mount a competing Journey product.`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} created ${overflow}px horizontal overflow.`);
  const controls = await root.locator("a:visible, button:visible, summary:visible").evaluateAll((nodes) => nodes.map((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();
    return { label: (node.textContent ?? node.getAttribute("aria-label") ?? "control").trim(), width: rect.width, height: rect.height };
  }));
  assert.deepEqual(controls.filter((control) => control.width < 44 || control.height < 44), [], `${label} has undersized controls.`);
  return root;
}

async function assertRich(page: Page, origin: string, label: string, minimumEvents = 10) {
  const response = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(response?.status(), 200);
  const root = await assertBase(page, label);
  const events = root.locator("ol[aria-label='Journey events in chronological order'] > li");
  assert.ok(await events.count() >= minimumEvents, `${label} should show the expected history.`);
  const dates = await events.locator("time").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime") ?? ""));
  assert.deepEqual(dates, [...dates].sort(), `${label} events must be chronological.`);
  assert.equal(await root.getByText("Rejected", { exact: true }).count(), 0, `${label} must present ended opportunities as closed.`);
  assert.equal(await root.getByRole("button", { name: "Create a Journey Card" }).count(), 1);
  return root;
}

async function assertCard(page: Page, root: Locator, label: string) {
  const trigger = root.getByRole("button", { name: "Create a Journey Card" });
  await trigger.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector('[data-hydration-ready="true"]'));
  if (label.startsWith("WebKit")) await trigger.press("Enter");
  else await trigger.click();
  const dialog = page.locator('dialog[aria-labelledby="journey-card-title"]');
  const loadError = root.locator("#journey-card-load-error");
  try {
    await page.waitForFunction(() => {
      const target = document.querySelector<HTMLDialogElement>('dialog[aria-labelledby="journey-card-title"]');
      const error = document.querySelector("#journey-card-load-error");
      return Boolean(target?.open || error);
    }, undefined, { timeout: 12_000 });
  } catch {
    throw new Error(`${label} Journey Card did not settle: ${JSON.stringify({ triggerText: await trigger.textContent(), disabled: await trigger.isDisabled(), hydrationReady: await trigger.getAttribute("data-hydration-ready"), dialogCount: await dialog.count(), dialogOpen: await dialog.count() ? await dialog.getAttribute("open") : null, loadError: await loadError.textContent().catch(() => null) })}`);
  }
  if (await loadError.count()) throw new Error(`${label} Journey Card failed to load: ${await loadError.textContent()}`);
  await dialog.waitFor({ state: "visible" });
  const artwork = dialog.locator("svg[data-journey-card-artwork]");
  assert.equal(await artwork.getAttribute("width"), "1080");
  assert.equal(await artwork.getAttribute("height"), "1920");
  assert.equal(await artwork.getAttribute("data-journey-card-layout"), "story");
  assert.equal(await artwork.locator("[data-unlocked-brand-mark]").count(), 1, `${label} export must use the canonical UnlockED mark.`);
  await dialog.screenshot({ path: path.join(outputDirectory, `${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-journey-card.png`) });
  await dialog.getByRole("button", { name: "Square" }).click();
  assert.equal(await artwork.getAttribute("width"), "1080");
  assert.equal(await artwork.getAttribute("height"), "1080");
  await dialog.getByRole("button", { name: "LinkedIn" }).click();
  assert.equal(await artwork.getAttribute("width"), "1200");
  assert.equal(await artwork.getAttribute("height"), "627");
  await dialog.getByRole("button", { name: "Forest" }).click();
  assert.equal(await artwork.getAttribute("data-export-theme"), "dark");
  await dialog.getByRole("button", { name: "Anonymous" }).click();
  assert.match(await dialog.locator("[role='img']").getAttribute("aria-label") ?? "", /Anonymous/);
  await dialog.getByRole("button", { name: "Story" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download PNG" }).click(),
  ]);
  assert.equal(download.suggestedFilename(), "unlocked-journey-card-story.png");
  if (await dialog.getByRole("button", { name: "Copy image" }).count()) {
    await dialog.getByRole("button", { name: "Copy image" }).click();
    await dialog.getByText(/Journey Card copied as an image|This browser could not copy the image/).waitFor({ state: "visible" });
  }
  await dialog.getByRole("button", { name: "Close Journey Card creator" }).click();
  assert.equal(await root.getByRole("button", { name: "Create a Journey Card" }).evaluate((node) => document.activeElement === node), true);
}

async function mockCheckout(context: BrowserContext, expectedPlan: "pro_monthly" | "pro_annual", response: { status?: number; body: Record<string, string> }) {
  let requestCount = 0;
  await context.route("**/api/billing/checkout", async (route) => {
    requestCount += 1;
    const body = JSON.parse(route.request().postData() ?? "{}") as { planId?: string };
    assert.equal(body.planId, expectedPlan);
    await route.fulfill({ status: response.status ?? 200, contentType: "application/json", body: JSON.stringify(response.body) });
  });
  await context.route("https://checkout.stripe.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Stripe Checkout</title><h1>Secure checkout</h1>" }));
  return () => requestCount;
}

async function assertPricingCheckout(browser: Browser, session: { token: string }, plan: "pro_monthly" | "pro_annual", viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  await installSession(context, origin, session.token);
  const requestCount = await mockCheckout(context, plan, { body: { url: `https://checkout.stripe.com/c/pay/cs_test_${plan}` } });
  const page = await context.newPage();
  const assertNoErrors = watchConsole(page, `${browser.browserType().name()} ${plan} checkout`);
  const sessionReady = page.waitForResponse((response) => response.url().includes("/api/auth/session") && response.status() === 200);
  await page.goto(`${origin}/pricing`, { waitUntil: "domcontentloaded" });
  await sessionReady;
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: plan === "pro_monthly" ? "Upgrade to Monthly" : "Upgrade to Annual" }).click();
  await page.waitForURL(`https://checkout.stripe.com/c/pay/cs_test_${plan}`);
  assert.equal(requestCount(), 1, `${plan} must issue one checkout request.`);
  assertNoErrors();
  await context.close();
}

const rootDirectory = process.cwd();
const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "journey-v1-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "journey-v1-browser-token";
process.env.STRIPE_SECRET_KEY = "sk_test_browser_checkout";
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_browser_checkout";
process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_browser_monthly";
process.env.STRIPE_PRO_ANNUAL_PRICE_ID = "price_browser_annual";
const requestedAppPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${requestedAppPort}`;

const richSession = await seedSession("Rich", "rich");
const heavySession = await seedSession("Heavy", "heavy");
const sparseSession = await seedSession("Sparse", "sparse");
const emptySession = await seedSession("Empty", "empty");
const darkSession = await seedSession("Dark", "rich", true);
const app = next({ dev: true, dir: rootDirectory, hostname: "127.0.0.1", port: requestedAppPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
const appPort = await listen(server, requestedAppPort);
const origin = `http://127.0.0.1:${appPort}`;
mkdirSync(outputDirectory, { recursive: true });

const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
try {
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
    await installSession(context, origin, richSession.token);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    const page = await context.newPage();
    const assertNoErrors = watchConsole(page, "Chromium desktop");
    const root = await assertRich(page, origin, "Chromium desktop");
    assert.ok(await root.locator("[data-journey-summary] dd").count() > 0, "A populated Journey must show factual non-zero summary metrics.");
    assert.ok(await root.locator("[data-journey-highlights] li").count() > 0, "A rich Journey must surface recorded highlights.");
    const applicationsFilter = root.getByRole("button", { name: /^Applications/ });
    await applicationsFilter.click();
    assert.equal(await root.getAttribute("data-active-filter"), "applications");
    const visibleFilters = await root.locator("ol[aria-label='Journey events in chronological order'] > li:visible").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-event-filters") ?? ""));
    assert.ok(visibleFilters.length > 0 && visibleFilters.every((value) => value.split(" ").includes("applications")), "Applications filter must only expose matching recorded events.");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector('[data-journey-timeline-tools][data-hydration-ready="true"]'));
    assert.equal(await root.getByRole("button", { name: /^Applications/ }).getAttribute("aria-pressed"), "true", "Journey must restore the last selected filter.");
    await root.getByRole("button", { name: /^Everything/ }).click();
    await assertCard(page, root, "Chromium desktop");
    const legacy = await page.goto(`${origin}/my-opportunities`, { waitUntil: "domcontentloaded" });
    assert.equal(legacy?.status(), 200);
    await page.locator("[data-journey-timeline]").waitFor({ state: "visible" });
    assert.equal(new URL(page.url()).pathname, "/", "Legacy Journey board route must resolve to the unified Journey.");
    await page.screenshot({ path: path.join(outputDirectory, "journey-desktop.png"), fullPage: true });
    assertNoErrors();
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 820, height: 1180 } });
    await installSession(context, origin, heavySession.token);
    const page = await context.newPage();
    const assertNoErrors = watchConsole(page, "Chromium tablet heavy history");
    const root = await assertRich(page, origin, "Chromium tablet heavy history", 500);
    const moments = root.locator("ol[aria-label='Journey events in chronological order'] > li");
    const visibleMoments = root.locator("ol[aria-label='Journey events in chronological order'] > li:visible");
    assert.ok(await moments.count() >= 500, "Heavy history must preserve 500+ canonical events in the DOM.");
    assert.ok(await visibleMoments.count() <= 18, "Heavy history must initially disclose no more than 18 recent moments.");
    await root.getByRole("button", { name: /See earlier chapters/ }).click();
    assert.equal(await root.getAttribute("data-timeline-expanded"), "true");
    assert.ok(await visibleMoments.count() > 18, "Earlier chapters must expand without a route change.");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `Heavy tablet history created ${overflow}px horizontal overflow.`);
    assertNoErrors();
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await installSession(context, origin, sparseSession.token);
    const page = await context.newPage();
    const assertNoErrors = watchConsole(page, "Chromium mobile reduced motion");
    const root = await assertRich(page, origin, "Chromium mobile reduced motion", 1);
    assert.equal(await root.locator('ol[aria-label="Journey events in chronological order"] > li').count(), 1);
    await page.screenshot({ path: path.join(outputDirectory, "journey-mobile.png"), fullPage: true });
    assertNoErrors();
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 390, height: 844 } });
    await installSession(context, origin, emptySession.token);
    const page = await context.newPage();
    const assertNoErrors = watchConsole(page, "Chromium empty");
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    const root = await assertBase(page, "Chromium empty");
    assert.equal(await root.getByRole("heading", { name: "Your Journey starts here" }).count(), 1);
    assert.equal(await root.getByRole("link", { name: /Browse Discover/ }).count(), 1);
    assert.equal(await root.locator("ol").count(), 0);
    assertNoErrors();
    await context.close();
  }
  {
    const context = await webkitBrowser.newContext({ viewport: { width: 1280, height: 900 } });
    await installSession(context, origin, darkSession.token);
    const page = await context.newPage();
    const assertNoErrors = watchConsole(page, "WebKit dark");
    const root = await assertRich(page, origin, "WebKit dark");
    assert.equal(await root.getAttribute("data-theme"), "dark");
    await assertCard(page, root, "WebKit dark");
    assertNoErrors();
    await context.close();
  }
  await assertPricingCheckout(chromiumBrowser, richSession, "pro_monthly");
  await assertPricingCheckout(webkitBrowser, richSession, "pro_annual", { width: 390, height: 844 });
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const sessionReady = page.waitForResponse((response) => response.url().includes("/api/auth/session") && response.status() === 200);
    await page.goto(`${origin}/pricing`, { waitUntil: "domcontentloaded" });
    await sessionReady;
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Upgrade to Monthly" }).click();
    await page.getByText("Sign in to upgrade to UnlockED Pro.", { exact: true }).waitFor({ state: "visible" });
    assert.equal(new URL(page.url()).pathname, "/pricing");
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 900 } });
    await installSession(context, origin, richSession.token);
    await mockCheckout(context, "pro_monthly", { body: { url: "https://example.test/not-stripe" } });
    const page = await context.newPage();
    const sessionReady = page.waitForResponse((response) => response.url().includes("/api/auth/session") && response.status() === 200);
    await page.goto(`${origin}/pricing`, { waitUntil: "domcontentloaded" });
    await sessionReady;
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Upgrade to Monthly" }).click();
    await page.getByText("We couldn’t start checkout. Please try again.", { exact: true }).waitFor({ state: "visible" });
    assert.equal(new URL(page.url()).pathname, "/pricing");
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 900 } });
    await installSession(context, origin, richSession.token);
    await mockCheckout(context, "pro_annual", { status: 502, body: { error: "We couldn’t start checkout. Please try again.", code: "checkout_failed" } });
    const page = await context.newPage();
    const billingReady = page.waitForResponse((response) => response.url().includes("/api/billing/config") && response.status() === 200);
    await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
    await billingReady;
    await page.getByRole("button", { name: "Upgrade Annual" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Upgrade Annual" }).click();
    await page.getByText("We couldn’t start checkout. Please try again.", { exact: true }).waitFor({ state: "visible" });
    await context.close();
  }
} finally {
  await chromiumBrowser.close();
  await webkitBrowser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
}

console.log(JSON.stringify({
  message: "Journey V1 browser checks passed.",
  browsers: ["Chromium", "WebKit"],
  viewports: ["1440x1000", "1280x900", "820x1180", "390x844"],
  states: ["empty", "sparse", "rich", "heavy", "dark", "reduced-motion", "signed-out-checkout", "monthly-checkout", "annual-checkout", "malformed-checkout", "checkout-api-failure"],
  screenshots: outputDirectory,
}, null, 2));
process.exit(0);
