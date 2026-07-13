import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const advisorRoute = read("app/advisor/page.tsx");
const advisorPage = read("components/advisor-page.tsx");
const api = read("app/api/advisor/for-you/route.ts");
const snapshot = read("lib/for-you-snapshot.ts");
const advisorTypes = read("lib/advisor/types.ts");
const authStore = read("lib/auth-store.ts");
const advisorApi = read("lib/advisor/api.ts");
const pkg = read("package.json");

assert.match(advisorTypes, /ForYouRecommendationSnapshot/, "For You snapshots must have a persisted account-data model.");
assert.match(advisorTypes, /userId: string/, "Snapshots must be scoped to one user.");
assert.match(advisorTypes, /profileVersion: string/, "Snapshots must record a deterministic profile/source version.");
assert.match(advisorTypes, /sourceSignalsVersion: string/, "Snapshots must record the opportunity source version.");
assert.match(advisorTypes, /recommendations: RecommendationViewModel\[\]/, "Snapshots must store safe serialized For You view models.");
assert.match(authStore, /forYouSnapshots: Array\.isArray\(value\.forYouSnapshots\)/, "Account normalization must preserve For You snapshots.");
assert.match(advisorApi, /forYouSnapshots: \[\.\.\.\(existing\.forYouSnapshots \?\? \[\]\), \.\.\.\(patch\.forYouSnapshots \?\? \[\]\)\]\.slice\(-3\)/, "Advisor data writes must append For You snapshots without replacing unrelated advisor data.");

assert.match(advisorRoute, /const initialState = await resolveForYouState\(session\.user, session\.data\)/, "The For You route must resolve the first page state on the server.");
assert.match(advisorRoute, /<AdvisorPage initialState=\{initialState\}/, "The client must receive server-resolved initial state.");
assert.match(api, /resolveForYouState/, "The API route must reuse the snapshot resolver.");
assert.doesNotMatch(api, /buildRecommendationService/, "The API route must not generate the feed directly on normal page navigation.");
assert.match(snapshot, /buildRecommendationService/, "Snapshot generation must be the only For You path that builds recommendations.");

assert.match(snapshot, /latestSnapshot\(data, user\.id\)/, "Resolver must check for an existing user-specific snapshot first.");
assert.match(snapshot, /isFresh\(snapshot, version\)/, "Resolver must distinguish fresh snapshots.");
assert.match(snapshot, /stateFromSnapshot\(snapshot, access, entitlements, profile, school, activity, "stale", true\)/, "Resolver must return stale snapshots immediately.");
assert.match(snapshot, /isRefreshing: true/, "Stale snapshots must report background refresh.");
assert.match(snapshot, /pageState: "preparing"/, "Missing snapshots must return an intentional preparing state.");
assert.match(snapshot, /generationByUser = new Map<string, Promise<ForYouRecommendationSnapshot>>/, "Generation must be single-flight per user.");
assert.match(snapshot, /generationByUser\.get\(user\.id\)/, "Concurrent requests must reuse the active user generation.");
assert.match(snapshot, /generationByUser\.delete\(user\.id\)/, "Failed or completed generation promises must be cleared.");
assert.match(snapshot, /withTimeout\(generateSingleFlight\(user, data, profile, school, entitlements\), "initial recommendation snapshot", generationTimeoutMs\)/, "Initial generation must be bounded.");
assert.match(snapshot, /withTimeout\(active, "active recommendation snapshot"/, "Concurrent missing-snapshot requests must wait only briefly.");
assert.match(snapshot, /entitlements\.canUseFullForYou/, "Pro and Free states must be decided server-side.");
assert.match(snapshot, /const allowed = pro \? service\.recommendations\.slice\(0,\s*8\) : \[\]/, "Free users must not require expensive preview generation and Pro should prioritize a short precision-first feed.");
assert.match(snapshot, /getForYouGlobalIndex/, "Global opportunity indexes must be initialized through a shared helper.");
assert.match(snapshot, /globalIndexPromise/, "Global index initialization must be single-flight.");
assert.match(snapshot, /sourceSignalsVersion/, "Opportunity database changes must affect snapshot freshness.");

assert.match(advisorPage, /initialState \? normalizeForYouPayload\(initialState\) : null/, "Client must render from the server snapshot state immediately.");
assert.match(advisorPage, /ForYouPreparingState/, "Client must show preparing recommendations instead of treating first generation as an error.");
assert.match(advisorPage, /state\?\.isRefreshing/, "Client must keep stale recommendations visible while refreshing.");
assert.match(advisorPage, /pageState !== "preparing" && !state\?\.isRefreshing/, "Client polling must be tied to preparing/stale-refresh states.");
assert.match(advisorPage, /lastValidResponse = useRef[\s\S]*\(initial \?\? null\)/, "Client must keep server-provided stale recommendations visible while polling.");
assert.doesNotMatch(advisorPage, /useEffect\(\(\) => \{\s*void loadForYou\(\);/, "Client must not immediately fetch recommendations before the server state renders.");

assert.match(authStore, /kvTimeoutMs = 2800/, "KV reads must be bounded under the server hard timeout.");
assert.match(authStore, /attempt <= 2/, "KV operations must not retry indefinitely.");
assert.match(pkg, /"check:for-you-first-request"/, "Package scripts must expose the first-request architecture check.");

console.log("For You first-request architecture checks passed.");
