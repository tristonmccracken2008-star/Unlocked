import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import next from "next";
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "playwright";
import type { JourneyProgressTransition, OpportunityTrackerStatus, TrackedOpportunity } from "../data/student-activity";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const outputDirectory = "/tmp/unlocked-path-moments";
const performanceResults: Record<string, number> = {};

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

const transitionOrder: Array<{ transition: JourneyProgressTransition; status: OpportunityTrackerStatus }> = [
  { transition: "choose", status: "Interested" },
  { transition: "start", status: "Applying" },
  { transition: "submit", status: "Submitted" },
  { transition: "interview", status: "Interview" },
  { transition: "accept", status: "Accepted" },
  { transition: "complete", status: "Completed" },
];

function recordFor(id: string, finalStatus: OpportunityTrackerStatus, index: number): TrackedOpportunity {
  const end = transitionOrder.findIndex((item) => item.status === finalStatus);
  const history = transitionOrder.slice(0, end + 1).map((item, transitionIndex) => {
    const priorStatus = transitionIndex ? transitionOrder[transitionIndex - 1].status : "Saved";
    return {
      id: `path-browser-${index}-${transitionIndex}`,
      transition: item.transition,
      priorStatus,
      resultingStatus: item.status,
      occurredAt: `2026-0${Math.min(4, index + 1)}-${String(10 + transitionIndex).padStart(2, "0")}T12:00:00.000Z`,
    };
  });
  return {
    id,
    status: finalStatus,
    savedAt: `2026-0${Math.min(4, index + 1)}-08T12:00:00.000Z`,
    updatedAt: history.at(-1)?.occurredAt ?? "2026-01-08T12:00:00.000Z",
    version: history.length,
    history,
  };
}

async function seedSession(label: string, populated: boolean, dark = false) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const { opportunities } = await import("../data/opportunities");
  const selected = populated ? opportunities.filter((item) => item.type === "Career" && item.category === "Internships").slice(0, 4) : [];
  const statuses: OpportunityTrackerStatus[] = ["Submitted", "Interview", "Accepted", "Completed"];
  const tracker = Object.fromEntries(selected.map((opportunity, index) => [opportunity.id, recordFor(opportunity.id, statuses[index], index)]));
  const user = await upsertUser({ googleSub: `path-moment-${label}`, email: `path-moment-${label}@example.test`, name: `Jordan ${label}` });
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
    activity: { viewed: [], saved: selected.map((item) => item.id), claimed: [], tracked: tracker },
    savedOpportunities: selected.map((item) => ({ opportunityId: item.id, savedAt: tracker[item.id].savedAt })),
    tracker,
    preferences: { appearance: dark ? "midnight" : "light", updatedAt: now },
  });
  if (dark) await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  return await createSession(user);
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
}

async function openCreator(page: Page, origin: string) {
  const response = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(response?.status(), 200);
  const journey = page.locator("[data-journey-editorial]");
  await journey.waitFor({ state: "visible" });
  const trigger = journey.getByRole("button", { name: "Create a Path Moment" });
  await trigger.scrollIntoViewIfNeeded();
  assert.equal(await page.locator("[data-path-moment-artwork]").count(), 0, "Path Moment artwork must remain unmounted before intent.");
  await trigger.hover();
  await page.waitForTimeout(100);
  const started = performance.now();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Share one meaningful step." });
  await dialog.waitFor({ state: "visible" });
  performanceResults.firstDialogMs ??= performance.now() - started;
  return { journey, trigger, dialog };
}

async function assertNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} must not create horizontal overflow; received ${overflow}px.`);
}

async function selectFormat(dialog: ReturnType<Page["getByRole"]>, label: "Story" | "Square" | "LinkedIn") {
  await dialog.getByRole("button", { name: label, exact: true }).click();
  await dialog.locator("[data-path-moment-artwork]").waitFor({ state: "visible" });
}

async function selectMoment(dialog: ReturnType<Page["getByRole"]>, labelPrefix: string, expectedHeadline: string) {
  const select = dialog.locator("select");
  const options = await select.locator("option").evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent ?? "", value: (node as HTMLOptionElement).value })));
  const option = options.find((item) => item.label.startsWith(labelPrefix));
  assert.ok(option, `${labelPrefix} must be available in the Path Moment selector.`);
  await select.selectOption(option.value);
  const artworkText = await dialog.locator("[data-path-moment-artwork]").textContent() ?? "";
  assert.ok(artworkText.replace(/\s+/g, "").includes(expectedHeadline.replace(/\s+/g, "")), `${labelPrefix} must render its full evidence-based headline.`);
}

function pngDimensions(filePath: string) {
  const bytes = readFileSync(filePath);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "path-moment-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "path-moment-browser-token";
const requestedAppPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${requestedAppPort}`;

const populatedSession = await seedSession("Student", true);
const darkSession = await seedSession("Night", true, true);
const emptySession = await seedSession("Beginning", false);
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: requestedAppPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
const appPort = await listen(server, requestedAppPort);
const origin = `http://127.0.0.1:${appPort}`;
mkdirSync(outputDirectory, { recursive: true });

const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
try {
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
    await installSession(context, origin, populatedSession.token);
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 }); // Warm compilation.
    const { trigger, dialog } = await openCreator(page, origin);
    await assertNoOverflow(page, "desktop creator");
    assert.equal(await dialog.getAttribute("aria-describedby"), "path-moment-description");
    const describedPreview = dialog.locator('[role="img"][data-preview-layout]');
    assert.match(await describedPreview.getAttribute("aria-label") ?? "", /moment|path/i);
    assert.equal(await describedPreview.getAttribute("aria-describedby"), "path-moment-preview-description");
    assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true, "Path Moment dialog must contain initial focus.");
    for (let index = 0; index < 18; index += 1) {
      await page.keyboard.press("Tab");
      assert.equal(await dialog.evaluate((node) => {
        const active = document.activeElement;
        return active !== document.body && active !== null && !node.contains(active) && active.matches("a, button, input, select, textarea, summary, [tabindex]");
      }), false, "Path Moment dialog cannot move focus to an outside control.");
    }
    assert.equal(await dialog.getByRole("button", { name: "Anonymous", exact: true }).getAttribute("aria-pressed"), "true");
    assert.equal(await dialog.getByRole("checkbox").evaluateAll((items) => items.every((item) => !(item as HTMLInputElement).checked)), true, "Optional identity fields must default off.");
    const anonymousText = await dialog.locator("[data-path-moment-artwork]").textContent() ?? "";
    assert.doesNotMatch(anonymousText, /Jordan|University of Chicago/, "Anonymous preview cannot expose identity.");
    assert.equal(await dialog.locator("[data-path-moment-artwork] [data-open-line-marker]").count(), 1, "Artwork must contain one semantic marker.");
    await page.screenshot({ path: path.join(outputDirectory, "story-anonymous-light.png"), fullPage: true });

    await selectMoment(dialog, "First submission", "I submitted my first application.");
    await selectMoment(dialog, "First interview", "I reached my first interview.");
    await selectMoment(dialog, "First acceptance", "I received my first opportunity.");
    await selectMoment(dialog, "Semester recap", "This semester,");
    await selectMoment(dialog, "Completed experience", "I followed an opportunity through to completion.");

    await dialog.getByRole("button", { name: "Full name", exact: true }).click();
    await dialog.getByRole("checkbox", { name: "School" }).check();
    await dialog.getByRole("checkbox", { name: "Organization" }).check();
    await dialog.getByRole("checkbox", { name: "Opportunity" }).check();
    await dialog.getByRole("checkbox", { name: "Month and year" }).check();
    const namedText = await dialog.locator("[data-path-moment-artwork]").textContent() ?? "";
    assert.match(namedText, /Jordan Student/);
    assert.match(namedText, /University of Chicago/);
    await page.screenshot({ path: path.join(outputDirectory, "story-named-light.png"), fullPage: true });
    await dialog.locator("[data-path-moment-artwork]").screenshot({ path: path.join(outputDirectory, "path-moment-story.png") });

    await selectFormat(dialog, "Square");
    assert.equal(await dialog.locator("[data-path-moment-artwork]").getAttribute("width"), "1080");
    assert.equal(await dialog.locator("[data-path-moment-artwork]").getAttribute("height"), "1080");
    await page.screenshot({ path: path.join(outputDirectory, "square-named-light.png"), fullPage: true });
    await dialog.locator("[data-path-moment-artwork]").screenshot({ path: path.join(outputDirectory, "path-moment-square.png") });

    await selectFormat(dialog, "LinkedIn");
    assert.equal(await dialog.locator("[data-path-moment-artwork]").getAttribute("width"), "1200");
    assert.equal(await dialog.locator("[data-path-moment-artwork]").getAttribute("height"), "627");
    await page.screenshot({ path: path.join(outputDirectory, "linkedin-named-light.png"), fullPage: true });
    await dialog.locator("[data-path-moment-artwork]").screenshot({ path: path.join(outputDirectory, "path-moment-linkedin.png") });

    const exportStarted = performance.now();
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download PNG" }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "unlocked-path-moment-linkedin.png");
    const downloadPath = path.join(outputDirectory, download.suggestedFilename());
    await download.saveAs(downloadPath);
    assert.deepEqual(pngDimensions(downloadPath), { width: 1200, height: 627 });
    await dialog.getByText("Path Moment downloaded.").waitFor({ state: "visible" });
    performanceResults.pngGenerationMs = performance.now() - exportStarted;

    const copy = dialog.getByRole("button", { name: "Copy image" });
    if (await copy.count()) {
      await copy.click();
      await dialog.getByText(/copied as an image|could not copy the image/i).waitFor({ state: "visible" });
    }

    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await trigger.waitFor({ state: "visible" });
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true, "Closing the creator must restore focus to its trigger.");
    assert.equal(await page.locator("[data-path-moment-artwork]").count(), 0, "Closing must release the export artwork tree.");
    const warmStarted = performance.now();
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    performanceResults.warmDialogMs = performance.now() - warmStarted;
    assert.ok(performanceResults.warmDialogMs < 250, `A prepared Path Moment dialog must open under 250ms; received ${performanceResults.warmDialogMs.toFixed(1)}ms.`);
    assert.equal(await page.locator("dialog[open]").count(), 1, "Repeated opening cannot duplicate dialog trees.");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await context.close();
  }

  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
    await installSession(context, origin, darkSession.token);
    const page = await context.newPage();
    const { dialog } = await openCreator(page, origin);
    assert.equal(await dialog.getAttribute("data-theme"), "dark");
    assert.equal(await dialog.locator("[data-path-moment-artwork]").getAttribute("data-export-theme"), "dark");
    await dialog.locator("[data-path-moment-artwork]").screenshot({ path: path.join(outputDirectory, "path-moment-story-dark.png") });
    await selectFormat(dialog, "Square");
    assert.equal(await dialog.locator("[data-path-moment-artwork]").getAttribute("data-export-theme"), "dark");
    await dialog.locator("[data-path-moment-artwork]").screenshot({ path: path.join(outputDirectory, "path-moment-square-dark.png") });
    await dialog.getByRole("button", { name: "Light", exact: true }).click();
    assert.equal(await dialog.locator("[data-path-moment-artwork]").getAttribute("data-export-theme"), "light", "Export appearance must update the preview SVG before serialization.");
    await page.screenshot({ path: path.join(outputDirectory, "story-anonymous-dark.png"), fullPage: true });
    await context.close();
  }

  {
    const context = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: "light" });
    await installSession(context, origin, populatedSession.token);
    const page = await context.newPage();
    const { dialog } = await openCreator(page, origin);
    await assertNoOverflow(page, "mobile WebKit creator");
    await selectFormat(dialog, "Square");
    const controls = dialog.getByRole("button", { name: /Story|Square|LinkedIn|Anonymous|First name|Full name/ });
    const sizes = await controls.evaluateAll((nodes) => nodes.map((node) => ({ width: (node as HTMLElement).getBoundingClientRect().width, height: (node as HTMLElement).getBoundingClientRect().height })));
    assert.ok(sizes.every((size) => size.height >= 44), "Mobile creator controls must preserve 44px touch height.");
    await page.screenshot({ path: path.join(outputDirectory, "square-mobile-webkit.png"), fullPage: true });
    await context.close();
  }

  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1200, height: 900 }, forcedColors: "active" });
    await installSession(context, origin, populatedSession.token);
    const page = await context.newPage();
    await openCreator(page, origin);
    await page.screenshot({ path: path.join(outputDirectory, "creator-forced-colors.png"), fullPage: true });
    await context.close();
  }

  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1200, height: 900 } });
    await installSession(context, origin, emptySession.token);
    const page = await context.newPage();
    const response = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
    assert.equal(response?.status(), 200);
    const root = page.locator("[data-journey-editorial]");
    await root.waitFor({ state: "visible" });
    await root.getByText("You’ll unlock your first Path Moment after a meaningful milestone.", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await root.getByRole("button", { name: "Create a Path Moment" }).count(), 0);
    await page.screenshot({ path: path.join(outputDirectory, "empty-state.png"), fullPage: true });
    await context.close();
  }
} finally {
  await chromiumBrowser.close();
  await webkitBrowser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
}

console.log(JSON.stringify({ message: "Path Moment browser checks passed in Chromium and WebKit.", screenshots: outputDirectory, performance: Object.fromEntries(Object.entries(performanceResults).map(([key, value]) => [key, Number(value.toFixed(1))])) }, null, 2));
process.exit(0);
