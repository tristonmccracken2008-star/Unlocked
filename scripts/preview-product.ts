// Disposable local preview. It never connects to the real account database.
import http from "node:http";
import next from "next";
import { opportunities } from "../data/opportunities";

const values = new Map<string, unknown>();
const kv = http.createServer(async (req, res) => {
  const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const args = JSON.parse(Buffer.concat(chunks).toString()) as unknown[];
  const [op, key, value] = args; let result: unknown = null;
  if (op === "GET") result = values.get(String(key)) ?? null;
  if (op === "SET" && (!args.includes("NX") || !values.has(String(key)))) { values.set(String(key), value); result = "OK"; }
  if (op === "DEL") result = Number(values.delete(String(key)));
  if (op === "EVAL") { if (String(key).includes("INCR")) result = 1; else { values.delete(String(args[3])); result = 1; } }
  if (["SMEMBERS", "LRANGE", "ZREVRANGE", "ZRANGEBYSCORE"].includes(String(op))) result = [];
  res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ result }));
});
await new Promise<void>((resolve) => kv.listen(4398, "127.0.0.1", resolve));
process.env.AUTH_SECRET = "local-product-preview-fixture-only-secret";
process.env.KV_REST_API_URL = "http://127.0.0.1:4398";
process.env.KV_REST_API_TOKEN = "local-preview";
process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:4398";
process.env.UPSTASH_REDIS_REST_TOKEN = "local-preview";
process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:4399";
const { upsertUser, mergeAccountData, createSession, updateAccountBilling, updateEducationalStage } = await import("../lib/auth-store");
const user = await upsertUser({ googleSub: "local-preview", email: "preview@example.test", name: "Avery Chen" });
await updateEducationalStage(user.id, "undergraduate");
const now = new Date().toISOString();
const selected = opportunities.filter((o) => o.type === "Research" || o.type === "Career").slice(0, 6);
const tracker = Object.fromEntries(selected.map((o, i) => [o.id, { id: o.id, status: i < 3 ? "Applying" as const : "Saved" as const, savedAt: now, updatedAt: now, version: 0, history: [] }]));
await mergeAccountData(user.id, { profile: { firstName: "Avery", lastName: "Chen", schoolSlug: "university-of-chicago", schoolName: "University of Chicago", major: "Mathematics", secondaryMajor: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Quantitative research", interests: "Statistics, research", onboardingCompletedAt: now }, onboardingComplete: true, firstLaunchComplete: true, tracker, activity: { viewed: [], saved: selected.map((o) => o.id), claimed: [], tracked: tracker }, accomplishments: { "manual:project": { id: "manual:project", source: "manual", snapshot: { title: "Campus energy research", organization: "Student research group", capturedAt: now }, kind: "project", outcome: "completed", outcomeDate: "2026-08-20", skills: ["Python", "Data analysis"], description: "Analyzed campus energy use and presented findings to a student research group.", hidden: false, createdAt: now, updatedAt: now, version: 0 } } });
await updateAccountBilling(user.id, { tier: "pro", status: "active" });
const session = await createSession(user);
const newUser = await upsertUser({ googleSub: "local-stage-preview", email: "stage-preview@example.test", name: "Jordan Lee" });
const newUserSession = await createSession(newUser);
const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1", port: 4399 }); await app.prepare();
http.createServer((req, res) => {
  if (req.url === "/__preview") { res.writeHead(302, { "Set-Cookie": `unlocked_session=${session.token}; Path=/; HttpOnly; SameSite=Lax`, Location: "/opportunities" }); res.end(); return; }
  if (req.url === "/__preview-onboarding") { res.writeHead(302, { "Set-Cookie": `unlocked_session=${newUserSession.token}; Path=/; HttpOnly; SameSite=Lax`, Location: "/onboarding" }); res.end(); return; }
  void app.getRequestHandler()(req, res);
}).listen(4399, "127.0.0.1", () => console.log("Local sample account preview: http://127.0.0.1:4399/__preview"));
