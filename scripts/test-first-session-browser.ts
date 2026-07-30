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
    activity: { viewed: [], saved: [], claimed: [], tracked: {} },
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
  return (allowIntentionalSaveFailure = false) => {
    const intentionalSaveFailure: string = "Failed to load resource: the server responded with a status of 500 (Internal Server Error)";
    const expected = errors.filter((message) => message === intentionalSaveFailure);
    const unexpected = errors.filter((message) => message !== intentionalSaveFailure);
    if (allowIntentionalSaveFailure) assert.equal(expected.length, 1, "The forced save failure should produce exactly one browser resource error.");
    else assert.equal(expected.length, 0, "No unexpected HTTP 500 should reach the browser.");
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
  await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith("unlocked-onboarding-draft-v1:")));
  await schoolInput.fill("University of Chicago");
  await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith("unlocked-onboarding-draft-v1:") && localStorage.getItem(key)?.includes("University of Chicago")));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Get started" }).click();
  await assert.doesNotReject(async () => assert.equal(await schoolInput.inputValue(), "University of Chicago"), "Interrupted onboarding must restore the saved answer.");

  startedAt = performance.now();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("combobox", { name: "Select year" }).selectOption("2030");
  await page.getByRole("button", { name: "Continue" }).click();
  const majorInput = page.getByRole("combobox", { name: "Search for your major" });
  await majorInput.fill("Mathematics");
  await majorInput.evaluate((node) => (node as HTMLInputElement).blur());
  await page.locator("#onboarding-major-listbox").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByRole("button", { name: "Scholarships", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Finding research", exact: true }).click();
  timings.onboardingInteractions = performance.now() - startedAt;

  startedAt = performance.now();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.waitForURL("**/advisor", { timeout: 60_000 });
  await page.getByRole("heading", { name: "Your opportunities are ready." }).waitFor({ state: "visible", timeout: 60_000 });
  await page.getByRole("button", { name: "Add to Journey" }).first().waitFor({ state: "visible" });
  timings.onboardingToForYou = performance.now() - startedAt;
  return timings;
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
  assert.equal(await page.getByText("Your private record of what you saved, pursued, and accomplished.", { exact: true }).count(), 1);
  assert.ok(await page.getByRole("button", { name: "Update", exact: true }).first().isVisible());
  const firstJourneyMs = performance.now() - journeyStartedAt;

  const returnStartedAt = performance.now();
  await page.goto(`${origin}/advisor`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: "Add to Journey" }).first().waitFor({ state: "visible", timeout: 60_000 });
  assert.equal(await page.getByRole("heading", { name: "Your opportunities are ready." }).count(), 0, "Returning activated users must not see first-session welcome copy.");
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
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches("[data-journey-save-flight]")) root.dataset.saveFlightObserved = "true";
            if (node.matches("[data-journey-save-chip]")) root.dataset.saveChipObserved = "true";
          }
        }
        if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
          if (mutation.target.matches("[data-journey-destination][data-journey-arrival='true']")) root.dataset.saveArrivalObserved = "true";
          if (mutation.target.matches("[data-journey-save-card='confirmed']")) root.dataset.saveCardObserved = "true";
        }
      }
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  });
  await page.route("**/api/journey/add", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.continue();
  }, { times: 1 });
  await button.click();
  await button.locator("[data-journey-save-progress]").waitFor({ state: "visible" });
  assert.equal(await button.getAttribute("data-journey-save-state"), "loading");
  await page.screenshot({ path: `/tmp/unlocked-save-${browserName.toLowerCase()}-desktop-loading.png`, fullPage: true });
  await page.getByText("Added to your Journey.", { exact: false }).waitFor({ state: "visible", timeout: 15_000 });
  await page.screenshot({ path: `/tmp/unlocked-save-${browserName.toLowerCase()}-desktop-success.png`, fullPage: true });
  await page.waitForFunction(() => document.documentElement.dataset.saveArrivalObserved === "true");
  const observations = await page.evaluate(() => ({
    flight: document.documentElement.dataset.saveFlightObserved,
    chip: document.documentElement.dataset.saveChipObserved,
    arrival: document.documentElement.dataset.saveArrivalObserved,
    card: document.documentElement.dataset.saveCardObserved,
  }));
  assert.deepEqual(observations, { flight: "true", chip: "true", arrival: "true", card: "true" }, "Desktop save must complete the flight, confirmation, destination, and card acknowledgement sequence.");
  assert.ok(await page.getByText("Added to Journey", { exact: false }).first().isVisible());
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
