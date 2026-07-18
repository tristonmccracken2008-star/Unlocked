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

assert.match(advisorRoute, /const session = await requireCompletedOnboarding\(\)/, "The For You route must authenticate and verify onboarding on the server.");
assert.match(advisorRoute, /resolveForYouState\(session\.user, session\.data, \{ allowGeneration: false \}\)/, "The route should reuse safe existing state without starting recommendation generation.");
assert.match(advisorRoute, /await import\("@\/lib\/for-you-snapshot"\)/, "The route must not initialize the full recommendation stack for users whose server state can be resolved without it.");
assert.match(advisorRoute, /if \(!entitlements\.canUseFullForYou\)/, "Free and incomplete For You states should be resolved before loading the Pro recommendation stack.");
assert.match(advisorRoute, /serverState\.pageState === "preparing" \? null : serverState/, "Missing snapshots must preserve the immediate client generation path.");
assert.match(advisorRoute, /<AdvisorPage initialState=\{initialState\} serverAuthenticated \/>/, "The client must begin from server-authenticated reusable state when available.");
assert.match(api, /resolveForYouState/, "The API route must reuse the snapshot resolver.");
assert.doesNotMatch(api, /buildRecommendationService/, "The API route must not generate the feed directly on normal page navigation.");
assert.match(snapshot, /buildRecommendationService/, "Snapshot generation must be the only For You path that builds recommendations.");

assert.match(snapshot, /latestSnapshot\(data, user\.id\)/, "Resolver must check for an existing user-specific snapshot first.");
assert.match(snapshot, /isForYouSnapshotCompatible\(snapshot, version, user\.id\)/, "Resolver must reject snapshots from incompatible users, profiles, engines, schemas, catalogs, or rules.");
assert.match(snapshot, /snapshotPassesSafetyAudit\(snapshot, profile, school, activity, data\)/, "Every persisted snapshot must pass the current final eligibility audit before rendering.");
assert.match(snapshot, /isFresh\(compatibleSnapshot\)/, "Resolver must distinguish fresh compatible snapshots.");
assert.match(snapshot, /stateFromSnapshot\(compatibleSnapshot, access, entitlements, profile, school, activity, "stale", true\)/, "Resolver may return only expired but compatible and re-audited snapshots while refreshing.");
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
assert.match(advisorTypes, /eligibilitySchemaVersion: string/, "Snapshots must record the eligibility schema version.");
assert.match(advisorTypes, /catalogVersion: string/, "Snapshots must record the catalog version.");
assert.match(advisorTypes, /recommendationRulesVersion: string/, "Snapshots must record the recommendation-rules version.");
assert.match(snapshot, /\[UnlockED For You\] empty feed diagnostics/, "Empty paid feeds must log aggregate diagnostics.");
assert.match(snapshot, /buildRecommendationCandidateFunnel/, "Empty-feed diagnostics must use the canonical candidate funnel.");
assert.match(snapshot, /lastAvailableStage/, "Empty-feed diagnostics must record the last stage with viable candidates.");
assert.match(snapshot, /fallbackAttempted: funnel\.fallbackAttempted/, "Empty-feed diagnostics must record whether the safe fallback was attempted.");

assert.match(advisorPage, /serverAuthenticated \? "authenticated" : "checking"/, "Client must trust the completed server route gate without warming the session API first.");
assert.match(advisorPage, /serverAuthenticated \? "server-authenticated" : ""/, "The initial recommendation request must have a stable server-authenticated request key.");
assert.match(advisorPage, /ForYouPreparingState/, "Client must show preparing recommendations instead of treating first generation as an error.");
assert.match(advisorPage, /state\?\.isRefreshing/, "Client must keep stale recommendations visible while refreshing.");
assert.match(advisorPage, /pageState !== "preparing" && !state\?\.isRefreshing/, "Client polling must be tied to preparing/stale-refresh states.");
assert.match(advisorPage, /lastValidResponse = useRef[\s\S]*\(initial \?\? null\)/, "Client must keep the last valid recommendations visible while polling.");
assert.doesNotMatch(advisorPage, /useEffect\(\(\) => \{\s*void loadForYou\(\);/, "Client must not fetch recommendations before server authentication is known.");

assert.match(authStore, /kvTimeoutMs = 2800/, "KV reads must be bounded under the server hard timeout.");
assert.match(authStore, /attempt <= 2/, "KV operations must not retry indefinitely.");
assert.match(pkg, /"check:for-you-first-request"/, "Package scripts must expose the first-request architecture check.");

console.log("For You first-request architecture checks passed.");
