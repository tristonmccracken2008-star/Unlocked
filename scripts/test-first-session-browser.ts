import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import next from "next";
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();

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
        store.set(key, { value: command[2], expiresAt: expiryIndex >= 0 ? Date.now() + Number(command[expiryIndex + 1]) * 1_000 : undefined });
        result = "OK";
      }
    } else if (operation === "DEL") result = store.delete(String(command[1])) ? 1 : 0;
    else if (operation === "EVAL") {
      const key = String(command[3]);
      if (String(command[1]).includes("INCR")) {
        const current = Number(liveValue(key)?.value ?? 0) + 1;
        store.set(key, { value: current, expiresAt: Date.now() + Number(command[4] ?? 60) * 1_000 });
        result = current;
      } else if (liveValue(key)?.value === command[4]) {
        store.delete(key);
        result = 1;
      } else result = 0;
    } else if (operation === "SMEMBERS" || operation === "LRANGE" || operation === "ZREVRANGE") result = [];
    else if (["SADD", "LPUSH", "PFADD", "HINCRBY", "ZINCRBY", "EXPIRE"].includes(operation)) result = 1;
    else if (operation === "LTRIM") result = "OK";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

async function seedNewSession(label: string) {
  const { createSession, upsertUser } = await import("../lib/auth-store");
  const user = await upsertUser({ googleSub: `first-session-new-${label}`, email: `new-${label}@example.test`, name: `Avery ${label}` });
  return await createSession(user);
}

async function seedProSession(label: string) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const user = await upsertUser({ googleSub: `first-session-pro-${label}`, email: `pro-${label}@example.test`, name: `Morgan ${label}` });
  await mergeAccountData(user.id, {
    profile: {
      firstName: "Morgan",
      lastName: label,
      schoolSlug: "university-of-chicago",
      major: "Computer Science",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Software Engineering",
      interests: "Internships, AI Tools",
      preferredOpportunityTypes: ["Internships", "AI Tools"],
      goals: ["Finding an internship"],
      topics: ["Internships", "AI Tools"],
      currentPriority: "Finding an internship",
      gpaStatus: "none_yet",
      onboardingCompletedAt: new Date().toISOString(),
    },
    onboardingComplete: true,
    firstLaunchComplete: true,
    activity: { viewed: [], saved: [], claimed: [], tracked: {} },
  });
  await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  return await createSession(user);
}

async function seedProOnboardingSession(label: string) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const user = await upsertUser({ googleSub: `first-session-pro-onboarding-${label}`, email: `pro-onboarding-${label}@example.test`, name: `Taylor ${label}` });
  await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  await mergeAccountData(user.id, { preferences: { appearance: "midnight", updatedAt: new Date().toISOString() } });
  return await createSession(user);
}

async function seedProWalkthroughSession(label: string) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const user = await upsertUser({ googleSub: `first-session-pro-walkthrough-${label}`, email: `pro-walkthrough-${label}@example.test`, name: `Riley ${label}` });
  await mergeAccountData(user.id, {
    profile: {
      firstName: "Riley",
      lastName: label,
      schoolSlug: "university-of-chicago",
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Research",
      interests: "Research",
      goals: ["Finding research experience"],
      topics: ["Natural Sciences"],
      gpaStatus: "none_yet",
      onboardingCompletedAt: new Date().toISOString(),
    },
    onboardingComplete: true,
    firstLaunchComplete: false,
    preferences: { appearance: "midnight", updatedAt: new Date().toISOString() },
  });
  await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  return await createSession(user);
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
  await context.route("https://logo.clearbit.com/**", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>' }));
}

function observe(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("_vercel")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return (allowIntentionalSaveFailure = false, allowIntentionalSecurityFailure = false) => {
    const intentionalSaveFailure: string = "Failed to load resource: the server responded with a status of 500 (Internal Server Error)";
    const intentionalSecurityFailure: string = "Failed to load resource: the server responded with a status of 400 (Bad Request)";
    const isWebKitNavigationCancellation = (message: string) => /\/api\/(?:auth\/session|notifications\?view=count|return-experience) due to access control checks\.$/.test(message);
    const expectedSave = errors.filter((message) => message === intentionalSaveFailure);
    const expectedSecurity = errors.filter((message) => message === intentionalSecurityFailure);
    const unexpected = errors.filter((message) => message !== intentionalSaveFailure && message !== intentionalSecurityFailure && !isWebKitNavigationCancellation(message));
    if (allowIntentionalSaveFailure) assert.equal(expectedSave.length, 1, "The forced save failure should produce exactly one browser resource error.");
    else assert.equal(expectedSave.length, 0, "No unexpected HTTP 500 should reach the browser.");
    if (allowIntentionalSecurityFailure) assert.equal(expectedSecurity.length, 1, "The forced onboarding bypass should produce exactly one browser resource error.");
    else assert.equal(expectedSecurity.length, 0, "No unexpected HTTP 400 should reach the browser.");
    assert.deepEqual(unexpected, [], `Browser errors: ${unexpected.join(" | ")}`);
  };
}

async function completeOnboarding(page: Page, origin: string) {
  const timings: Record<string, number> = {};
  let startedAt = performance.now();
  await page.goto(`${origin}/onboarding`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Welcome to UnlockED" }).waitFor({ state: "visible" });
  timings.authToOnboarding = performance.now() - startedAt;

  await page.getByRole("button", { name: "Get started" }).click();
  const schoolInput = page.getByRole("combobox", { name: "Search for your school" });
  await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith("unlocked-onboarding-draft-v2:")));
  await schoolInput.fill("University of Chicago");
  await page.getByRole("option", { name: /University of Chicago/ }).click();
  await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith("unlocked-onboarding-draft-v2:") && localStorage.getItem(key)?.includes("University of Chicago")));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "What school do you attend?" }).waitFor({ state: "visible" });
  await assert.doesNotReject(async () => assert.equal(await schoolInput.inputValue(), "University of Chicago"), "Interrupted onboarding must restore the saved answer.");

  startedAt = performance.now();
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "When do you expect to graduate?" }).waitFor({ state: "visible" });
  await page.getByRole("combobox", { name: "Select year" }).selectOption("2030");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "What are you studying?" }).waitFor({ state: "visible" });
  const majorInput = page.locator("#onboarding-major");
  await majorInput.fill("Mathematics");
  await page.waitForFunction(() => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .some((key) => key?.startsWith("unlocked-onboarding-draft-v2:") && localStorage.getItem(key)?.includes('"major":"Mathematics"')));
  await majorInput.press("Escape");
  await page.locator("#onboarding-major-listbox").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "What kinds of opportunities are you looking for?" }).waitFor({ state: "visible" });
  const opportunityResearch = page.getByRole("button", { name: "Research", exact: true });
  if (await opportunityResearch.getAttribute("aria-pressed") !== "true") await opportunityResearch.click();
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].some((button) => button.textContent?.includes("Research") && button.getAttribute("aria-pressed") === "true"));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "What fields are you interested in?" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Natural Sciences", exact: true }).click();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("heading", { name: "What kinds of opportunities are you looking for?" }).waitFor({ state: "visible" });
  assert.equal(await page.getByRole("button", { name: "Research", exact: true }).getAttribute("aria-pressed"), "true", "Back navigation must preserve prior selections.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "What fields are you interested in?" }).waitFor({ state: "visible" });
  assert.equal(await page.getByRole("button", { name: "Natural Sciences", exact: true }).getAttribute("aria-pressed"), "true", "Returning forward must preserve the current answer.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Finding research experience", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Remote", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Summer", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Academic Research", exact: true }).click();
  timings.onboardingInteractions = performance.now() - startedAt;

  startedAt = performance.now();
  let profileWrites = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/account/data" && request.method() === "PUT") profileWrites += 1;
  });
  await page.getByRole("button", { name: "Finish setup" }).dblclick();
  await page.waitForURL("**/welcome", { timeout: 60_000 });
  assert.equal(profileWrites, 1, "Rapid duplicate completion must produce one profile write.");
  await page.getByRole("heading", { name: "Discover Opportunities" }).waitFor({ state: "visible", timeout: 60_000 });
  timings.onboardingToWalkthrough = performance.now() - startedAt;

  let completionWrites = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/account/first-launch" && request.method() === "POST") completionWrites += 1;
  });
  const walkthrough = page.locator("[data-first-launch-walkthrough]");
  assert.equal(await walkthrough.getAttribute("data-first-launch-step"), "discover");
  assert.ok(await page.locator("[data-preview-kind='discover']").isVisible(), "Discover must have an art-directed product preview.");
  assert.equal(await page.getByRole("navigation", { name: "Walkthrough progress" }).getByText("Step 1 of 4: Discover").count(), 1);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("heading", { name: "Personalized For You" }).waitFor({ state: "visible" });
  assert.ok(await page.locator("[data-preview-kind='for-you']").isVisible(), "For You must visibly preview recommendation intelligence.");
  assert.equal(await page.getByText("Upgrade anytime to unlock your complete personalized feed.", { exact: true }).count(), 1, "Free users should receive one quiet expectation-setting line.");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Personalized For You" }).waitFor({ state: "visible" });
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("heading", { name: "Discover Opportunities" }).waitFor({ state: "visible" });
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { name: "Personalized For You" }).waitFor({ state: "visible" });
  await walkthrough.dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 320, clientY: 420 }], changedTouches: [{ identifier: 1, clientX: 320, clientY: 420 }] });
  await walkthrough.dispatchEvent("touchend", { touches: [], changedTouches: [{ identifier: 1, clientX: 80, clientY: 422 }] });
  await page.getByRole("heading", { name: "Build Your Journey" }).waitFor({ state: "visible" });
  assert.ok(await page.locator("[data-preview-kind='journey']").isVisible(), "Journey must visibly preview deadlines, statuses, and active opportunities.");
  await page.screenshot({ path: "/tmp/unlocked-first-launch-journey-mobile.png", fullPage: false });
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { name: "You’re Ready" }).waitFor({ state: "visible" });
  await page.screenshot({ path: "/tmp/unlocked-first-launch-mobile.png", fullPage: false });
  await page.getByRole("button", { name: "Start Exploring" }).dblclick();
  await page.waitForURL("**/opportunities", { timeout: 60_000 });
  assert.equal(completionWrites, 1, "Rapid duplicate completion must produce one walkthrough write.");
  await page.getByRole("heading", { name: "Find what’s out there." }).waitFor({ state: "visible", timeout: 60_000 });
  timings.walkthroughToDiscover = performance.now() - startedAt - timings.onboardingToWalkthrough;
  const persistedSession = await page.evaluate(async () => await (await fetch("/api/auth/session", { cache: "no-store" })).json());
  assert.equal(persistedSession.data.firstLaunchComplete, true, "Walkthrough completion must persist to the account.");
  const duplicate = await page.evaluate(async () => {
    const response = await fetch("/api/account/first-launch", { method: "POST", credentials: "same-origin" });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true, "A repeated server completion must be idempotent.");
  await page.goto(`${origin}/welcome`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForURL("**/opportunities", { timeout: 60_000 });
  await page.goto(`${origin}/advisor`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your first match." }).waitFor({ state: "visible", timeout: 60_000 });
  await page.getByRole("button", { name: "Add to Journey" }).first().waitFor({ state: "visible" });
  timings.discoverToForYou = performance.now() - startedAt - timings.onboardingToWalkthrough - timings.walkthroughToDiscover;
  return timings;
}

async function verifyDesktopDarkOnboarding(browser: Browser, origin: string, token: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
  await installSession(context, origin, token);
  const page = await context.newPage();
  const assertNoErrors = observe(page);
  await page.goto(`${origin}/onboarding`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Welcome to UnlockED" }).waitFor({ state: "visible" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "midnight");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "midnight", "Pro onboarding must honor the saved dark appearance.");
  const bypassAttempt = await page.evaluate(async () => {
    const response = await fetch("/api/account/data", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onboardingComplete: true,
        profile: { firstName: "Taylor", schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2030", year: "First year", careerGoal: "Research", interests: "Research" },
      }),
    });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(bypassAttempt.status, 400, "Client manipulation must not bypass V2 server validation.");
  assert.equal(bypassAttempt.body.code, "incomplete_onboarding");
  await page.getByRole("button", { name: "Get started" }).focus();
  await page.keyboard.press("Enter");
  const progress = page.getByRole("progressbar", { name: "Onboarding progress" });
  assert.equal(await progress.getAttribute("aria-valuemax"), "10");
  assert.equal(await progress.getAttribute("aria-valuenow"), "1");
  assert.ok(await page.getByRole("combobox", { name: "Search for your school" }).isVisible());
  await page.getByRole("button", { name: "Go back" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Welcome to UnlockED" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Get started" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "What school do you attend?" }).waitFor({ state: "visible" });
  await page.screenshot({ path: "/tmp/unlocked-onboarding-desktop-dark.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), "Desktop dark onboarding must not overflow horizontally.");
  assertNoErrors(false, true);
  await context.close();
}

async function verifyDesktopDarkWalkthrough(browser: Browser, origin: string, token: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
  await installSession(context, origin, token);
  const page = await context.newPage();
  const assertNoErrors = observe(page);
  await page.goto(`${origin}/welcome`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Discover Opportunities" }).waitFor({ state: "visible" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "midnight");
  assert.equal(await page.getByText("Upgrade anytime to unlock your complete personalized feed.", { exact: true }).count(), 0, "Pro users must not receive Free walkthrough copy.");
  assert.ok(await page.locator("[data-preview-kind='discover']").isVisible(), "Desktop walkthrough must render the art-directed Discover preview.");
  assert.equal(await page.locator("[data-preview-kind] button").count(), 0, "Decorative previews must not add keyboard-focusable controls.");
  assert.ok(await page.getByRole("button", { name: "Next", exact: true }).isVisible());
  await page.screenshot({ path: "/tmp/unlocked-first-launch-desktop-dark.png", fullPage: false });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), "Desktop walkthrough must not overflow horizontally.");
  assertNoErrors();
  await context.close();
}

async function verifyFirstSave(page: Page, origin: string, browserName: string) {
  let addRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/journey/add") addRequests += 1;
  });
  await page.route("**/api/journey/add", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "We couldn’t add this opportunity. Nothing changed." }) }), { times: 1 });
  const button = page.locator("button[data-journey-save-state]").first();
  await button.getByText("Add to Journey", { exact: true }).waitFor({ state: "visible" });
  await button.click();
  await page.getByRole("alert").getByText(/couldn’t add/i).waitFor({ state: "visible" });
  assert.equal(await page.getByText("Added to Journey", { exact: false }).count(), 0, "A failed save must not show success.");
  assert.equal(await button.getAttribute("data-journey-save-state"), "error", "A failed save must settle into an intentional retry state.");
  assert.equal(await button.getByText("Try again", { exact: true }).count(), 1);

  const startedAt = performance.now();
  await button.dblclick();
  await page.getByText("Added to your Journey.", { exact: false }).waitFor({ state: "visible", timeout: 15_000 });
  const firstSaveMs = performance.now() - startedAt;
  assert.equal(addRequests, 2, "The failed attempt and one protected retry should issue exactly two requests.");
  const addedState = page.getByText("Added to Journey", { exact: false }).first();
  assert.ok(await addedState.isVisible());
  assert.equal(await page.locator("[data-journey-save-flight]").count(), 0, "Reduced-motion users must not receive the travel animation.");
  assert.equal(await page.locator("[data-journey-save-burst]").count(), 0, "Reduced-motion users must not receive the success particle burst.");
  assert.equal(await page.locator("[data-action-state='loading'][data-journey-save-state]").count(), 0, "A completed save must never retain a loading control.");
  await page.screenshot({ path: `/tmp/unlocked-save-${browserName.toLowerCase()}-mobile-reduced.png`, fullPage: true });

  const opportunityId = await page.locator("[data-for-you-page] article").first().evaluate((node) => {
    const link = node.querySelector<HTMLAnchorElement>('a[href^="/opportunities/"]');
    return link?.getAttribute("href")?.split("/").at(-1) ?? "";
  });
  const replay = await page.evaluate(async ({ id }) => {
    const response = await fetch("/api/journey/add", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId: id, source: "for_you", idempotencyKey: `browser-replay:${crypto.randomUUID()}` }),
    });
    return { status: response.status, body: await response.json() };
  }, { id: opportunityId });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);

  const journeyStartedAt = performance.now();
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Journey", exact: true }).waitFor({ state: "visible" });
  assert.equal(await page.getByText("See what you are pursuing and what needs attention next.", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "Update", exact: true }).first().waitFor({ state: "visible", timeout: 15_000 });
  const firstJourneyMs = performance.now() - journeyStartedAt;

  const returnStartedAt = performance.now();
  await page.goto(`${origin}/advisor`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: "Add to Journey" }).first().waitFor({ state: "visible", timeout: 60_000 });
  assert.equal(await page.getByRole("heading", { name: "Your first match." }).count(), 0, "Returning activated users must not see first-session welcome copy.");
  return { firstSaveMs, firstJourneyMs, returnMs: performance.now() - returnStartedAt };
}

async function runNewAccount(browser: Browser, origin: string, token: string, browserName: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await installSession(context, origin, token);
  const page = await context.newPage();
  const assertNoErrors = observe(page);
  const onboarding = await completeOnboarding(page, origin);
  const activation = await verifyFirstSave(page, origin, browserName);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `First-session mobile flow created ${overflow}px horizontal overflow.`);
  assertNoErrors(true);
  await context.close();
  return { ...onboarding, ...activation };
}

async function runPro(browser: Browser, origin: string, token: string, browserName: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await installSession(context, origin, token);
  const page = await context.newPage();
  const assertNoErrors = observe(page);
  await page.goto(`${origin}/advisor`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: "Add to Journey" }).first().waitFor({ state: "visible", timeout: 60_000 });
  const button = page.locator("button[data-journey-save-state]").first();
  assert.equal(await page.getByText("See your complete personalized shortlist", { exact: false }).count(), 0, "Pro must not receive Free upgrade messaging.");
  assert.ok(await page.locator("[data-for-you-page] article").count() > 1, "Pro should receive the full shortlist.");
  await page.evaluate(() => {
    const root = document.documentElement;
    root.dataset.maximumConcurrentSaveFlights = "0";
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches("[data-journey-save-flight]")) root.dataset.saveFlightObserved = "true";
            if (node.matches("[data-journey-save-burst]")) root.dataset.saveBurstObserved = "true";
            if (node.matches("[data-journey-save-chip]")) root.dataset.saveChipObserved = "true";
          }
        }
        if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
          if (mutation.target.matches("[data-journey-destination][data-journey-arrival='true']")) root.dataset.saveArrivalObserved = "true";
          if (mutation.target.matches("[data-journey-save-card='confirmed']")) root.dataset.saveCardObserved = "true";
        }
        root.dataset.maximumConcurrentSaveFlights = String(Math.max(Number(root.dataset.maximumConcurrentSaveFlights ?? 0), document.querySelectorAll("[data-journey-save-flight]").length));
      }
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  });
  await page.route("**/api/journey/add", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 450));
    await route.continue();
  }, { times: 1 });
  const idleButtonBox = await button.boundingBox();
  assert.ok(idleButtonBox, "The idle Add to Journey control must have measurable dimensions.");
  await button.click();
  assert.equal(await button.getAttribute("data-journey-save-state"), "loading");
  await button.getByText("Adding to Journey…", { exact: true }).waitFor({ state: "visible" });
  const loadingButtonBox = await button.boundingBox();
  assert.ok(loadingButtonBox, "The saving control must preserve measurable dimensions.");
  assert.ok(Math.abs(loadingButtonBox.width - idleButtonBox.width) <= 1 && Math.abs(loadingButtonBox.height - idleButtonBox.height) <= 1, "Saving must not resize the action control.");
  assert.equal(await button.locator("[data-journey-save-progress]").count(), 0);
  await page.screenshot({ path: `/tmp/unlocked-save-${browserName.toLowerCase()}-desktop-loading.png`, fullPage: true });
  await page.getByText("Added to your Journey.", { exact: false }).waitFor({ state: "visible", timeout: 15_000 });
  await page.screenshot({ path: `/tmp/unlocked-save-${browserName.toLowerCase()}-desktop-success.png`, fullPage: true });
  await page.waitForFunction(() => document.documentElement.dataset.saveArrivalObserved === "true");
  const observations = await page.evaluate(() => ({
    flight: document.documentElement.dataset.saveFlightObserved,
    burst: document.documentElement.dataset.saveBurstObserved,
    chip: document.documentElement.dataset.saveChipObserved,
    arrival: document.documentElement.dataset.saveArrivalObserved,
    card: document.documentElement.dataset.saveCardObserved,
  }));
  assert.deepEqual(observations, { flight: "true", burst: "true", chip: "true", arrival: "true", card: "true" }, "Desktop save must complete the burst, flight, confirmation, destination, and card acknowledgement sequence.");
  const confirmedControl = page.locator("[data-journey-save-confirmed='true']").first();
  assert.ok(await confirmedControl.isVisible());
  assert.notEqual(await confirmedControl.evaluate((node) => getComputedStyle(node).cursor), "wait", "The settled save control must not retain a native busy cursor.");
  assert.equal(await page.locator("[data-action-state='loading'][data-journey-save-state]").count(), 0, "The request resolving must remove every save loading state immediately.");
  const confirmedButtonBox = await confirmedControl.boundingBox();
  assert.ok(confirmedButtonBox, "The confirmed Journey control must have measurable dimensions.");
  assert.ok(Math.abs(confirmedButtonBox.width - idleButtonBox.width) <= 1 && Math.abs(confirmedButtonBox.height - idleButtonBox.height) <= 1, "Confirmation must not resize the action control.");
  assert.ok(await page.locator("[data-journey-destination-icon]").first().isVisible(), "The save animation must acknowledge a dedicated Journey destination mark.");

  let activeSaveRequests = 0;
  let maximumConcurrentSaveRequests = 0;
  await page.route("**/api/journey/add", async (route) => {
    activeSaveRequests += 1;
    maximumConcurrentSaveRequests = Math.max(maximumConcurrentSaveRequests, activeSaveRequests);
    await new Promise((resolve) => setTimeout(resolve, 460));
    await route.continue();
    activeSaveRequests -= 1;
  }, { times: 2 });
  const rapidButtons = page.locator("button[data-journey-save-state='idle']");
  assert.ok(await rapidButtons.count() >= 2, "The Pro shortlist must provide multiple save controls for queue validation.");
  const rapidOpportunityIds = await rapidButtons.evaluateAll((buttons) => buttons.slice(0, 2).map((button) => button.getAttribute("data-journey-save-opportunity") ?? ""));
  assert.ok(rapidOpportunityIds.every(Boolean), "Rapid-save controls must expose stable opportunity identifiers.");
  const firstRapidSave = page.locator(`[data-journey-save-opportunity="${rapidOpportunityIds[0]}"]`);
  const secondRapidSave = page.locator(`[data-journey-save-opportunity="${rapidOpportunityIds[1]}"]`);
  await page.evaluate((opportunityIds) => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("button[data-journey-save-opportunity]")];
    for (const opportunityId of opportunityIds) buttons.find((button) => button.dataset.journeySaveOpportunity === opportunityId)?.click();
  }, rapidOpportunityIds);
  assert.equal(await firstRapidSave.getAttribute("data-journey-save-state"), "loading");
  assert.equal(await secondRapidSave.getAttribute("data-journey-save-state"), "loading");
  await secondRapidSave.getByText("Adding to Journey…", { exact: true }).waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelectorAll("[data-journey-save-confirmed='true']").length >= 3, undefined, { timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector("[data-journey-save-flight]") && !document.querySelector("[data-journey-save-burst]") && !document.querySelector("[data-journey-save-chip]"), undefined, { timeout: 15_000 });
  assert.equal(maximumConcurrentSaveRequests, 1, "Rapid saves must serialize client requests instead of colliding with the account lock.");
  assert.ok(Number(await page.locator("html").getAttribute("data-maximum-concurrent-save-flights")) <= 2, "Transfer motion must remain bounded during rapid saves.");
  assert.equal(await page.locator("[data-journey-save-state='error'], [id^='journey-add-error-']").count(), 0, "Rapid saves must not produce a lock or retry error.");

  await page.goto(`${origin}/opportunities`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const unsavedDiscoverCard = page.locator("[data-discover-opportunity]").filter({ has: page.locator("button[data-journey-save-state='idle']") }).first();
  await unsavedDiscoverCard.waitFor({ state: "visible", timeout: 60_000 });
  const discoverOpportunityId = await unsavedDiscoverCard.getAttribute("data-discover-opportunity");
  assert.ok(discoverOpportunityId, "Discover save validation requires a stable opportunity identifier.");
  const discoverSave = page.locator(`[data-discover-opportunity="${discoverOpportunityId}"]`);
  await discoverSave.locator("button[data-journey-save-state='idle']").click();
  await discoverSave.getByText("Added to Journey", { exact: false }).waitFor({ state: "visible", timeout: 15_000 });

  const detailCandidate = page.locator("[data-discover-opportunity]").filter({ has: page.locator("button[data-journey-save-state='idle']") }).first();
  const detailHref = await detailCandidate.locator('a[href^="/opportunities/"]').first().getAttribute("href");
  assert.ok(detailHref, "Discover must expose an opportunity detail route for save validation.");
  await page.goto(`${origin}${detailHref}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const detailSave = page.locator("button[data-journey-save-state='idle']");
  await detailSave.waitFor({ state: "visible", timeout: 60_000 });
  await detailSave.click();
  await page.getByText("Added to Journey", { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
  await page.goto(`${origin}/welcome`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForURL("**/opportunities", { timeout: 60_000 });
  assert.equal(await page.locator("[data-first-launch-walkthrough]").count(), 0, "Returning accounts must never re-enter the walkthrough.");
  assertNoErrors();
  await context.close();
}

const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "first-session-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "first-session-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;

const chromiumNew = await seedNewSession("chromium");
const webkitNew = await seedNewSession("webkit");
const chromiumPro = await seedProSession("chromium");
const webkitPro = await seedProSession("webkit");
const chromiumProOnboarding = await seedProOnboardingSession("chromium");
const chromiumProWalkthrough = await seedProWalkthroughSession("chromium");
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: appPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
const browsers = [
  { name: "Chromium", browser: await chromium.launch({ headless: true }), fresh: chromiumNew.token, pro: chromiumPro.token },
  { name: "WebKit", browser: await webkit.launch({ headless: true }), fresh: webkitNew.token, pro: webkitPro.token },
];

let failure: unknown;
try {
  const results: Array<{ browser: string; timings: Record<string, number> }> = [];
  await verifyDesktopDarkOnboarding(browsers[0]!.browser, origin, chromiumProOnboarding.token);
  await verifyDesktopDarkWalkthrough(browsers[0]!.browser, origin, chromiumProWalkthrough.token);
  for (const target of browsers) {
    const timings = await runNewAccount(target.browser, origin, target.fresh, target.name);
    await runPro(target.browser, origin, target.pro, target.name);
    results.push({ browser: target.name, timings });
  }
  const timingKeys = Object.keys(results[0]!.timings);
  const timingSummary = Object.fromEntries(timingKeys.map((key) => {
    const values = results.map((result) => result.timings[key]!);
    const sorted = [...values].sort((left, right) => left - right);
    return [key, {
      averageMs: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      p95Ms: Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)]!),
      worstMs: Math.round(sorted.at(-1)!),
    }];
  }));
  console.log("First-session browser checks passed", { browsers: browsers.map((item) => item.name), timingSummary });
} catch (caught) {
  failure = caught;
} finally {
  await Promise.all(browsers.map((target) => target.browser.close()));
  server.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => server.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  kvServer.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => kvServer.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
}
if (failure) {
  console.error("First-session browser checks failed", failure);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
