import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { mkdir } from "node:fs/promises";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const output = "/tmp/unlocked-applications-workspace";
const live = (key: string) => {
  const item = store.get(key);
  if (item?.expiresAt && item.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return item;
};
async function listen(server: net.Server, port = 0) {
  await new Promise<void>((resolve, reject) =>
    server.once("error", reject).listen(port, "127.0.0.1", resolve),
  );
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
    const command = JSON.parse(
      Buffer.concat(chunks).toString("utf8"),
    ) as unknown[];
    const [operation, rawKey, ...rest] = command;
    const key = String(rawKey);
    let result: unknown = null;
    if (operation === "GET") result = live(key)?.value ?? null;
    else if (operation === "SET") {
      if (!rest.includes("NX") || !live(key)) {
        const expiry = rest.indexOf("EX");
        store.set(key, {
          value: rest[0],
          expiresAt:
            expiry >= 0
              ? Date.now() + Number(rest[expiry + 1]) * 1_000
              : undefined,
        });
        result = "OK";
      }
    } else if (operation === "DEL") result = store.delete(key) ? 1 : 0;
    else if (operation === "EVAL") {
      const lockKey = String(command[3]);
      if (String(command[1]).includes("INCR")) {
        const current = Number(live(lockKey)?.value ?? 0) + 1;
        store.set(lockKey, {
          value: current,
          expiresAt: Date.now() + Number(command[4]) * 1_000,
        });
        result = current;
      } else if (live(lockKey)?.value === command[4]) {
        store.delete(lockKey);
        result = 1;
      }
    } else if (
      [
        "PFADD",
        "HINCRBY",
        "ZINCRBY",
        "EXPIRE",
        "ZADD",
        "SADD",
        "LPUSH",
        "LTRIM",
      ].includes(String(operation))
    )
      result = 1;
    else if (
      ["ZRANGEBYSCORE", "ZREVRANGE", "SMEMBERS", "LRANGE"].includes(
        String(operation),
      )
    )
      result = [];
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}
async function install(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([
    {
      name: "unlocked_session",
      value: token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1_000) + 3_600,
    },
  ]);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.fulfill({ status: 204, body: "" }),
  );
}
function observe(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("_vercel"))
      errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () =>
    assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`);
}
async function noOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  assert.ok(overflow <= 1, `${label} has ${overflow}px horizontal overflow.`);
}

await mkdir(output, { recursive: true });
const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET =
  "applications-workspace-browser-secret-with-sufficient-length";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "applications-workspace-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;

const { opportunities } = await import("../data/opportunities");
const { applicationWorkspaceEligible, trustedApplicationRequirements } =
  await import("../lib/application-workspace");
const { createSession, mergeAccountData, updateAccountBilling, upsertUser } =
  await import("../lib/auth-store");
const applicable = opportunities
  .filter(
    (item) =>
      applicationWorkspaceEligible(item) &&
      trustedApplicationRequirements(item).length,
  )
  .slice(0, 12);
assert.ok(
  applicable.length >= 8,
  "Browser checks require eight verified application-capable opportunities.",
);
const now = "2026-08-24T12:00:00.000Z";
async function seed(
  label: string,
  count: number,
  appearance: "light" | "midnight" | "forest" | "system" = count
    ? "midnight"
    : "light",
) {
  const user = await upsertUser({
    googleSub: `applications-browser-${label}`,
    email: `${label.toLowerCase()}@example.test`,
    name: `${label} Student`,
  });
  const selected = applicable.slice(0, count);
  const tracker = Object.fromEntries(
    selected.map((item, index) => [
      item.id,
      {
        id: item.id,
        status:
          index === count - 1 ? ("Submitted" as const) : ("Applying" as const),
        savedAt: now,
        updatedAt: new Date(Date.parse(now) + index * 1000).toISOString(),
        version: 1,
        history: [],
      },
    ]),
  );
  await mergeAccountData(user.id, {
    profile: {
      firstName: label,
      schoolSlug: "university-of-chicago",
      major: "Computer Science",
      graduationYear: "2028",
      year: "Junior",
      careerGoal: "Software Engineering",
      interests: "Software, Research",
      onboardingCompletedAt: now,
    },
    onboardingComplete: true,
    firstLaunchComplete: true,
    activity: {
      viewed: [],
      saved: Object.keys(tracker),
      claimed: [],
      tracked: tracker,
    },
    savedOpportunities: [],
    tracker,
    preferences: { appearance, updatedAt: now },
  });
  if (count)
    await updateAccountBilling(user.id, { tier: "pro", status: "active" });
  return createSession(user);
}
const owner = await seed("Avery", 8);
const empty = await seed("Jordan", 0);
const lightOwner = await seed("Taylor", 2, "light");
const forestOwner = await seed("Morgan", 2, "forest");
const systemOwner = await seed("Riley", 2, "system");
const app = next({
  dev: true,
  dir: process.cwd(),
  hostname: "127.0.0.1",
  port: appPort,
});
await app.prepare();
const server = http.createServer((request, response) =>
  app.getRequestHandler()(request, response),
);
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
let failure: unknown;
try {
  const signedOut = await chromiumBrowser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const signedOutPage = await signedOut.newPage();
  await signedOutPage.goto(`${origin}/applications`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(new URL(signedOutPage.url()).pathname, "/");
  await signedOut.close();
  const desktop = await chromiumBrowser.newContext({
    viewport: { width: 1728, height: 1117 },
    reducedMotion: "reduce",
  });
  await install(desktop, origin, owner.token);
  const page = await desktop.newPage();
  const noErrors = observe(page);
  await page.goto(`${origin}/applications`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page
    .getByRole("heading", { name: "Applications", exact: true })
    .waitFor();
  await page.getByRole("heading", { name: "What needs doing" }).waitFor();
  assert.equal(await page.locator("[data-applications-workspace]").count(), 1);
  await noOverflow(page, "Applications desktop");
  await page.screenshot({
    path: `${output}/applications-dark-1728.png`,
    fullPage: true,
  });
  const first = page.locator("article[id^=application-]").first();
  await first.getByRole("link", { name: "Open application" }).click();
  await page.getByRole("heading", { name: "Application contents" }).waitFor();
  assert.match(new URL(page.url()).pathname, /^\/applications\//);
  const complete = page.getByRole("button", { name: "Mark complete" }).first();
  await complete.click();
  await page.getByText("Application task completed.").waitFor();
  await page.getByRole("button", { name: "Add a prompt from the official form" }).click();
  await page.getByLabel("Prompt text").fill("Tell us about a challenge, how you responded, and what you learned.");
  await page.getByLabel("Published limit").fill("500");
  await page.getByRole("button", { name: "Save prompt" }).click();
  await page.getByText("Student-added prompt saved.").waitFor();
  await page.getByLabel("Response draft").fill("The challenge was incomplete data. I learned a lot and led 20 people.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Written response saved.").waitFor();
  await page.getByText("Confirm new factual claims").first().waitFor();
  await page.getByRole("button", { name: "Add recommender" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Professor Rivera");
  await page.getByRole("button", { name: "Save recommender" }).click();
  await page.getByText("Recommender recorded.").waitFor();
  await page.getByRole("button", { name: "Save a factual story" }).click();
  await page.getByLabel("Story title").fill("Research data challenge");
  await page.getByLabel("What you actually did").fill("Reviewed missing records and documented a validation process.");
  await page.getByRole("button", { name: "Save to Answer Bank" }).click();
  await page.getByText("Story saved to Answer Bank.").waitFor();
  await page.getByRole("heading", { name: "Reusable factual stories." }).waitFor();
  await page.screenshot({
    path: `${output}/application-detail-dark-1728.png`,
    fullPage: true,
  });
  for (const width of [1440, 1280, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page, `Application detail at ${width}px`);
  }
  await page.setViewportSize({ width: 720, height: 900 });
  await noOverflow(page, "Applications at 200% desktop zoom equivalent");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/learn`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page
    .getByRole("heading", { name: "From finding it to finishing it." })
    .waitFor();
  for (const heading of [
    "Find something worth pursuing.",
    "Keep the opportunities you choose.",
    "Prepare one application at a time.",
    "Turn experience into reusable materials.",
    "Keep a factual record of what you did.",
  ])
    await page.getByRole("heading", { name: heading }).waitFor();
  await noOverflow(page, "Learn desktop");
  await page.screenshot({
    path: `${output}/learn-dark-1440.png`,
    fullPage: true,
  });
  noErrors();
  await desktop.close();
  const mobile = await chromiumBrowser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await install(mobile, origin, owner.token);
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${origin}/applications`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await mobilePage
    .getByRole("link", { name: "Open application" })
    .first()
    .click();
  await mobilePage
    .getByRole("heading", { name: "Application contents" })
    .waitFor();
  await noOverflow(mobilePage, "Application detail mobile");
  await mobilePage.screenshot({
    path: `${output}/application-detail-mobile-390.png`,
    fullPage: true,
  });
  await mobilePage.goto(`${origin}/learn`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await mobilePage
    .getByRole("heading", { name: "From finding it to finishing it." })
    .waitFor();
  await noOverflow(mobilePage, "Learn mobile");
  await mobilePage.screenshot({
    path: `${output}/learn-mobile-390.png`,
    fullPage: true,
  });
  await mobile.close();
  const isolated = await chromiumBrowser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await install(isolated, origin, empty.token);
  const isolatedPage = await isolated.newPage();
  await isolatedPage.goto(`${origin}/applications`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await isolatedPage
    .getByRole("heading", { name: "No active applications yet." })
    .waitFor();
  assert.equal(
    await isolatedPage.locator("article[id^=application-]").count(),
    0,
  );
  await isolated.close();
  for (const [label, session, colorScheme] of [
    ["light", lightOwner, "light"],
    ["forest", forestOwner, "light"],
    ["system", systemOwner, "dark"],
  ] as const) {
    const themed = await chromiumBrowser.newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme,
    });
    await install(themed, origin, session.token);
    const themedPage = await themed.newPage();
    await themedPage.goto(`${origin}/applications`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await themedPage
      .getByRole("link", { name: "Open application" })
      .first()
      .click();
    await themedPage
      .getByRole("heading", { name: "Application contents" })
      .waitFor();
    await noOverflow(themedPage, `Application detail ${label} mode`);
    await themed.close();
  }
  const webkitContext = await webkitBrowser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  await install(webkitContext, origin, owner.token);
  const webkitPage = await webkitContext.newPage();
  await webkitPage.goto(`${origin}/applications`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await webkitPage
    .getByRole("link", { name: "Open application" })
    .first()
    .click();
  await webkitPage
    .getByRole("heading", { name: "Application contents" })
    .waitFor();
  await noOverflow(webkitPage, "Application detail WebKit");
  await webkitContext.close();
} catch (error) {
  failure = error;
} finally {
  await Promise.all([chromiumBrowser.close(), webkitBrowser.close()]);
  server.closeAllConnections();
  await Promise.race([
    new Promise<void>((resolve) => server.close(() => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);
  await Promise.race([
    app.close(),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
  kv.closeAllConnections();
  await Promise.race([
    new Promise<void>((resolve) => kv.close(() => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);
}
if (failure) {
  console.error("Applications Workspace browser checks failed", failure);
  process.exitCode = 1;
} else
  console.log("Applications and product-cohesion browser checks passed", {
    chromium: true,
    webkit: true,
    mobile390: true,
    mobile640: true,
    desktop1280: true,
    desktop1440: true,
    desktop1728: true,
    zoom200Percent: true,
    normalMotion: true,
    reducedMotion: true,
    lightMode: true,
    darkMode: true,
    forestMode: true,
    systemMode: true,
    accountIsolation: true,
    taskMutation: true,
    writtenResponse: true,
    recommender: true,
    answerBank: true,
    workflowLearn: true,
  });
process.exit(process.exitCode ?? 0);
