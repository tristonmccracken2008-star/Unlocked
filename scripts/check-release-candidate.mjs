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
const advisorPage = read("components/advisor-page.tsx");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const themeController = read("components/theme-controller.tsx");
const globals = read("app/globals.css");
const analytics = read("lib/analytics-types.ts");

assert.match(googleOAuth, /prompt:\s*"select_account"/, "Google OAuth must request account selection.");
assert.match(googleOAuth, /include_granted_scopes:\s*"false"/, "Google OAuth must not silently reuse granted scopes.");
assert.match(googleAuthRoute, /sessionCookieName/, "Starting Google sign-in should clear stale UnlockED session cookies.");
assert.match(logoutRoute, /oauthStateCookieName/, "Logout should clear transient OAuth state.");
assert.match(logoutRoute, /referralCookieName/, "Logout should clear transient referral attribution state.");
assert.match(accountSync, /resetAccountSessionCache/, "Client account session cache must be resettable.");
assert.match(accountAuth, /resetAccountSessionCache\(\)/, "Sign-in/sign-out UI must reset stale session cache.");

assert.doesNotMatch(discover, /buildRecommendationService|hydrateAccountData|recommendation_refresh/, "Discover must not perform browser-side Advisor recommendation generation.");
assert.match(discover, /useDeferredValue/, "Discover search must defer expensive filtering.");
assert.match(discover, /relevanceScore/, "Discover should use a lightweight local relevance sort.");

assert.doesNotMatch(journeyDashboard, /import \{[^}]*opportunities,/, "Journey dashboard must not statically import the full catalog.");
assert.doesNotMatch(journeyDashboard, /buildRecommendationService|NextToReview|JourneyRecapCard/, "Journey must not include retired recommendations or recap sharing.");
assert.match(journeyDashboard, /\/api\/opportunities\?ids=/, "Journey dashboard should fetch only tracked opportunities.");

assert.match(forYouApi, /service\.recommendations\.slice\(0,\s*2\)/, "Free For You API must return only preview recommendations.");
assert.match(advisorPage, /Unlock your full personalized feed/, "Free For You page must show a polished upgrade preview.");
assert.match(advisorPage, /We could not find strong matches yet/, "For You must show an honest unavailable state when recommendations are empty.");

assert.match(themeController, /referralProGrantedUntil/, "Theme bootstrap should honor referral-earned Pro access.");
assert.match(globals, /--unlocked-surface/, "Theme CSS should use semantic surface variables.");
assert.doesNotMatch(globals, /filter:\s*invert|backdrop-filter:\s*invert/, "Theme switching must not rely on destructive visual filters.");

for (const retiredEvent of ["journey_recommendation_opened", "journey_recap_share_started", "recap_viewed", "share_card_generated", "share_initiated"]) {
  assert.ok(!analytics.includes(`"${retiredEvent}"`), `Retired analytics event ${retiredEvent} should not remain active.`);
}

console.log("Release candidate checks passed.");
