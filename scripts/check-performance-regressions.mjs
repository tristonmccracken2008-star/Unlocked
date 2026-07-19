import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const globalSearchPath = new URL("../components/global-search.tsx", import.meta.url);
const globalSearch = existsSync(globalSearchPath) ? read("components/global-search.tsx") : "";
const header = read("components/header.tsx");
const discoverPage = read("app/opportunities/page.tsx");
const opportunityFilter = read("components/opportunity-filter.tsx");
const profilePage = read("components/profile-page.tsx");
const personalizedHome = read("components/personalized-home.tsx");
const accountSync = read("data/account-sync.ts");
const journeyTimeline = read("components/journey-timeline.tsx");
const journeyTimelineModel = read("lib/journey-timeline.ts");
const journeyDashboard = read("components/student-journey-dashboard.tsx");
const journeyPage = read("app/page.tsx");
const journeyEditorial = read("components/journey-editorial.tsx");
const journeyEditorialModel = read("lib/journey-editorial.ts");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const authStore = read("lib/auth-store.ts");
const recommendationEngine = read("data/recommendation-engine.ts");
const discoverCatalog = read("lib/discover-catalog.ts");
const opportunityApi = read("app/api/opportunities/route.ts");
const advisorRoute = read("app/advisor/page.tsx");

if (globalSearch) {
  assert.doesNotMatch(globalSearch, /opportunities as seedOpportunities/, "Global search must not statically import the full opportunity catalog.");
  assert.match(globalSearch, /view:"discover"/, "Global search should request a bounded server-side result window.");
  assert.match(globalSearch, /trimmed\.length<2/, "Global search must not issue catalog requests before the query is meaningful.");
  assert.match(globalSearch, /AbortController/, "Global search must cancel superseded requests.");
} else {
  assert.doesNotMatch(header, /GlobalSearch/, "The retired global search must not remain in the header bundle.");
}

assert.doesNotMatch(discoverPage, /listPublishedOpportunities/, "Discover must not serialize the full catalog through the route payload.");
assert.match(opportunityFilter, /view: "discover"/, "Discover should request only a bounded server-side result window.");
assert.match(opportunityFilter, /useDeferredValue/, "Discover search input should defer request work.");
assert.match(opportunityFilter, /AbortController/, "Discover must cancel superseded filter requests.");
assert.match(opportunityFilter, /ResultSkeleton/, "Discover should show stable skeleton rows while the catalog loads.");
assert.doesNotMatch(opportunityFilter, /buildRecommendationService/, "Discover must not build the Advisor recommendation index on the browser main thread.");
assert.doesNotMatch(opportunityFilter, /hydrateAccountData/, "Discover filters should not trigger account hydration or duplicate session work.");
assert.doesNotMatch(opportunityFilter, /import \{[^}]*filterOpportunities[^}]*\} from "@\/data\/opportunities"/, "Discover must not import the full catalog module at runtime.");
assert.match(discoverCatalog, /sorted\.slice\(0, query\.limit\)/, "Discover responses must remain bounded to the requested visible window.");
assert.match(opportunityApi, /listPublishedOpportunitiesByIds\(ids\)/, "Tracked-record API requests must not build the full catalog.");

assert.match(profilePage, /dynamic\(\(\) => import\("\.\/profile-career-tab"\)/, "Profile Career tab should remain split from the initial edit-profile bundle.");
assert.doesNotMatch(personalizedHome, /student-journey-dashboard/, "The public/onboarding shell must not pull the retired client Journey dashboard into the root bundle.");
assert.doesNotMatch(personalizedHome, /from "@\/data\/opportunities"/, "Landing/onboarding shell must not import the full opportunity catalog.");

assert.doesNotMatch(journeyTimeline, /from "@\/data\/opportunities"/, "Journey UI must not import the full catalog.");
assert.doesNotMatch(journeyTimelineModel, /buildRecommendationService|rankMilestoneRecommendations|createPathGeometry/, "Unified Journey must not execute recommendations or geometry work.");

assert.doesNotMatch(journeyDashboard, /import \{[^}]*opportunities,/, "Journey dashboard must not statically import the full opportunity catalog.");
assert.doesNotMatch(journeyDashboard, /buildRecommendationService/, "Journey dashboard must not bypass Pro gating with client-side recommendations.");
assert.doesNotMatch(journeyTimeline, /fetch\(|createPathGeometry/, "Journey timeline rendering must not fetch data or calculate geometry on the client.");
assert.match(journeyPage, /listPublishedOpportunitiesByIds\(trackedIds\)/, "Journey should load only the tracked opportunity records on the server.");
assert.match(journeyEditorialModel, /input\.opportunities\.filter\(\(opportunity\) => allTrackedIds\.has\(opportunity\.id\)\)/, "Journey composition must bound opportunity work to tracked records.");
assert.match(journeyDashboard, /router\.refresh\(\)/, "The client recovery bridge should refresh into the server-composed Journey.");
assert.doesNotMatch(journeyDashboard, /JourneyRecapCard|NextToReview/, "Journey dashboard should not load retired share/recommendation experiences.");

assert.match(accountSync, /let sessionRequest/, "Account session requests should be deduped.");
assert.match(accountSync, /if \(sessionRequest\) return sessionRequest/, "Forced hydration and normal session readers must share the same in-flight request.");
assert.match(accountSync, /let hydrateRequest/, "Account hydration requests should be deduped.");
assert.match(accountSync, /resetAccountSessionCache/, "Account session cache should be explicitly reset for account switching.");
assert.match(accountSync, /const cloudData = session\.data/, "Hydration should reuse session account data instead of fetching it again.");
assert.match(accountSync, /const saved = !sameAccountData\(merged, cloudData\) \? await pushAccountData\(merged\) : cloudData/, "Hydration should skip account writes when merged data has not changed.");
assert.doesNotMatch(accountSync, /!migrated \|\| !sameAccountData/, "A first hydration must not force an unchanged account write.");

assert.match(authStore, /kvTimeoutMs/, "Production KV operations should have a bounded timeout.");
assert.match(authStore, /AbortController/, "Production KV fetches should be abortable.");
assert.match(forYouApi, /serverTimeoutMs/, "For You should have a server-side hard failure bound.");
assert.match(forYouApi, /lastCheckpoint/, "For You should log the last completed checkpoint on failure.");
assert.match(advisorRoute, /resolveForYouState\(session\.user, session\.data, \{ allowGeneration: false \}\)/, "For You should server-render reusable state without blocking on recommendation generation.");
assert.match(advisorRoute, /await import\("@\/lib\/for-you-snapshot"\)/, "For You should defer the full recommendation stack until Pro state requires it.");
assert.match(advisorRoute, /serverState\.pageState === "preparing" \? null : serverState/, "Missing snapshots must fall through to the existing bounded client generation path.");
assert.match(recommendationEngine, /selected\.map\(\(item\) => toOpportunityRecommendation\(profile, \{ \.\.\.item, relationship: getOpportunityRelationship/, "Opportunity relationship work should run only for selected recommendations.");

console.log("Performance regression checks passed.");
