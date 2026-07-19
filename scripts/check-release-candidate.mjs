import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const googleAuthRoute = read("app/api/auth/google/route.ts");
const logoutRoute = read("app/api/auth/logout/route.ts");
const googleOAuth = read("lib/google-oauth.ts");
const accountSync = read("data/account-sync.ts");
const accountAuth = read("components/account-auth.tsx");
const discover = read("components/opportunity-filter.tsx");
const journeyDashboard = read("components/student-journey-dashboard.tsx");
const journeyPage = read("app/page.tsx");
const journeyEditorial = read("components/journey-editorial.tsx");
const advisorPage = read("components/advisor-page.tsx");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const forYouSnapshot = read("lib/for-you-snapshot.ts");
const advisorRoute = read("app/advisor/page.tsx");
const themeController = read("components/theme-controller.tsx");
const globals = read("app/globals.css");
const analytics = read("lib/analytics-types.ts");
const authStore = read("lib/auth-store.ts");
const recommendationEngine = read("data/recommendation-engine.ts");
const discoverCatalog = read("lib/discover-catalog.ts");
const rootLayout = read("app/layout.tsx");
const sitemap = read("app/sitemap.ts");
const robots = read("app/robots.ts");
const submitPerk = read("components/submit-perk-form.tsx");

for (const source of [rootLayout, sitemap, robots]) {
  assert.match(source, /https:\/\/www\.unlockededu\.com/, "Public canonical metadata must use the live production hostname.");
  assert.doesNotMatch(source, /unlocked\.education/, "Retired domain references must not return to public metadata.");
}
assert.match(submitPerk, /mailto:support@unlockededu\.com/, "Community submissions must open a real review handoff.");
assert.doesNotMatch(submitPerk, /localStorage|console\.(info|log)/, "Community submissions must not claim browser-only data was delivered.");

assert.match(googleOAuth, /prompt:\s*"select_account"/, "Google OAuth must request account selection.");
assert.match(googleOAuth, /include_granted_scopes:\s*"false"/, "Google OAuth must not silently reuse granted scopes.");
assert.match(googleAuthRoute, /sessionCookieName/, "Starting Google sign-in should clear stale UnlockED session cookies.");
assert.match(logoutRoute, /oauthStateCookieName/, "Logout should clear transient OAuth state.");
assert.match(logoutRoute, /referralCookieName/, "Logout should clear transient referral attribution state.");
assert.match(accountSync, /resetAccountSessionCache/, "Client account session cache must be resettable.");
assert.match(accountAuth, /resetAccountSessionCache\(\)/, "Sign-in/sign-out UI must reset stale session cache.");

assert.doesNotMatch(discover, /buildRecommendationService|hydrateAccountData|recommendation_refresh/, "Discover must not perform browser-side Advisor recommendation generation.");
assert.match(discover, /useDeferredValue/, "Discover search must defer expensive filtering.");
assert.match(discover, /view: "discover"/, "Discover must request bounded server-side result windows.");
assert.doesNotMatch(discover, /filterOpportunities/, "Discover must not filter the full catalog on the browser main thread.");
assert.match(discoverCatalog, /relevanceScore/, "Discover should preserve its lightweight relevance sort on the server.");

assert.doesNotMatch(journeyDashboard, /import \{[^}]*opportunities,/, "Journey dashboard must not statically import the full catalog.");
assert.doesNotMatch(journeyDashboard, /buildRecommendationService|NextToReview|JourneyRecapCard/, "Journey must not include retired recommendations or recap sharing.");
assert.match(journeyPage, /listPublishedOpportunitiesByIds\(trackedIds\)/, "Journey should fetch only tracked opportunities on the server.");
assert.doesNotMatch(journeyEditorial, /fetch\(|createPathGeometry/, "Journey must not fetch its catalog or calculate geometry in the browser.");
assert.match(journeyDashboard, /router\.refresh\(\)/, "Journey client recovery must refresh into the server-composed experience.");

assert.match(forYouSnapshot, /recommendations: allowed\.map/, "For You snapshots must store serialized recommendation view models.");
assert.match(forYouSnapshot, /const allowed = pro \? service\.recommendations\.slice\(0,\s*8\) : \[\]/, "Free For You should render the Pro conversion state immediately without expensive feed generation while Pro stays precision-first.");
assert.match(advisorRoute, /const session = await requireCompletedOnboarding\(\)/, "For You must remain protected server-side.");
assert.match(advisorRoute, /<AdvisorPage initialState=\{initialState\} serverAuthenticated \/>/, "For You must reuse a safe existing snapshot when one is available.");
assert.match(advisorRoute, /allowGeneration: false/, "For You document navigation must not block on recommendation generation.");
assert.match(forYouApi, /console\.info\("\[UnlockED For You\] request started"/, "For You API should log safe production diagnostics.");
assert.match(forYouApi, /auth complete/, "For You API should checkpoint auth completion.");
assert.match(forYouApi, /ranking complete/, "For You API should checkpoint ranking completion.");
assert.match(forYouApi, /response complete/, "For You API should log total completion in finally.");
assert.match(forYouApi, /serverTimeoutMs/, "For You API should have a server-side failure bound.");
assert.match(authStore, /kvTimeoutMs/, "KV operations should have a bounded timeout.");
assert.match(recommendationEngine, /selected\.map\(\(item\) => toOpportunityRecommendation\(profile, \{ \.\.\.item, relationship: getOpportunityRelationship/, "Opportunity relationships should be generated only for selected recommendations.");
assert.match(forYouApi, /pageState/, "For You API must return explicit page states.");
assert.match(advisorPage, /type ForYouPageState = "loading" \| "pro_ready" \| "free_preview" \| "profile_incomplete" \| "empty" \| "preparing" \| "error"/, "For You client must use a finite state machine.");
assert.match(advisorPage, /AbortController/, "For You client must abort stale or slow requests.");
assert.match(advisorPage, /ForYouErrorState/, "For You must render a real error state.");
assert.match(advisorPage, /ForYouFreePreviewOnly/, "Free users with zero previews must still see a Pro conversion state.");
assert.match(advisorPage, /Keep the full shortlist working for you/, "Free For You page must show a polished upgrade preview.");
assert.match(advisorPage, /No strong matches yet/, "For You must show an honest unavailable state when recommendations are empty.");

assert.match(themeController, /referralProGrantedUntil/, "Theme bootstrap should honor referral-earned Pro access.");
assert.match(globals, /--unlocked-surface/, "Theme CSS should use semantic surface variables.");
assert.doesNotMatch(globals, /filter:\s*invert|backdrop-filter:\s*invert/, "Theme switching must not rely on destructive visual filters.");

for (const retiredEvent of ["journey_recommendation_opened", "journey_recap_share_started", "recap_viewed", "share_card_generated", "share_initiated"]) {
  assert.ok(!analytics.includes(`"${retiredEvent}"`), `Retired analytics event ${retiredEvent} should not remain active.`);
}

console.log("Release candidate checks passed.");
