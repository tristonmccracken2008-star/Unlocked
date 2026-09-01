import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page, type Request, type Route } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
type ViewportScenario = { label: string; width: number; height: number };

const store = new Map<string, StoredValue>();
const pendingAccountWrites = new WeakMap<Page, Set<Request>>();
const outputDirectory = "/tmp/unlocked-app-performance";
const testDistDirectory = ".next-app-performance-browser";

function liveValue(key: string) {
  const item = store.get(key);
  if (item?.expiresAt && item.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
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
      if (liveValue(key)?.value === command[4]) {
        store.delete(key);
        result = 1;
      } else result = 0;
    } else if (operation === "SMEMBERS" || operation === "LRANGE") result = [];
    else if (operation === "SADD" || operation === "LPUSH") result = 1;
    else if (operation === "LTRIM") result = "OK";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function seedSession() {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const now = "2026-07-18T12:00:00.000Z";
  const user = await upsertUser({ googleSub: "app-performance-browser", email: "performance@example.test", name: "Performance Student" });
  await mergeAccountData(user.id, {
    profile: {
      firstName: "Performance",
      lastName: "Student",
      schoolSlug: "university-of-chicago",
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Research",
      interests: "Statistics, Research",
      goals: ["Research"],
      topics: ["Statistics"],
      onboardingCompletedAt: now,
    },
    onboardingComplete: true,
    firstLaunchComplete: true,
    firstLaunchCompletedAt: now,
    activity: { viewed: [], saved: [], claimed: [], tracked: {} },
    savedOpportunities: [],
    tracker: {},
  });
  await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  return createSession(user);
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

async function preserveLocalHttpForProductionWebkit(context: BrowserContext, origin: string, sessionToken: string) {
  const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const secureOrigin = origin.replace(/^http:/, "https:");
  await context.route("https://logo.clearbit.com/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: transparentPixel });
  });
  await context.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/analytics/event") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, acceptedIds: [] }),
      });
      return;
    }
    if (route.request().resourceType() !== "document") {
      if (url.pathname.startsWith("/api/") && route.request().method() !== "GET") {
        const headers = await route.request().allHeaders();
        headers.origin = secureOrigin;
        headers["sec-fetch-site"] = "same-origin";
        if (headers.referer) headers.referer = headers.referer.replace(origin, secureOrigin);
        const response = await route.fetch({ headers });
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
      return;
    }
    const requestHeaders = await route.request().allHeaders();
    requestHeaders.cookie = `unlocked_session=${sessionToken}`;
    const response = await route.fetch({ headers: requestHeaders });
    const headers = response.headers();
    const policy = headers["content-security-policy"];
    if (policy) {
      headers["content-security-policy"] = policy
        .split(";")
        .map((directive) => directive.trim())
        .filter((directive) => directive !== "upgrade-insecure-requests")
        .join("; ");
    }
    delete headers["content-encoding"];
    delete headers["content-length"];
    await route.fulfill({ status: response.status(), headers, body: await response.body() });
  });
}

function observePage(page: Page) {
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  const apiResponses: string[] = [];
  const accountWrites = new Set<Request>();
  pendingAccountWrites.set(page, accountWrites);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "PUT" && url.pathname === "/api/account/data") accountWrites.add(request);
  });
  page.on("requestfinished", (request) => accountWrites.delete(request));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const detail = message.text();
    if (detail.includes("/_vercel/insights/") || detail.includes("/_vercel/speed-insights/") || detail.includes("net::ERR_NAME_NOT_RESOLVED")) return;
    const localWebkitCspNoise = process.env.UNLOCKED_TEST_PRODUCTION_WEBKIT === "1"
      && (detail === "Failed to load resource: WebKit encountered an internal error"
        || detail === "Blocked by Content Security Policy."
        || detail === "Failed to load resource: Blocked by Content Security Policy."
        || (detail.startsWith("Refused to connect to https://localhost:") && detail.includes("connect-src directive")));
    if (localWebkitCspNoise) return;
    consoleErrors.push(detail);
  });
  page.on("requestfailed", (request) => {
    accountWrites.delete(request);
    const failure = request.failure()?.errorText.toLowerCase() ?? "";
    const url = new URL(request.url());
    const expectedCancellation = failure.includes("cancel")
      && request.method() === "GET"
      && (url.pathname === "/api/opportunities" || url.pathname === "/api/notifications" || url.searchParams.has("_rsc"));
    const expectedImageCancellation = request.resourceType() === "image" && failure.includes("cancel");
    const expectedLocalWebkitRscFailure = process.env.UNLOCKED_TEST_PRODUCTION_WEBKIT === "1"
      && url.searchParams.has("_rsc")
      && (failure.includes("content security policy") || failure.includes("webkit encountered an internal error"));
    const expectedLocalWebkitNotificationTeardown = process.env.UNLOCKED_TEST_PRODUCTION_WEBKIT === "1"
      && request.method() === "GET"
      && url.pathname === "/api/notifications"
      && url.searchParams.get("view") === "count"
      && page.url() === "about:blank"
      && failure.includes("webkit encountered an internal error");
    if (failure === "net::err_aborted" || expectedCancellation || expectedImageCancellation || expectedLocalWebkitRscFailure || expectedLocalWebkitNotificationTeardown) return;
    if (request.resourceType() === "image" && new URL(request.url()).origin !== new URL(page.url()).origin) return;
    requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === new URL(page.url()).origin && url.pathname.startsWith("/api/")) {
      apiResponses.push(`${response.request().method()} ${url.pathname} ${response.status()}`);
    }
  });
  return { consoleErrors, requestFailures, apiResponses };
}

async function settleAccountWrites(page: Page) {
  if (process.env.UNLOCKED_TEST_PRODUCTION_WEBKIT !== "1") return;
  const writes = pendingAccountWrites.get(page);
  if (!writes) return;
  await page.waitForTimeout(500);
  const deadline = Date.now() + 10_000;
  while (writes.size > 0 && Date.now() < deadline) await page.waitForTimeout(25);
  assert.equal(writes.size, 0, "Authenticated account writes must settle before navigating away.");
}

async function assertStableLayout(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) {
    const offenders = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")].flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1
        ? [{ tag: element.tagName, marker: element.getAttribute("data-primary-navigation") ?? element.className?.toString().slice(0, 100), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }]
        : [];
    }).slice(0, 12));
    console.error(`${label} overflow elements`, offenders);
  }
  assert.ok(overflow <= 1, `${label} must not create horizontal overflow; received ${overflow}px.`);
}

async function assertOrganizationMarks(page: Page, label: string) {
  const marks = page.locator("[data-organization-mark]");
  const count = await marks.count();
  assert.ok(count > 0, `${label} must render organization branding.`);
  const result = await marks.evaluateAll((elements) => {
    const visible = elements.filter((element) => element.getClientRects().length > 0);
    const invalid = visible.filter((element) => {
    const rect = element.getBoundingClientRect();
    const kind = element.getAttribute("data-kind");
    return rect.width < 44 || rect.height < 44 || !["image", "monogram", "category"].includes(kind ?? "") || !element.getAttribute("aria-label");
    }).length;
    return { visible: visible.length, invalid };
  });
  assert.ok(result.visible > 0, `${label} must render visible organization branding.`);
  assert.equal(result.invalid, 0, `${label} must keep every visible organization mark stable, labeled, and non-empty.`);
}

async function verifyDiscover(page: Page, origin: string, screenshotLabel: string) {
  const startedAt = performance.now();
  let sessionRequests = 0;
  const catalogRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/auth/session") sessionRequests += 1;
    if (url.pathname === "/api/opportunities") catalogRequests.push(url.search);
  });
  const navigation = await page.goto(`${origin}/opportunities`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (process.env.UNLOCKED_TEST_PRODUCTION_WEBKIT === "1") {
    assert.equal(navigation?.headers()["content-security-policy"]?.includes("upgrade-insecure-requests"), false, "The local WebKit fixture must not upgrade its HTTP loopback connection.");
  }
  await page.getByRole("heading", { name: "Find what’s out there." }).waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Open Opportunity" }).first().waitFor({ state: "visible", timeout: 45_000 });
  await assertOrganizationMarks(page, `${screenshotLabel} Discover`);
  const coldReadyMs = Math.round(performance.now() - startedAt);
  assert.equal(catalogRequests.filter((search) => !new URLSearchParams(search).has("view")).length, 0, "Discover must never request the unbounded catalog.");
  assert.ok(catalogRequests.every((search) => new URLSearchParams(search).get("view") === "discover"), "Discover catalog requests must use the bounded projection.");
  assert.ok(sessionRequests <= 1, `Discover hydration must share one session request; received ${sessionRequests}.`);

  const cardsBefore = await page.getByRole("link", { name: "Open Opportunity" }).count();
  assert.ok(cardsBefore > 0 && cardsBefore <= 16, `Discover should render a bounded first window; received ${cardsBefore}.`);
  assert.ok(await page.getByRole("heading", { name: "Browse by what you’re looking for." }).count(), "Blank Discover must expose guided catalog exploration.");
  for (const path of ["Scholarships", "Internships", "Research", "Fellowships", "AI tools", "Student benefits"]) {
    assert.ok(await page.getByRole("button", { name: new RegExp(`^${path}`) }).count(), `Blank Discover must expose the ${path} exploration path.`);
  }

  let releaseSearch!: () => void;
  const searchRelease = new Promise<void>((resolve) => { releaseSearch = resolve; });
  let searchRequestSeen!: () => void;
  const searchRequest = new Promise<void>((resolve) => { searchRequestSeen = resolve; });
  await page.route("**/api/opportunities?*", async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("query") === "engineering") {
      searchRequestSeen();
      await searchRelease;
    }
    await route.continue();
  });
  const search = page.getByPlaceholder("Try “first-year software internship” or “Chicago scholarship”");
  await search.fill("engineering");
  await Promise.race([searchRequest, new Promise((_, reject) => setTimeout(() => reject(new Error("Discover search request did not start.")), 5000))]);
  assert.equal(await page.getByRole("link", { name: "Open Opportunity" }).count(), cardsBefore, "Discover must retain existing results while a refresh is pending.");
  const refreshStatus = page.locator("[data-filter-results] p[role='status']");
  await refreshStatus.waitFor({ state: "visible" });
  const resultRegion = page.locator("[data-filter-results]");
  assert.equal(await resultRegion.getAttribute("data-refreshing"), "true", "Discover must expose its non-blocking refresh state.");
  await page.waitForFunction(() => {
    const region = document.querySelector("[data-filter-results][data-refreshing='true']");
    return region ? Number(getComputedStyle(region).opacity) < 1 : false;
  });
  const refreshingOpacity = Number(await resultRegion.evaluate((node) => getComputedStyle(node).opacity));
  assert.ok(refreshingOpacity < 1 && refreshingOpacity >= .5, `Discover should soften retained results without hiding them; received ${refreshingOpacity}.`);
  releaseSearch();
  await refreshStatus.waitFor({ state: "hidden", timeout: 10_000 });
  await page.unroute("**/api/opportunities?*");
  assert.equal(new URL(page.url()).searchParams.get("query"), "engineering", "Discover search must synchronize with the URL.");
  await page.getByLabel("Sort").selectOption("Newest");
  assert.equal(new URL(page.url()).searchParams.get("sort"), "Newest", "Discover sorting must synchronize with the URL.");
  if (screenshotLabel === "mobile") {
    await page.getByRole("button", { name: "Filters" }).click();
    const dialog = page.getByRole("dialog", { name: "Filter opportunities" });
    await dialog.waitFor({ state: "visible" });
    assert.equal(await dialog.getAttribute("data-modal-surface"), "", "The mobile filter sheet must use the shared modal motion contract.");
    await dialog.press("Escape");
    await dialog.waitFor({ state: "hidden" });
  }
  if (screenshotLabel === "narrow-desktop") {
    const themeSaveStatus = await page.evaluate(async () => (await fetch("/api/account/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { appearance: "midnight", updatedAt: new Date().toISOString() } }),
    })).status);
    assert.equal(themeSaveStatus, 200, "The browser fixture must persist the dark-theme preference.");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Open Opportunity" }).first().waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "midnight");
    const cardTextColors = await page.locator("[data-discover-opportunity]").first().evaluate((card) => ({
      title: getComputedStyle(card.querySelector("h3 a")!).color,
      description: getComputedStyle(card.querySelector("p[class*='line-clamp']")!).color,
    }));
    assert.match(cardTextColors.title, /244,\s*247,\s*251/, "Discover card titles must use the readable dark-theme text token.");
    assert.match(cardTextColors.description, /244,\s*247,\s*251/, "Discover card descriptions must use the readable dark-theme text token.");
  }
  await assertStableLayout(page, screenshotLabel);
  await page.screenshot({ path: path.join(outputDirectory, `${screenshotLabel}-discover.png`), fullPage: true, caret: "initial" });

  const warmStartedAt = performance.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Open Opportunity" }).first().waitFor({ state: "visible", timeout: 20_000 });
  const warmReadyMs = Math.round(performance.now() - warmStartedAt);
  const stateUrl = page.url();
  await page.evaluate(() => window.scrollTo(0, Math.min(500, document.documentElement.scrollHeight - innerHeight)));
  const previousScroll = await page.evaluate(() => window.scrollY);
  await page.getByRole("link", { name: "Open Opportunity" }).first().click();
  await page.locator("[data-opportunity-detail]").waitFor({ state: "visible", timeout: 20_000 });
  if (screenshotLabel === "desktop") {
    await page.getByRole("button", { name: "Report incorrect information" }).click();
    await page.getByLabel("What needs attention?").selectOption("incorrect_deadline");
    await page.getByRole("button", { name: "Send report" }).click();
    await page.getByText("Thank you. Our team will review this listing.", { exact: true }).waitFor({ state: "visible" });
  }
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Find what’s out there." }).waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Open Opportunity" }).first().waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(page.url(), stateUrl, "Returning from a detail page must restore the complete Discover URL.");
  assert.equal(await search.evaluate((element) => (element as HTMLInputElement).value), "engineering", "Returning from a detail page must restore the search query.");
  if (previousScroll > 0) assert.ok(await page.evaluate(() => window.scrollY) > 0, "Returning from a detail page must restore scroll position.");
  await page.getByRole("button", { name: "Clear opportunity search" }).click();
  await page.locator("[data-filter-results] p[role='status']").waitFor({ state: "hidden", timeout: 10_000 });
  assert.equal(await search.inputValue(), "", "The search clear action must reset the visible value.");
  assert.equal(new URL(page.url()).searchParams.has("query"), false, "The search clear action must remove the URL query.");
  assert.equal(await search.evaluate((node) => document.activeElement === node), true, "Clearing search must return focus to the search field.");
  await search.fill("research");
  await search.press("Escape");
  assert.equal(await search.inputValue(), "", "Escape must clear a focused Discover search.");
  await search.blur();
  await page.keyboard.press("/");
  assert.equal(await search.evaluate((node) => document.activeElement === node), true, "The slash shortcut must focus Discover search outside editable controls.");

  await page.goto(`${origin}/opportunities?type=AI&category=Scholarships`, { waitUntil: "domcontentloaded" });
  await page.getByText("No opportunities match this search.", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Use Any category" }).click();
  await page.getByRole("link", { name: "Open Opportunity" }).first().waitFor({ state: "visible", timeout: 20_000 });
  if (screenshotLabel === "narrow-desktop") {
    const themeResetStatus = await page.evaluate(async () => (await fetch("/api/account/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { appearance: "light", updatedAt: new Date().toISOString() } }),
    })).status);
    assert.equal(themeResetStatus, 200, "The browser fixture must restore the light-theme preference.");
  }
  await settleAccountWrites(page);
  return { coldReadyMs, warmReadyMs, sessionRequests, catalogRequests: catalogRequests.length };
}

async function verifyOpportunityDetails(page: Page, origin: string, screenshotLabel: string) {
  const allScenarios = [
    { id: "benefit--github-student-developer-pack", kind: "benefit", heading: "GitHub Student Developer Pack", facts: ["Value", "Access", "Deadline"] },
    { id: "scholarship--goldwater-scholarship", kind: "scholarship", heading: "Barry Goldwater Scholarship", facts: ["Award", "Deadline", "Application", "Renewal"] },
    { id: "career--google-student-internships", kind: "internship", heading: "Google Student Internships", facts: ["Location", "Format", "Compensation", "Deadline"] },
    { id: "research--nsf-reu-sites", kind: "research", heading: "NSF Research Experiences for Undergraduates Sites", facts: ["Research focus", "Term", "Location", "Funding", "Deadline"] },
    { id: "career--icpc", kind: "competition", heading: "International Collegiate Programming Contest", facts: ["Deadline", "Format", "Difficulty"] },
  ];
  const requestedKind = process.env.UNLOCKED_TEST_OPPORTUNITY_KIND;
  const scenarios = requestedKind ? allScenarios.filter((scenario) => scenario.kind === requestedKind) : allScenarios;
  assert.ok(scenarios.length, `Unknown opportunity detail kind: ${requestedKind}.`);
  const renderedHeights = new Map<string, number>();
  for (const scenario of scenarios) {
    if (process.env.UNLOCKED_TEST_PRODUCTION_WEBKIT === "1") {
      await page.goto("about:blank");
    }
    const notificationReady = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "GET"
        && url.pathname === "/api/notifications"
        && url.searchParams.get("view") === "count";
    }, { timeout: 10_000 });
    await page.goto(`${origin}/opportunities/${scenario.id}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.getByRole("heading", { name: scenario.heading, exact: true }).waitFor({ state: "visible", timeout: 20_000 });
    await assertOrganizationMarks(page, `${screenshotLabel} ${scenario.kind} detail`);
    const detail = page.locator("[data-opportunity-detail]");
    assert.equal(await detail.getAttribute("data-opportunity-kind"), scenario.kind);
    assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1, `${scenario.kind} detail must have one clear title.`);
    assert.equal(await page.getByText("Who qualifies", { exact: true }).count(), 1, `${scenario.kind} detail must expose eligibility immediately.`);
    assert.equal(await page.locator('[data-opportunity-decision-actions] a[target="_blank"]').count(), 1, `${scenario.kind} detail must keep one accurately attributed provider action.`);
    for (const fact of scenario.facts) assert.ok(await page.locator("dt", { hasText: fact }).count(), `${scenario.kind} detail is missing ${fact}.`);
    const learnMore = page.locator("details[data-learn-more]").first();
    assert.equal(await learnMore.getAttribute("open"), null, `${scenario.kind} lower-priority detail must start collapsed.`);
    assert.equal(await page.getByText(/This matters because/, { exact: false }).count(), 0, `${scenario.kind} detail retained generated catalog prose.`);
    assert.ok(await page.getByRole("heading", { name: "Related opportunities", exact: true }).count(), `${scenario.kind} detail must continue into a deterministic exploration chain.`);
    if (screenshotLabel === "mobile" && scenario.kind === "scholarship") {
      const saveAction = page.getByRole("button", { name: "Add to Journey", exact: true });
      const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
      const [saveBox, navigationBox] = await Promise.all([saveAction.boundingBox(), mobileNavigation.boundingBox()]);
      const overlapsNavigation = saveBox && navigationBox
        ? saveBox.y < navigationBox.y + navigationBox.height && saveBox.y + saveBox.height > navigationBox.y
        : true;
      assert.equal(overlapsNavigation, false, `The mobile navigation must not cover the primary Journey action. ${JSON.stringify({ saveBox, navigationBox })}`);
    }
    await assertStableLayout(page, `${screenshotLabel} ${scenario.kind} detail`);
    renderedHeights.set(scenario.kind, await page.evaluate(() => document.documentElement.scrollHeight));
    if (screenshotLabel === "desktop" || (screenshotLabel === "mobile" && scenario.kind === "scholarship")) {
      await page.screenshot({ path: path.join(outputDirectory, `${screenshotLabel}-opportunity-${scenario.kind}.png`), fullPage: true, caret: "initial" });
    }
    await notificationReady;
    await settleAccountWrites(page);
  }
  assert.ok((renderedHeights.get("benefit") ?? 0) < (renderedHeights.get("scholarship") ?? 0), "A simple benefit page should remain shorter than a scholarship with documented requirements.");
  if (screenshotLabel === "mobile") {
    const disclosure = page.locator("details[data-learn-more] > summary").first();
    const box = await disclosure.boundingBox();
    assert.ok(box && box.height >= 44, "Mobile Learn More must preserve a 44px touch target.");
    await disclosure.click();
    assert.notEqual(await page.locator("details[data-learn-more]").first().getAttribute("open"), null, "Learn More must expand inline.");
  }
  return { opportunityTypesVerified: scenarios.length };
}

async function verifyPrimaryRoutes(page: Page, origin: string, screenshotLabel: string) {
  const forYouStartedAt = performance.now();
  await page.goto(`${origin}/advisor`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  try {
    await page.getByRole("heading", { name: /Your first match|A match for you|Matches for you|For You|No matches yet/ }).waitFor({ state: "visible", timeout: 45_000 });
  } catch (error) {
    await page.screenshot({ path: path.join(outputDirectory, `${screenshotLabel}-for-you-failure.png`), fullPage: true });
    console.error("For You browser readiness failure", {
      browser: screenshotLabel,
      url: page.url(),
      body: (await page.locator("body").innerText()).slice(0, 600),
    });
    throw error;
  }
  const forYouReadyMs = Math.round(performance.now() - forYouStartedAt);
  await assertOrganizationMarks(page, `${screenshotLabel} For You`);
  assert.equal(await page.getByRole("heading", { name: "We couldn’t load your matches." }).count(), 0, "For You must not enter an error state on the first authenticated visit.");
  const explanationCount = await page.locator("[data-for-you-page] [data-explanation-kind]").count();
  if (await page.locator('[data-for-you-page="opportunity-briefing-v3"]').count()) assert.ok(explanationCount > 0, "The Pro briefing must expose concise server-projected reasons.");
  if (screenshotLabel === "desktop") {
    const firstRecommendation = page.locator("[data-for-you-page] article").first();
    const firstTitle = (await firstRecommendation.locator("h2, h3").first().textContent())?.trim();
    assert.ok(firstTitle, "The premium portfolio must render a top recommendation title.");
    await firstRecommendation.getByText("Change this match", { exact: true }).click();
    await firstRecommendation.getByRole("button", { name: "Not for me", exact: true }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.getByRole("heading", { name: firstTitle, exact: true }).waitFor({ state: "visible" });
  }
  if (screenshotLabel === "narrow-desktop") {
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "midnight";
      document.documentElement.style.colorScheme = "dark";
    });
    const colorScheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    assert.equal(colorScheme, "dark", "For You must honor the premium dark theme.");
  }
  if (screenshotLabel === "mobile") {
    const undersizedControls = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-for-you-page] summary, [data-for-you-page] .rowActions a, [data-for-you-page] .rowActions button")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.height < 44;
      }).length);
    assert.equal(undersizedControls, 0, "Mobile recommendation controls must preserve 44px touch targets.");
  }
  await assertStableLayout(page, `${screenshotLabel} For You`);
  await page.screenshot({ path: path.join(outputDirectory, `${screenshotLabel}-for-you.png`), fullPage: true, caret: "initial" });
  await settleAccountWrites(page);

  const plannerStartedAt = performance.now();
  await page.goto(`${origin}/planner`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.locator("[data-opportunity-planner]").waitFor({ state: "visible", timeout: 45_000 });
  const plannerReadyMs = Math.round(performance.now() - plannerStartedAt);
  assert.equal(await page.getByRole("heading", { name: "Your year ahead.", exact: true }).count(), 1, "Planner must have one clear purpose.");
  assert.equal(await page.getByText(/Expected opening|Historically opens/i).count(), 0, "Planner must not present inferred future dates.");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `${screenshotLabel} Planner must not overflow horizontally.`);
  const populatedMonth = page.locator("[data-opportunity-planner] details").first();
  if (await populatedMonth.count()) {
    await populatedMonth.locator("summary").click();
    assert.notEqual(await populatedMonth.getAttribute("open"), null, "A populated Planner month must expand with keyboard-accessible native disclosure.");
    await populatedMonth.locator("summary").click();
  }
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
  await assertStableLayout(page, `${screenshotLabel} Planner`);
  await page.screenshot({ path: path.join(outputDirectory, `${screenshotLabel}-planner.png`), fullPage: true, caret: "initial" });
  if (screenshotLabel === "desktop") {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: path.join(outputDirectory, "planner-1280x800.png"), fullPage: true, caret: "initial" });
    await page.setViewportSize({ width: 1728, height: 1117 });
    await page.screenshot({ path: path.join(outputDirectory, "planner-1728x1117.png"), fullPage: true, caret: "initial" });
    await page.setViewportSize({ width: 1440, height: 960 });
  }
  await settleAccountWrites(page);

  const journeyStartedAt = performance.now();
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.locator("[data-journey-command-center]").waitFor({ state: "visible", timeout: 45_000 });
  const journeyReadyMs = Math.round(performance.now() - journeyStartedAt);
  await assertStableLayout(page, `${screenshotLabel} Journey`);
  await page.screenshot({ path: path.join(outputDirectory, `${screenshotLabel}-journey.png`), fullPage: true, caret: "initial" });
  await settleAccountWrites(page);
  return { forYouReadyMs, plannerReadyMs, journeyReadyMs };
}

const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "app-performance-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "app-performance-browser-token";
process.env.UNLOCKED_ANALYTICS_STORE = "memory";
const appPort = await freePort();
const productionWebkit = process.env.UNLOCKED_TEST_PRODUCTION_WEBKIT === "1";
const detailsOnly = process.env.UNLOCKED_TEST_OPPORTUNITY_DETAILS_ONLY === "1";
process.env.NEXT_PUBLIC_APP_URL = `${productionWebkit ? "https" : "http"}://127.0.0.1:${appPort}`;
const session = await seedSession();
if (!productionWebkit) rmSync(testDistDirectory, { recursive: true, force: true });
const app = next({
  dev: !productionWebkit,
  dir: process.cwd(),
  hostname: "127.0.0.1",
  port: appPort,
  ...(productionWebkit ? {} : { conf: { distDir: testDistDirectory } }),
});
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
mkdirSync(outputDirectory, { recursive: true });

const allViewports: ViewportScenario[] = [
  { label: "desktop", width: 1440, height: 960 },
  { label: "narrow-desktop", width: 1100, height: 820 },
  { label: "tablet", width: 834, height: 1112 },
  { label: "mobile", width: 390, height: 844 },
];
const requestedViewport = process.env.UNLOCKED_TEST_VIEWPORT;
const viewports = requestedViewport ? allViewports.filter((viewport) => viewport.label === requestedViewport) : allViewports;
assert.ok(viewports.length, `Unknown browser viewport: ${requestedViewport}.`);

const browser = productionWebkit ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true });
const results = [];
let browserFailure: unknown = null;
try {
  if (productionWebkit) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await preserveLocalHttpForProductionWebkit(context, origin, session.token);
    await installSession(context, origin, session.token);
    const page = await context.newPage();
    const observed = observePage(page);
    let discover;
    let primaryRoutes;
    try {
      discover = detailsOnly ? {} : await verifyDiscover(page, origin, "webkit");
      primaryRoutes = detailsOnly ? {} : await verifyPrimaryRoutes(page, origin, "webkit");
      await page.close();
      await installSession(context, origin, session.token);
      const detailPage = await context.newPage();
      const detailObserved = observePage(detailPage);
      Object.assign(primaryRoutes, await verifyOpportunityDetails(detailPage, origin, "webkit"));
      assert.deepEqual(detailObserved.consoleErrors, [], `WebKit detail console errors: ${detailObserved.consoleErrors.join(" | ")}`);
      assert.deepEqual(detailObserved.requestFailures, [], `WebKit detail request failures: ${detailObserved.requestFailures.join(" | ")}`);
      await detailPage.close();
    } catch (error) {
      console.error("WebKit browser diagnostics", observed);
      throw error;
    }
    assert.deepEqual(observed.consoleErrors, [], `WebKit browser console errors: ${observed.consoleErrors.join(" | ")}`);
    assert.deepEqual(observed.requestFailures, [], `WebKit request failures: ${observed.requestFailures.join(" | ")}`);
    results.push({ browser: "webkit", viewport: "desktop", ...discover, ...primaryRoutes });
    await context.close();
  } else {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: viewport.label === "mobile" ? "reduce" : "no-preference",
      });
      await installSession(context, origin, session.token);
      const page = await context.newPage();
      const observed = observePage(page);
      const discover = detailsOnly ? {} : await verifyDiscover(page, origin, viewport.label);
      const primaryRoutes = detailsOnly ? {} : await verifyPrimaryRoutes(page, origin, viewport.label);
      Object.assign(primaryRoutes, await verifyOpportunityDetails(page, origin, viewport.label));
      assert.deepEqual(observed.consoleErrors, [], `${viewport.label} browser console errors: ${observed.consoleErrors.join(" | ")}`);
      assert.deepEqual(observed.requestFailures, [], `${viewport.label} request failures: ${observed.requestFailures.join(" | ")}`);
      results.push({ browser: "chromium", viewport: viewport.label, ...discover, ...primaryRoutes });
      await context.close();
    }
  }
} catch (error) {
  browserFailure = error;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  kvServer.closeAllConnections();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
  if (!productionWebkit) rmSync(testDistDirectory, { recursive: true, force: true });
}

if (browserFailure) {
  console.error(browserFailure);
  process.exit(1);
} else {
  console.log(JSON.stringify({ message: "Full-app browser performance checks passed.", screenshots: outputDirectory, results }, null, 2));
  process.exit(0);
}
