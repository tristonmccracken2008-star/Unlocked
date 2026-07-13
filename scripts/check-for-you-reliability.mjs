import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const advisor = read("components/advisor-page.tsx");
const api = read("app/api/advisor/for-you/route.ts");
const snapshot = read("lib/for-you-snapshot.ts");
const authStore = read("lib/auth-store.ts");
const analytics = read("lib/analytics-types.ts");
const pkg = read("package.json");

assert.match(advisor, /type SessionReadiness = "checking" \| "authenticated" \| "unauthenticated" \| "error"/, "For You must model session readiness explicitly.");
assert.match(advisor, /readAccountSession\(true\)/, "For You must confirm the current account session before loading recommendations.");
assert.match(advisor, /accountSessionEvent/, "For You must react to account session changes.");
assert.match(advisor, /sessionReadiness !== "authenticated"/, "For You must gate recommendation loading until the session is authenticated.");
assert.match(advisor, /activeRequestKey/, "For You must dedupe in-flight recommendation requests.");
assert.match(advisor, /requestId\.current !== currentRequest \|\| \(sessionKey\.current && sessionKey\.current !== targetSessionKey\)/, "For You must ignore stale responses and account-switch races.");
assert.match(advisor, /lastValidResponse/, "For You must preserve the last valid response if a refresh fails.");
assert.match(advisor, /transientForYouStatus/, "For You must identify transient server failures.");
assert.match(advisor, /for_you_auto_retry/, "For You must track the single automatic retry path.");
assert.match(advisor, /attempt === 0/, "For You automatic retry must be capped to one retry.");
assert.match(advisor, /disabled=\{retrying\}/, "For You retry control must be disabled while a request is active.");
assert.doesNotMatch(advisor, /useEffect\(\(\) => \{\s*void loadForYou\(\);/, "For You must not fetch recommendations immediately on mount before session readiness.");

assert.match(api, /nextRequestId/, "For You API must assign a safe request ID to each request.");
assert.match(api, /requestId/, "For You API logs must include request IDs.");
assert.match(api, /coldStart/, "For You API must distinguish cold-start requests in logs.");
assert.match(snapshot, /getForYouGlobalIndex/, "For You snapshot generation must precompute user-independent recommendation indexes.");
assert.match(snapshot, /globalIndexPromise/, "For You global index warmup must be deduped.");
assert.match(api, /global indexes complete/, "For You API must checkpoint global index readiness.");
assert.match(snapshot, /withTimeout\(getForYouGlobalIndex\(\), "global recommendation index", globalIndexTimeoutMs\)/, "For You must bound global index initialization.");
assert.match(api, /response complete/, "For You API must log total completion in a finally block.");

assert.match(authStore, /kvTimeoutMs = 2800/, "KV operation timeout should fit inside the For You server hard limit even with one retry.");
assert.match(authStore, /kvRetryDelayMs/, "KV operations should use a short bounded retry delay.");
assert.match(authStore, /for \(let attempt = 1; attempt <= 2; attempt \+= 1\)/, "KV operations should retry at most once.");
assert.match(authStore, /shouldRetryKvCommand/, "KV retry behavior should be limited to transient failures.");
assert.match(authStore, /\[UnlockED store\] KV command retry/, "KV retries should be safely logged without keys or values.");

assert.match(analytics, /"for_you_auto_retry"/, "Analytics event allowlist must include for_you_auto_retry.");
assert.match(pkg, /"check:for-you-reliability"/, "Package scripts must expose the For You reliability check.");

console.log("For You first-load reliability checks passed.");
