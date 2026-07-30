import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import next from "next";
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
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
      if (live(lockKey)?.value === command[4]) { store.delete(lockKey); result = 1; } else result = 0;
    } else if (["PFADD", "HINCRBY", "ZINCRBY", "EXPIRE", "ZADD", "SADD"].includes(String(operation))) result = 1;
    else if (["ZRANGEBYSCORE", "ZREVRANGE", "SMEMBERS"].includes(String(operation))) result = [];
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}
async function seed(label: string, pro = false) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const user = await upsertUser({ googleSub: `account-browser-${label}`, email: `${label.toLowerCase()}@example.test`, name: `${label} Student` });
  await mergeAccountData(user.id, {
    profile: {
      firstName: label,
      schoolSlug: "university-of-chicago",
      major: label === "Jordan" ? "Computer Science" : "Mathematics",
      graduationYear: "2030",
      year: "First year",
      careerGoal: "Research",
      interests: "Research, Scholarships",
      preferredOpportunityTypes: ["Research"],
      currentPriority: "Finding research",
      goals: ["Finding research"],
      topics: ["Research"],
      gpaStatus: "none_yet",
      onboardingCompletedAt: "2026-07-20T12:00:00.000Z",
    },
    onboardingComplete: true,
    activity: { viewed: [], saved: [], claimed: [], tracked: {} },
    journeyProgress: { "completed-profile": true },
  });
  if (pro) await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "year", cancelAtPeriodEnd: false });
  return { user, session: await createSession(user) };
}
async function install(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
}
function observe(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("_vercel")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`);
}
async function exercise(browser: Browser, origin: string, token: string, name: string, pro: boolean, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await install(context, origin, token);
  const page = await context.newPage();
  const noErrors = observe(page);
  await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your account." }).waitFor();
  await page.getByRole("heading", { name, exact: true }).waitFor();
  await page.getByRole("heading", { name: "Profile settings." }).waitFor();
  assert.equal(await page.locator("[data-profile-identity-card]").count(), 1);
  const identityCard = page.locator("[data-profile-identity-card]");
  await identityCard.getByText("University of Chicago").waitFor();
  await identityCard.getByText(pro ? "Computer Science" : "Mathematics", { exact: true }).waitFor();
  await identityCard.getByText("Research", { exact: true }).waitFor();
  await page.screenshot({ path: `/tmp/unlocked-profile-identity-${name.toLowerCase()}.png`, fullPage: true });
  await identityCard.getByText("Saved", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.locator("#first-name").waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.id), "first-name");
  await page.locator("#first-name").waitFor();
  assert.equal(await page.locator("#first-name").inputValue(), name);
  await page.locator("#last-name").fill("Verified");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByText("Profile saved. Eligibility and For You will use these details.").waitFor();
  await page.getByRole("heading", { name: `${name} Verified`, exact: true }).waitFor();
  for (const section of ["Profile", "Interests", "Notifications", "Privacy", "Appearance", "Plan and billing", "Data and account"]) assert.ok(await page.getByRole("button", { name: section, exact: true }).isVisible());

  await page.goto(`${origin}/profile#billing`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: pro ? "UnlockED Pro" : "UnlockED Free" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Plan and billing", exact: true }).getAttribute("aria-current"), "page");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Profile settings." }).waitFor();

  await page.getByRole("button", { name: "Interests", exact: true }).click();
  await page.getByRole("heading", { name: "Tell For You what to prioritize." }).waitFor();
  await page.getByRole("button", { name: "Internships", exact: true }).click();
  await page.getByRole("button", { name: "Save interests" }).click();
  await page.getByText("Opportunity interests saved.").waitFor();

  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await page.getByRole("heading", { name: "Private by default." }).waitFor();
  const school = page.getByRole("checkbox", { name: /Include school/ });
  await school.check();
  await page.getByRole("button", { name: "Save privacy defaults" }).click();
  await page.getByText("Journey Card privacy defaults saved.").waitFor();

  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  const midnight = page.getByRole("button", { name: /Midnight/ });
  assert.equal(await midnight.isDisabled(), !pro);
  if (pro) {
    await midnight.click();
    await page.locator('html[data-theme="midnight"]').waitFor();
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await page.locator("[data-profile-identity-card]").waitFor();
    const themeColors = await page.evaluate(() => ({
      pageHeading: getComputedStyle(document.querySelector("h1")!).color,
      identityHeading: getComputedStyle(document.querySelector("[data-profile-identity-card] h2")!).color,
    }));
    assert.deepEqual(themeColors, { pageHeading: "rgb(251, 243, 232)", identityHeading: "rgb(251, 243, 232)" }, "Midnight Profile headings must use the active high-contrast theme token.");
    await page.waitForTimeout(250);
    await page.screenshot({ path: "/tmp/unlocked-profile-identity-dark-mobile.png", fullPage: false });
  }

  await page.getByRole("button", { name: "Data and account", exact: true }).click();
  const exportResult = await page.evaluate(async () => {
    const response = await fetch("/api/account/export", { method: "POST", credentials: "same-origin" });
    return { status: response.status, text: await response.text() };
  });
  assert.equal(exportResult.status, 200);
  assert.match(exportResult.text, /unlocked-account-export/);
  assert.doesNotMatch(exportResult.text, /stripeCustomerId|stripeSubscriptionId|providerAccountId/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Account center created ${overflow}px horizontal overflow.`);
  noErrors();
  await context.close();
}

const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "account-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "account-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const free = await seed("Avery");
const pro = await seed("Jordan", true);
const deletion = await seed("Delete");
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: appPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
let failure: unknown;
try {
  await exercise(chromiumBrowser, origin, free.session.token, "Avery", false, { width: 1280, height: 900 });
  await exercise(webkitBrowser, origin, pro.session.token, "Jordan", true, { width: 390, height: 844 });
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 900 } });
    await install(context, origin, free.session.token);
    await context.route("**/api/auth/session", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary_failure" }) }));
    const page = await context.newPage();
    await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Your account." }).waitFor();
    await page.getByText("Your account details could not be refreshed. Your session is still active; retry or refresh the page.").waitFor();
    assert.equal(await page.getByRole("heading", { name: "Your session has ended." }).count(), 0, "Temporary session API failure must not show a false sign-out state.");
    assert.equal(await page.locator("#first-name").inputValue(), "Avery", "Server-confirmed profile data must remain visible during a temporary client refresh failure.");
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 640, height: 900 } });
    await install(context, origin, free.session.token);
    const page = await context.newPage();
    await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Avery Verified", exact: true }).waitFor();
    assert.ok(await page.locator("[data-profile-identity-card]").isVisible(), "Identity card must remain visible at a 200% reflow-equivalent viewport.");
    assert.ok(await page.getByRole("button", { name: "Edit profile", exact: true }).isVisible(), "Primary identity edit action must remain reachable at 200% reflow.");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `Profile created ${overflow}px horizontal overflow at the 200% reflow-equivalent viewport.`);

    await install(context, origin, pro.session.token);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Jordan Verified", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Avery Verified", exact: true }).count(), 0, "Prior account identity must not survive an account switch.");

    await install(context, origin, free.session.token);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Avery Verified", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Jordan Verified", exact: true }).count(), 0, "Switched account identity must not leak after returning to the original account.");
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 900 } });
    await install(context, origin, free.session.token);
    await context.route("**/api/account/data", async (route) => {
      if (route.request().method() === "PUT") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary_failure" }) });
      else await route.continue();
    });
    const page = await context.newPage();
    await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Avery Verified", exact: true }).waitFor();
    await page.locator("#first-name").fill("Unsaved");
    await page.getByRole("button", { name: "Save profile" }).click();
    await page.getByText("Profile could not be saved.").waitFor();
    await page.getByRole("heading", { name: "Avery Verified", exact: true }).waitFor();
    await context.close();
  }
  const context = await chromiumBrowser.newContext({ viewport: { width: 1024, height: 768 } });
  await install(context, origin, deletion.session.token);
  const page = await context.newPage();
  await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Data and account", exact: true }).click();
  await page.getByRole("button", { name: "Start account deletion" }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Permanently delete account" }).click();
  await page.getByText("Your UnlockED account and associated data were deleted.").waitFor({ timeout: 30_000 });
  await page.waitForURL(`${origin}/`, { timeout: 30_000 });
  const { getSession } = await import("../lib/auth-store");
  assert.equal(await getSession(deletion.session.token), null);
  await context.close();
  console.log("Account center browser checks passed", { browsers: ["Chromium", "WebKit"], accounts: 3, viewports: ["desktop", "mobile", "200_percent_reflow_equivalent"], accountSwitching: true, sessionFailureClassification: "retryable_data_error" });
} catch (error) {
  failure = error;
} finally {
  await Promise.all([chromiumBrowser.close(), webkitBrowser.close()]);
  server.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => server.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  await Promise.race([app.close(), new Promise<void>((resolve) => setTimeout(resolve, 5_000))]);
  kv.closeAllConnections();
  await Promise.race([new Promise<void>((resolve) => kv.close(() => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
}
if (failure) {
  console.error("Account center browser checks failed", failure);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
