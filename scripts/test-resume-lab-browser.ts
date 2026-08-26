import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
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

const kv = kvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "resume-lab-browser-secret-with-sufficient-length";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "resume-lab-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const { createSession, mergeAccountData, updateAccountBilling, upsertUser } =
  await import("../lib/auth-store");
async function seed(label: string) {
  const user = await upsertUser({
    googleSub: `resume-browser-${label}`,
    email: `${label.toLowerCase()}@example.test`,
    name: `${label} Student`,
  });
  const now = new Date().toISOString();
  await mergeAccountData(user.id, {
    profile: {
      firstName: label,
      lastName: "Student",
      schoolSlug: "university-of-chicago",
      schoolName: "University of Chicago",
      major: "Computer Science",
      graduationYear: "2028",
      year: "Junior",
      careerGoal: "Software Engineering",
      interests: "Software",
      onboardingCompletedAt: now,
    },
    onboardingComplete: true,
    firstLaunchComplete: true,
  });
  return { ...(await createSession(user)), userId: user.id };
}
const owner = await seed("Avery");
const other = await seed("Jordan");
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
const browsers = [
  await chromium.launch({ headless: true }),
  await webkit.launch({ headless: true }),
];
let failure: unknown;
try {
  const signedOut = await browsers[0].newContext({
    viewport: { width: 1280, height: 900 },
  });
  const signedOutPage = await signedOut.newPage();
  await signedOutPage.goto(`${origin}/build`, {
    waitUntil: "domcontentloaded",
  });
  await signedOutPage.waitForURL((url) => url.pathname === "/", {
    timeout: 10_000,
  });
  assert.equal(new URL(signedOutPage.url()).pathname, "/");
  await signedOut.close();
  const desktop = await browsers[0].newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await install(desktop, origin, owner.token);
  const page = await desktop.newPage();
  const noErrors = observe(page);
  await page.goto(`${origin}/build`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.getByRole("heading", { name: "Turn experience into materials you can use." }).waitFor();
  await noOverflow(page, "Build desktop");
  await page.screenshot({ path: "/tmp/unlocked-build-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "Experience" }).first().click();
  await page.getByRole("heading", { name: "Experience Bank", exact: true }).waitFor();
  await page.getByLabel("Role or project").fill("Project Lead");
  await page.getByLabel("Organization").fill("Student Team");
  await page.getByLabel("What did you do?").fill("Built a scheduling tool");
  await page.getByLabel(/What happened/).fill("Used by 24 students");
  await page.getByRole("button", { name: "Add to Experience Bank" }).click();
  await page.getByText("Experience added from confirmed facts.").waitFor();
  await page.getByRole("button", { name: "Resumes 0" }).click();
  await page.getByRole("button", { name: "Create master resume" }).click();
  await page.getByText("Resume version created.").waitFor();
  await page
    .getByRole("heading", { name: "Master resume", exact: true })
    .waitFor();
  await page
    .locator("fieldset")
    .filter({ hasText: "Experience included" })
    .getByText("Project Lead")
    .click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Resume saved.").waitFor();
  await page.getByRole("link", { name: "Export / print" }).waitFor();
  await noOverflow(page, "Resume Lab desktop");
  noErrors();
  await page.screenshot({
    path: "/tmp/unlocked-resume-lab-desktop.png",
    fullPage: true,
  });
  const print = await desktop.newPage();
  const href = await page
    .getByRole("link", { name: "Export / print" })
    .getAttribute("href");
  assert.ok(href);
  await print.goto(`${origin}${href}`, { waitUntil: "networkidle" });
  await print.getByRole("button", { name: "Print or save as PDF" }).waitFor();
  assert.equal(
    await print
      .getByText("Built a scheduling tool; Used by 24 students.")
      .count(),
    1,
  );
  await print.screenshot({
    path: "/tmp/unlocked-resume-lab-print.png",
    fullPage: true,
  });
  await print.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page, "Resume Lab mobile");
  await page.screenshot({
    path: "/tmp/unlocked-resume-lab-mobile.png",
    fullPage: true,
  });
  await desktop.close();
  const isolated = await browsers[0].newContext({
    viewport: { width: 1280, height: 900 },
  });
  await install(isolated, origin, other.token);
  const isolatedPage = await isolated.newPage();
  await isolatedPage.goto(`${origin}/resume-lab`, { waitUntil: "networkidle" });
  assert.equal(
    await isolatedPage.getByText("Project Lead", { exact: true }).count(),
    0,
    "Resume data must not cross accounts.",
  );
  await isolated.close();
  await updateAccountBilling(owner.userId, { tier: "pro", status: "active" });
  await mergeAccountData(owner.userId, { preferences: { appearance: "midnight", reducedMotion: "reduce", updatedAt: new Date().toISOString() } });
  const webkitContext = await browsers[1].newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
    colorScheme: "dark",
  });
  await install(webkitContext, origin, owner.token);
  const webkitPage = await webkitContext.newPage();
  await webkitPage.goto(`${origin}/build`, { waitUntil: "networkidle" });
  await webkitPage.getByRole("heading", { name: "Turn experience into materials you can use." }).waitFor();
  await noOverflow(webkitPage, "Build WebKit dark");
  await webkitPage.screenshot({ path: "/tmp/unlocked-build-webkit-dark.png", fullPage: true });
  await webkitContext.close();
} catch (error) {
  failure = error;
} finally {
  await Promise.all(browsers.map((browser) => browser.close()));
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
  console.error("Build and Resume Lab browser checks failed", failure);
  process.exitCode = 1;
} else
  console.log("Build and Resume Lab browser checks passed", {
    chromium: true,
    webkit: true,
    mobile: true,
    darkMode: true,
    reducedMotion: true,
    accountIsolation: true,
    print: true,
  });
process.exit(process.exitCode ?? 0);
