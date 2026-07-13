import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const globalSearch = read("components/global-search.tsx");
const discoverPage = read("app/opportunities/page.tsx");
const opportunityFilter = read("components/opportunity-filter.tsx");
const profilePage = read("components/profile-page.tsx");
const personalizedHome = read("components/personalized-home.tsx");
const accountSync = read("data/account-sync.ts");
const tracker = read("components/my-opportunities-page.tsx");
const journeyDashboard = read("components/student-journey-dashboard.tsx");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const authStore = read("lib/auth-store.ts");
const recommendationEngine = read("data/recommendation-engine.ts");

assert.doesNotMatch(globalSearch, /opportunities as seedOpportunities/, "Global search must not statically import the full opportunity catalog.");
assert.match(globalSearch, /if\(!open\|\|loaded\)return/, "Global search should fetch the catalog only after the search dialog opens.");

assert.doesNotMatch(discoverPage, /listPublishedOpportunities/, "Discover must not serialize the full catalog through the route payload.");
assert.match(opportunityFilter, /fetch\("\/api\/opportunities"\)/, "Discover should load the catalog from the cached API after the shell renders.");
assert.match(opportunityFilter, /useDeferredValue/, "Discover search input should defer expensive filtering work.");
assert.match(opportunityFilter, /ResultSkeleton/, "Discover should show stable skeleton rows while the catalog loads.");
assert.doesNotMatch(opportunityFilter, /buildRecommendationService/, "Discover must not build the Advisor recommendation index on the browser main thread.");
assert.doesNotMatch(opportunityFilter, /hydrateAccountData/, "Discover filters should not trigger account hydration or duplicate session work.");

assert.match(profilePage, /dynamic\(\(\) => import\("\.\/profile-career-tab"\)/, "Profile Career tab should remain split from the initial edit-profile bundle.");
assert.match(personalizedHome, /dynamic\(\(\) => import\("\.\/student-journey-dashboard"\)/, "Journey dashboard should stay split from the landing/onboarding shell.");
assert.doesNotMatch(personalizedHome, /from "@\/data\/opportunities"/, "Landing/onboarding shell must not import the full opportunity catalog.");

assert.doesNotMatch(tracker, /import \{[^}]*opportunities,/, "My Opportunities must not import the full catalog.");
assert.match(tracker, /\/api\/opportunities\?ids=/, "My Opportunities should fetch only tracked opportunity records.");

assert.doesNotMatch(journeyDashboard, /import \{[^}]*opportunities,/, "Journey dashboard must not statically import the full opportunity catalog.");
assert.doesNotMatch(journeyDashboard, /buildRecommendationService/, "Journey dashboard must not bypass Pro gating with client-side recommendations.");
assert.match(journeyDashboard, /\/api\/opportunities\?ids=/, "Journey dashboard should fetch only tracked opportunity records.");
assert.doesNotMatch(journeyDashboard, /JourneyRecapCard|NextToReview/, "Journey dashboard should not load retired share/recommendation experiences.");

assert.match(accountSync, /let sessionRequest/, "Account session requests should be deduped.");
assert.match(accountSync, /let hydrateRequest/, "Account hydration requests should be deduped.");
assert.match(accountSync, /resetAccountSessionCache/, "Account session cache should be explicitly reset for account switching.");
assert.match(accountSync, /const cloudData = session\.data/, "Hydration should reuse session account data instead of fetching it again.");
assert.match(accountSync, /!migrated \|\| !sameAccountData\(merged, cloudData\)/, "Hydration should skip account writes when merged data has not changed.");

assert.match(authStore, /kvTimeoutMs/, "Production KV operations should have a bounded timeout.");
assert.match(authStore, /AbortController/, "Production KV fetches should be abortable.");
assert.match(forYouApi, /serverTimeoutMs/, "For You should have a server-side hard failure bound.");
assert.match(forYouApi, /lastCheckpoint/, "For You should log the last completed checkpoint on failure.");
assert.match(recommendationEngine, /selected\.map\(\(item\) => toOpportunityRecommendation\(profile, \{ \.\.\.item, relationship: getOpportunityRelationship/, "Opportunity relationship work should run only for selected recommendations.");

console.log("Performance regression checks passed.");
