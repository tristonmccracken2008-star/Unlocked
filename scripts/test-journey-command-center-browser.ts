import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import next from "next";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "../data/student-activity";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const output = "/tmp/unlocked-journey-command-center";

function live(key: string) {
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
    const key = String(command[1] ?? "");
    let result: unknown = null;
    if (operation === "GET") result = live(key)?.value ?? null;
    else if (operation === "SET") {
      if (!command.includes("NX") || !live(key)) {
        const expiry = command.indexOf("EX");
        store.set(key, { value: command[2], expiresAt: expiry >= 0 ? Date.now() + Number(command[expiry + 1]) * 1_000 : undefined });
        result = "OK";
      }
    } else if (operation === "DEL") result = store.delete(key) ? 1 : 0;
    else if (operation === "EVAL") {
      const lockKey = String(command[3]);
      if (live(lockKey)?.value === command[4]) { store.delete(lockKey); result = 1; } else result = 0;
    } else if (["PFADD", "HINCRBY", "ZINCRBY", "EXPIRE", "ZADD", "SADD", "LPUSH"].includes(operation)) result = 1;
    else if (["ZRANGEBYSCORE", "ZREVRANGE", "SMEMBERS", "LRANGE"].includes(operation)) result = [];
    else if (operation === "LTRIM") result = "OK";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

function tracked(id: string, status: OpportunityTrackerStatus, index: number, professionalStageId?: string, reminder = false): TrackedOpportunity {
  const day = String((index % 25) + 1).padStart(2, "0");
  return {
    id,
    status,
    savedAt: `2026-01-${day}T12:00:00.000Z`,
    updatedAt: `2026-02-${day}T12:00:00.000Z`,
    version: 1,
    professionalStageId,
    history: [{
      id: `journey:browser:${index}:history`,
      transition: status === "Completed" ? "complete" : status === "Rejected" ? "close" : status === "Interview" ? "interview" : status === "Submitted" ? "submit" : status === "Applying" ? "start" : "choose",
      priorStatus: "Saved",
      resultingStatus: status,
      occurredAt: `2026-02-${day}T12:00:00.000Z`,
      professionalStageId,
      details: reminder ? { notes: "Private command-center note.", reminderAt: "2026-07-28T12:00:00.000Z", reminderText: "Follow up with the program.", source: "student_reported" } : undefined,
    }],
  };
}

async function seed(label: string, mode: "empty" | "rich" | "heavy" | "alternate", pro = false) {
  const { opportunities } = await import("../data/opportunities");
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const career = opportunities.filter((item) => item.type === "Career");
  const research = opportunities.filter((item) => item.type === "Research");
  const scholarships = opportunities.filter((item) => item.type === "Scholarship");
  const selected = mode === "empty" ? [] : mode === "alternate" ? [career[8]] : mode === "heavy" ? opportunities.slice(0, 600) : [career[0], career[1], research[0], scholarships[0], scholarships[1], career[2]];
  const statuses: OpportunityTrackerStatus[] = ["Applying", "Submitted", "Interview", "Accepted", "Completed", "Rejected", "Saved"];
  const stageIds = ["preparing_application", "application_submitted", "research_interview", "awarded", "funds_received", "archived", "saved"];
  const tracker = Object.fromEntries(selected.map((item, index) => {
    if (mode === "heavy") {
      const active = index < 100;
      return [item.id, tracked(item.id, active ? statuses[index % 4] : index % 2 ? "Completed" : "Rejected", index)];
    }
    return [item.id, tracked(item.id, mode === "alternate" ? "Saved" : statuses[index], index, mode === "alternate" ? "saved" : stageIds[index], index === 0)];
  }));
  const user = await upsertUser({ googleSub: `journey-command-${label}`, email: `${label}@example.test`, name: `${label} Student` });
  await mergeAccountData(user.id, {
    profile: { firstName: label, schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2030", year: "First year", careerGoal: "Research", interests: "Research", onboardingCompletedAt: "2026-07-20T12:00:00.000Z" },
    onboardingComplete: true,
    activity: { viewed: [], saved: selected.map((item) => item.id), claimed: [], tracked: tracker },
    savedOpportunities: selected.map((item, index) => ({ opportunityId: item.id, savedAt: `2026-01-${String((index % 25) + 1).padStart(2, "0")}T12:00:00.000Z` })),
    tracker,
    preferences: { appearance: pro ? "midnight" : "light", updatedAt: "2026-07-20T12:00:00.000Z" },
  });
  if (pro) await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  const addCandidate = opportunities.find((item) => item.type === "Career" && !selected.some((selectedItem) => selectedItem.id === item.id));
  return { session: await createSession(user), title: selected[0]?.title ?? "", searchTitle: selected.at(-1)?.title ?? "", addTitle: addCandidate?.title ?? "" };
}

async function install(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1_000) + 3_600 }]);
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (request.resourceType() === "image" && new URL(request.url()).origin !== origin) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"/>' });
    return route.continue();
  });
}

function observe(page: Page, label: string) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("_vercel")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], `${label} emitted browser errors: ${errors.join(" | ")}`);
}

async function baseAssertions(page: Page, label: string) {
  const root = page.locator("[data-journey-command-center]");
  await root.waitFor({ state: "visible", timeout: 60_000 });
  assert.equal(await root.locator("h1").count(), 1);
  assert.equal((await root.locator("h1").textContent())?.trim(), "Journey");
  assert.equal(await root.getByText(/next step|horizon|roadmap|recommendation/i).count(), 0, `${label} must remain factual rather than advisory.`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label} created ${overflow}px horizontal overflow.`);
  const undersized = await root.locator("a:visible, button:visible, summary:visible, select:visible").evaluateAll((nodes) => nodes.flatMap((node) => {
    const box = (node as HTMLElement).getBoundingClientRect();
    return box.width < 44 || box.height < 44 ? [(node.textContent ?? node.getAttribute("aria-label") ?? "control").trim()] : [];
  }));
  assert.deepEqual(undersized, [], `${label} has undersized controls: ${undersized.join(", ")}`);
  return root;
}

async function assertJourneyCard(page: Page) {
  const trigger = page.getByRole("button", { name: "Create a Journey Card" });
  await trigger.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector('[data-journey-card-entry] [data-hydration-ready="true"]'));
  await trigger.click();
  const dialog = page.locator('dialog[aria-labelledby="journey-card-title"][open]');
  await dialog.waitFor({ state: "visible" });
  const artwork = dialog.locator("svg[data-journey-card-artwork]");
  const brandMark = artwork.locator('image[data-unlocked-brand-mark]');
  assert.equal(await brandMark.getAttribute("href"), "/brand/unlocked-mark.png", "Journey Card previews must use the canonical uploaded UnlockED mark.");
  assert.equal(await artwork.getAttribute("data-journey-card-layout"), "story");
  assert.equal(await artwork.getAttribute("width"), "1080");
  assert.equal(await artwork.getAttribute("height"), "1920");
  assert.doesNotMatch(await artwork.textContent() ?? "", /Private command-center note/, "Journey Card output must never contain a private Journey note.");
  await dialog.screenshot({ path: path.join(output, "journey-card-preview.png"), caret: "initial" });
  await dialog.getByRole("button", { name: "Square" }).click();
  assert.equal(await artwork.getAttribute("width"), "1080");
  assert.equal(await artwork.getAttribute("height"), "1080");
  await dialog.getByRole("button", { name: "LinkedIn" }).click();
  assert.equal(await artwork.getAttribute("width"), "1200");
  assert.equal(await artwork.getAttribute("height"), "627");
  await dialog.getByRole("button", { name: "Story" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download PNG" }).click(),
  ]);
  assert.equal(download.suggestedFilename(), "unlocked-journey-card-story.png");
  const downloadedPath = await download.path();
  assert.ok(downloadedPath, "Journey Card export must produce a PNG file.");
  copyFileSync(downloadedPath!, path.join(output, "journey-card-export.png"));
  await dialog.getByRole("button", { name: "Close Journey Card creator" }).click();
  assert.equal(await trigger.evaluate((node) => document.activeElement === node), true, "Closing the Journey Card builder must restore focus.");
}

const kv = createKvServer();
const kvPort = await listen(kv);
process.env.AUTH_SECRET = "journey-command-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "journey-command-browser-token";
const port = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${port}`;
const rich = await seed("Rich", "rich");
const heavy = await seed("Heavy", "heavy");
const empty = await seed("Empty", "empty");
const alternate = await seed("Alternate", "alternate", true);
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, port);
const origin = `http://127.0.0.1:${port}`;
mkdirSync(output, { recursive: true });
const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
let failure: unknown;
try {
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
    await install(context, origin, rich.session.token);
    const page = await context.newPage();
    const noErrors = observe(page, "Chromium desktop");
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    const root = await baseAssertions(page, "Chromium desktop");
    assert.ok(await root.locator("[aria-label='Journey overview'] > *").count() >= 1);
    assert.ok(await root.locator("[aria-label='Journey overview'] > *").count() <= 4);
    assert.ok(await root.locator("[data-journey-record]").count() >= 4);
    assert.ok(await root.getByRole("heading", { name: /Things to do/ }).count() <= 1);
    const firstRecord = root.locator("[data-journey-record]").filter({ hasText: rich.title }).first();
    await firstRecord.locator(`summary[aria-label="More actions and details for ${rich.title}"]`).click();
    await firstRecord.getByRole("paragraph").filter({ hasText: "Private command-center note." }).waitFor();
    await firstRecord.getByRole("button", { name: "Update", exact: true }).click();
    const dialog = page.locator("dialog[data-journey-update-dialog][open]");
    await dialog.waitFor({ state: "visible" });
    await dialog.getByText("Choose a different stage", { exact: true }).click();
    await dialog.getByText("Application submitted", { exact: true }).click();
    await dialog.getByRole("button", { name: "Save milestone" }).click();
    await dialog.getByText("Progress recorded", { exact: true }).waitFor();
    assert.equal(await dialog.locator("[data-milestone-celebration]").count(), 0, "Application submission must not trigger confetti.");
    await dialog.getByRole("button", { name: "Return to Journey" }).click();
    await page.getByText("Application submitted", { exact: true }).first().waitFor();
    const interviewRecord = root.locator('[data-journey-record][data-stage="interviewing"]').first();
    await interviewRecord.getByRole("button", { name: "Update", exact: true }).click();
    const milestoneDialog = page.locator("dialog[data-journey-update-dialog][open]");
    await milestoneDialog.getByText("Accepted", { exact: true }).first().click();
    await milestoneDialog.getByRole("button", { name: "Save milestone" }).click();
    await milestoneDialog.getByText("A defining milestone", { exact: true }).waitFor();
    await milestoneDialog.locator("[data-milestone-celebration]").waitFor({ state: "attached" });
    assert.equal(await milestoneDialog.locator("[data-journey-update-confirmation][aria-live='polite']").count(), 1, "Confirmed milestones need a restrained screen-reader announcement.");
    assert.equal(await milestoneDialog.locator("[data-milestone-celebration][aria-hidden='true']").count(), 1, "Decorative celebration particles must stay outside the accessibility tree.");
    assert.equal(await milestoneDialog.getByRole("link", { name: "Create Journey Card" }).count(), 1);
    await milestoneDialog.getByRole("button", { name: "Return to Journey" }).click();
    await page.locator('summary[aria-label="Search Journey"]').click();
    await page.locator("input#journey-search").fill(rich.searchTitle);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForURL(/q=/);
    await page.locator("[data-journey-command-center] [data-journey-record]").first().waitFor({ state: "visible" });
    assert.ok(await page.locator("[data-journey-record]").count() >= 1);
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.locator("[data-journey-command-center]").waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(output, "journey-command-desktop.png"), fullPage: true, caret: "initial" });
    await assertJourneyCard(page);
    const [exportDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export data" }).click(),
    ]);
    const exportPath = await exportDownload.path();
    assert.ok(exportPath, "Journey data export must create a downloadable file.");
    const exported = readFileSync(exportPath!, "utf8");
    assert.match(exported, /Private command-center note/);
    assert.doesNotMatch(exported, /@example\.test/, "Journey export must not expose the account email.");
    await page.getByRole("button", { name: "Add opportunity" }).click();
    const addDialog = page.locator("dialog").filter({ has: page.getByRole("heading", { name: "Add an opportunity" }) });
    await addDialog.waitFor({ state: "visible" });
    await addDialog.getByLabel("Search the opportunity catalog").fill(rich.addTitle);
    await addDialog.getByRole("button", { name: "Search", exact: true }).click();
    await addDialog.getByText(rich.addTitle, { exact: true }).waitFor();
    await addDialog.getByText(rich.addTitle, { exact: true }).click();
    await addDialog.getByLabel("Starting stage").selectOption("applied");
    await addDialog.getByRole("button", { name: "Add to Journey" }).click();
    await addDialog.waitFor({ state: "hidden" });
    await page.goto(`${origin}/?q=${encodeURIComponent(rich.addTitle)}`, { waitUntil: "domcontentloaded" });
    const addedRecord = page.locator("[data-journey-record]").filter({ hasText: rich.addTitle }).first();
    await addedRecord.waitFor({ state: "visible" });
    await addedRecord.locator('span[data-stage="applied"]').filter({ hasText: "Application submitted" }).waitFor();
    await page.getByRole("button", { name: "Add opportunity" }).click();
    await addDialog.getByLabel("Search the opportunity catalog").fill(rich.addTitle);
    await addDialog.getByRole("button", { name: "Search", exact: true }).click();
    await addDialog.getByText("Already in Journey", { exact: true }).waitFor();
    await addDialog.getByRole("button", { name: "Close Add opportunity" }).click();
    noErrors();
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 640, height: 450 }, reducedMotion: "reduce" });
    await install(context, origin, rich.session.token);
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await baseAssertions(page, "Chromium 200% effective zoom");
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 820, height: 1180 }, reducedMotion: "reduce" });
    await install(context, origin, heavy.session.token);
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    const root = await baseAssertions(page, "Chromium heavy tablet");
    assert.equal(await root.locator("[data-journey-record]").count(), 30, "Initial render must include 6 active and only 24 historical records.");
    assert.equal(await root.getByText("500 records", { exact: true }).count() >= 1, true);
    await root.getByText("500 records", { exact: true }).click();
    await root.getByText("View all history", { exact: true }).waitFor();
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    assert.ok(pageHeight < 55_000, `Bounded initial Journey should avoid an excessive page height; received ${pageHeight}px.`);
    await context.close();
  }
  {
    const context = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await install(context, origin, alternate.session.token);
    const page = await context.newPage();
    const noErrors = observe(page, "WebKit mobile dark");
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    const root = await baseAssertions(page, "WebKit mobile dark");
    assert.equal(await root.getAttribute("data-theme"), "dark");
    const record = root.locator("[data-journey-record]").first();
    await page.screenshot({ path: path.join(output, "journey-command-mobile.png"), fullPage: true, caret: "initial" });
    await record.locator("summary[aria-label^='More actions and details']").press("Enter");
    await record.getByText("Public listing", { exact: true }).waitFor();
    await record.locator("summary[aria-label^='More actions and details']").press("Enter");
    await record.getByRole("button", { name: "Update", exact: true }).click();
    const reducedDialog = page.locator("dialog[data-journey-update-dialog][open]");
    await reducedDialog.getByText("Choose a different stage", { exact: true }).click();
    await reducedDialog.getByText("Offer received", { exact: true }).click();
    await reducedDialog.getByRole("button", { name: "Save milestone" }).click();
    await reducedDialog.getByText("A defining milestone", { exact: true }).waitFor();
    assert.equal(await reducedDialog.locator("[data-milestone-celebration]").count(), 0, "Reduced motion must suppress confetti code while retaining success text.");
    noErrors();
    await context.close();
  }
  {
    const context = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 900 } });
    await install(context, origin, empty.session.token);
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    const root = await baseAssertions(page, "Chromium empty");
    await root.getByRole("heading", { name: "Keep track of the opportunities you care about." }).waitFor();
    assert.equal(await root.locator("[aria-label='Journey overview']").count(), 0);
    assert.equal(await root.getByRole("link", { name: /Explore Discover/ }).count(), 1);
    assert.equal(await root.getByRole("link", { name: "View For You" }).count(), 1);
    await context.close();
  }
  console.log("Journey command-center browser checks passed", { browsers: ["Chromium", "WebKit"], datasets: ["empty", "rich", "100-active", "500-history"], viewports: ["desktop", "tablet", "mobile", "200%-effective-zoom"], screenshots: output });
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
  console.error("Journey command-center browser checks failed", failure);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
