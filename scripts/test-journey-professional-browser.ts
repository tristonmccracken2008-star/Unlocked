import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import next from "next";
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "playwright";
import { opportunities, type Opportunity } from "../data/opportunities";
import { getJourneyProfessionalWorkflow, type JourneyWorkflowKind } from "../data/journey-professional";
import type { TrackedOpportunity } from "../data/student-activity";

type StoredValue = { value: unknown; expiresAt?: number };
const store = new Map<string, StoredValue>();
const outputDirectory = path.join("/tmp", "unlocked-journey-professional");

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
      if (String(command[1]).includes("INCR")) {
        const current = Number(liveValue(key)?.value ?? 0) + 1;
        store.set(key, { value: current, expiresAt: Date.now() + Number(command[4]) * 1000 });
        result = current;
      } else if (liveValue(key)?.value === command[4]) { store.delete(key); result = 1; } else result = 0;
    } else if (operation === "SMEMBERS" || operation === "LRANGE") result = [];
    else if (operation === "SADD" || operation === "LPUSH") result = 1;
    else if (operation === "LTRIM") result = "OK";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ result }));
  });
}

function workflowOpportunities() {
  const values: Record<JourneyWorkflowKind, Opportunity | undefined> = {
    career: opportunities.find((item) => item.type === "Career" && /internship/i.test(`${item.category} ${item.title}`)) ?? opportunities.find((item) => item.type === "Career"),
    scholarship: opportunities.find((item) => item.type === "Scholarship"),
    research: opportunities.find((item) => item.type === "Research"),
    competition: opportunities.find((item) => /competition|challenge|hackathon/i.test(`${item.category} ${item.title}`)),
    resource: opportunities.find((item) => item.type === "Benefit") ?? opportunities.find((item) => item.type === "AI"),
  };
  for (const [kind, opportunity] of Object.entries(values)) assert.ok(opportunity, `A ${kind} fixture is required.`);
  return values as Record<JourneyWorkflowKind, Opportunity>;
}

async function seedSession(kind: JourneyWorkflowKind, opportunity: Opportunity, suffix = "desktop", dark = false) {
  const { createSession, mergeAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
  const record: TrackedOpportunity = { id: opportunity.id, status: "Saved", savedAt: "2026-07-21T12:00:00.000Z", updatedAt: "2026-07-21T12:00:00.000Z", version: 0, history: [] };
  const user = await upsertUser({ googleSub: `journey-professional-${kind}-${suffix}`, email: `${kind}-${suffix}@example.test`, name: `Jordan ${kind}` });
  await mergeAccountData(user.id, {
    profile: { firstName: "Jordan", schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2030", year: "First year", careerGoal: "Research", interests: "Research, Finance", onboardingCompletedAt: "2026-07-21T12:00:00.000Z" },
    onboardingComplete: true,
    tracker: { [record.id]: record },
    activity: { viewed: [], saved: [record.id], claimed: [], tracked: { [record.id]: record } },
    savedOpportunities: [{ opportunityId: record.id, savedAt: record.savedAt }],
    preferences: { appearance: dark ? "forest" : "light", updatedAt: "2026-07-21T12:00:00.000Z" },
  });
  if (dark) await updateAccountBilling(user.id, { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false });
  return { session: await createSession(user), opportunity };
}

async function installSession(context: BrowserContext, origin: string, token: string) {
  await context.addCookies([{ name: "unlocked_session", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 }]);
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (request.resourceType() === "image" && new URL(request.url()).origin !== origin) {
      await route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"/>' });
      return;
    }
    await route.continue();
  });
}

function watchConsole(page: Page, label: string) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !/favicon|ERR_ABORTED/i.test(message.text())) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], `${label} emitted browser errors: ${errors.join(" | ")}`);
}

async function verifyWorkflow(browser: Browser, origin: string, fixture: Awaited<ReturnType<typeof seedSession>>, kind: JourneyWorkflowKind, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, reducedMotion: mobile ? "reduce" : "no-preference" });
  await installSession(context, origin, fixture.session.token);
  const page = await context.newPage();
  const assertNoErrors = watchConsole(page, `${browser.browserType().name()} ${kind}`);
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  const trigger = page.getByRole("button", { name: "Update Journey" }).first();
  await trigger.waitFor({ state: "visible" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator("dialog[data-journey-update-dialog][open]");
  await dialog.waitFor({ state: "visible" });
  const workflow = getJourneyProfessionalWorkflow(fixture.opportunity);
  const renderedStages = await dialog.locator('ol[aria-label$="stages"] li p').allTextContents();
  assert.deepEqual(renderedStages, workflow.stages.filter((item) => item.id !== "archived").map((stage) => stage.label));
  assert.equal(await dialog.locator("select").count(), 0, "Update Journey must never expose a plain status dropdown.");
  assert.equal(await dialog.getByText("Saved", { exact: true }).first().count(), 1);
  const target = workflow.stages[1];
  await dialog.getByText(target.label, { exact: true }).last().waitFor({ state: "visible" });
  if (kind === "career") {
    await dialog.getByText("Add private details").click();
    await dialog.getByLabel("Notes").fill("Recorded during browser validation.");
    await dialog.getByLabel("Milestone date").fill("2026-07-22");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "application.pdf", mimeType: "application/pdf", buffer: Buffer.from("private fixture") });
    await dialog.screenshot({ path: path.join(outputDirectory, "update-journey-form.png") });
  }
  let requestCount = 0;
  page.on("request", (request) => { if (request.url().includes("/api/journey/transition")) requestCount += 1; });
  const save = dialog.getByRole("button", { name: "Save milestone" });
  if (kind === "career") await save.evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  else await save.click();
  const confirmation = dialog.locator("[data-journey-update-confirmation]");
  await confirmation.waitFor({ state: "visible", timeout: 15_000 });
  await confirmation.getByText(target.milestoneTitle, { exact: true }).waitFor({ state: "visible" });
  await confirmation.getByText("Updated by you", { exact: true }).waitFor({ state: "visible" });
  await confirmation.getByText(workflow.stages[0].label, { exact: true }).waitFor({ state: "visible" });
  await confirmation.getByText(target.label, { exact: true }).waitFor({ state: "visible" });
  assert.equal(requestCount, 1, "Duplicate clicks must produce one Journey mutation.");
  const persisted = await page.evaluate(async (opportunityId) => {
    const response = await fetch("/api/account/data", { cache: "no-store" });
    const body = await response.json();
    return body.data.tracker[opportunityId];
  }, fixture.opportunity.id) as TrackedOpportunity;
  assert.equal(persisted.professionalStageId, target.id);
  assert.equal(persisted.history?.at(-1)?.details?.source, "student_reported");
  if (kind === "career") {
    assert.equal(persisted.history?.at(-1)?.details?.notes, "Recorded during browser validation.");
    assert.deepEqual(persisted.history?.at(-1)?.details?.documents?.map((item) => [item.name, item.stored]), [["application.pdf", false]]);
    await dialog.screenshot({ path: path.join(outputDirectory, "update-journey-confirmation.png") });
  }
  if (mobile) {
    const box = await dialog.boundingBox();
    assert.ok(box && box.width >= 389 && box.height >= 843, "Mobile Update Journey must use the full viewport.");
    assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
  }
  await confirmation.getByRole("button", { name: "Return to Journey" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText(target.milestoneTitle, { exact: true }).first().waitFor({ state: "visible", timeout: 15_000 });
  await page.getByRole("heading", { name: "Your record, year by year." }).waitFor({ state: "visible" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${kind} Journey created ${overflow}px horizontal overflow.`);
  assertNoErrors();
  await context.close();
}

await mkdir(outputDirectory, { recursive: true });
const kvServer = createKvServer();
const kvPort = await listen(kvServer);
process.env.AUTH_SECRET = "journey-professional-browser-secret-with-at-least-thirty-two-bytes";
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvPort}`;
process.env.KV_REST_API_TOKEN = "journey-professional-browser-token";
const appPort = await freePort();
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
const fixtures = workflowOpportunities();
const sessionEntries: Array<[JourneyWorkflowKind, Awaited<ReturnType<typeof seedSession>>]> = [];
for (const kind of Object.keys(fixtures) as JourneyWorkflowKind[]) sessionEntries.push([kind, await seedSession(kind, fixtures[kind], "desktop", kind === "research")]);
const sessions = Object.fromEntries(sessionEntries) as Record<JourneyWorkflowKind, Awaited<ReturnType<typeof seedSession>>>;
const mobile = await seedSession("scholarship", fixtures.scholarship, "mobile");
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: appPort });
await app.prepare();
const server = http.createServer((request, response) => app.getRequestHandler()(request, response));
await listen(server, appPort);
const origin = `http://127.0.0.1:${appPort}`;
const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({ headless: true });
try {
  for (const kind of Object.keys(sessions) as JourneyWorkflowKind[]) await verifyWorkflow(chromiumBrowser, origin, sessions[kind], kind);
  await verifyWorkflow(webkitBrowser, origin, mobile, "scholarship", true);
} finally {
  await chromiumBrowser.close();
  await webkitBrowser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await new Promise<void>((resolve) => kvServer.close(() => resolve()));
}

console.log(JSON.stringify({ message: "Journey professional browser checks passed.", workflows: Object.keys(sessions), browsers: ["Chromium", "WebKit"], viewports: ["1280x900", "390x844"], screenshot: outputDirectory }, null, 2));
process.exit(0);
