import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSameOrigin, SecurityError } from "../lib/security";

process.env.AUTH_SECRET = "logout-regression-secret-with-sufficient-length";
process.env.NEXT_PUBLIC_APP_URL = "https://logout.unlocked.test";
const runId = crypto.randomUUID().replaceAll("-", "");

assert.doesNotThrow(() => assertSameOrigin(new Request("https://logout.unlocked.test/api/auth/logout", {
  method: "POST",
  headers: { "Sec-Fetch-Site": "same-origin" },
})), "A same-origin browser logout must pass CSRF protection.");
assert.doesNotThrow(() => assertSameOrigin(new Request("https://www.logout.unlocked.test/api/auth/logout", {
  method: "POST",
  headers: { Origin: "https://www.logout.unlocked.test", Referer: "https://www.logout.unlocked.test/profile", "Sec-Fetch-Site": "same-origin" },
})), "A legitimate production alias must be validated against the actual request target rather than a different configured canonical host.");
assert.throws(() => assertSameOrigin(new Request("https://logout.unlocked.test/api/auth/logout", {
  method: "POST",
  headers: { Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" },
})), (error: unknown) => error instanceof SecurityError && error.status === 403, "A cross-site logout forgery must remain blocked.");

const previousNodeEnv = process.env.NODE_ENV;
Reflect.set(process.env, "NODE_ENV", "production");
assert.throws(() => assertSameOrigin(new Request("https://logout.unlocked.test/api/auth/logout", { method: "POST" })), (error: unknown) => error instanceof SecurityError && error.code === "missing_origin", "A headerless production logout must remain blocked.");
if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);

const { createSession, getSession, revokeCurrentSession, upsertUser } = await import("../lib/auth-store");
const user = await upsertUser({ googleSub: `logout-${runId}`, email: `logout-${runId}@example.edu`, name: "Logout Test" });
const session = await createSession(user);
assert.ok(await getSession(session.token), "A newly persisted session must work on the first request.");
assert.equal(await revokeCurrentSession(session.token), "revoked", "Logout must revoke the active server-side session.");
assert.equal(await getSession(session.token), null, "A revoked session must stop authenticating immediately.");
assert.equal(await revokeCurrentSession(session.token), "already_revoked", "Repeated revocation must be idempotent.");
assert.equal(await revokeCurrentSession(undefined), "no_session", "A second browser logout without a cookie must be harmless.");
assert.equal(await revokeCurrentSession("invalid"), "invalid_session", "An invalid cookie must never revoke another session.");

const route = readFileSync("app/api/auth/logout/route.ts", "utf8");
const button = readFileSync("components/account-auth.tsx", "utf8");
const requestRegistry = readFileSync("data/authenticated-request.ts", "utf8");
const accountSync = readFileSync("data/account-sync.ts", "utf8");
assert.match(route, /export async function POST\(request: Request\)/, "Logout must use POST.");
assert.doesNotMatch(route, /export async function GET/, "GET must not mutate session state.");
assert.match(route, /assertSameOrigin\(request\)/, "Logout must enforce same-origin proof.");
assert.match(route, /revokeCurrentSession\(cookie\)/, "Logout must revoke the server-backed session.");
assert.match(route, /result === "invalid_session"[\s\S]*status: 401/, "Invalid session cookies must not be treated as authenticated logout.");
for (const attribute of ["httpOnly: true", 'sameSite: "lax"', 'path: "/"', "maxAge: 0", "expires: new Date(0)"]) {
  assert.ok(route.includes(attribute), `Cookie deletion must preserve ${attribute}.`);
}
assert.match(button, /Signing out…/, "The sign-out control must show immediate pending feedback.");
assert.match(button, /abortAuthenticatedRequests\(\)/, "Sign-out must abort in-flight user-specific requests.");
assert.match(button, /resetAccountSessionCache\(\)/, "Sign-out must clear the client session cache.");
assert.match(button, /clearLocalDashboardState\(\)/, "Sign-out must clear account-specific local state.");
assert.match(button, /window\.location\.replace\("\/"\)/, "Sign-out must replace private history with the public homepage.");
assert.match(button, /Sign out was blocked \(\$\{category\}\)\. Try again\./, "Rejected logout must expose a safe error category.");
assert.match(button, /new AbortController\(\)/, "Logout must own a fresh controller outside the authenticated-request registry.");
assert.match(requestRegistry, /activeControllers/, "Authenticated requests must share an abort registry.");
assert.match(accountSync, /studentProgressStorageKey/, "Logout cache clearing must include milestone and application state.");

console.log("Logout lifecycle regression checks passed.");
