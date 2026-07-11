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

assert.doesNotMatch(globalSearch, /opportunities as seedOpportunities/, "Global search must not statically import the full opportunity catalog.");
assert.match(globalSearch, /if\(!open\|\|loaded\)return/, "Global search should fetch the catalog only after the search dialog opens.");

assert.doesNotMatch(discoverPage, /listPublishedOpportunities/, "Discover must not serialize the full catalog through the route payload.");
assert.match(opportunityFilter, /fetch\("\/api\/opportunities"\)/, "Discover should load the catalog from the cached API after the shell renders.");
assert.match(opportunityFilter, /useDeferredValue/, "Discover search input should defer expensive filtering work.");
assert.match(opportunityFilter, /ResultSkeleton/, "Discover should show stable skeleton rows while the catalog loads.");

assert.match(profilePage, /dynamic\(\(\) => import\("\.\/profile-career-tab"\)/, "Profile Career tab should remain split from the initial edit-profile bundle.");
assert.match(personalizedHome, /dynamic\(\(\) => import\("\.\/student-journey-dashboard"\)/, "Journey dashboard should stay split from the landing/onboarding shell.");
assert.doesNotMatch(personalizedHome, /from "@\/data\/opportunities"/, "Landing/onboarding shell must not import the full opportunity catalog.");

assert.doesNotMatch(tracker, /import \{[^}]*opportunities,/, "My Opportunities must not import the full catalog.");
assert.match(tracker, /\/api\/opportunities\?ids=/, "My Opportunities should fetch only tracked opportunity records.");

assert.match(accountSync, /let sessionRequest/, "Account session requests should be deduped.");
assert.match(accountSync, /let hydrateRequest/, "Account hydration requests should be deduped.");
assert.match(accountSync, /const cloudData = session\.data/, "Hydration should reuse session account data instead of fetching it again.");
assert.match(accountSync, /!migrated \|\| !sameAccountData\(merged, cloudData\)/, "Hydration should skip account writes when merged data has not changed.");

console.log("Performance regression checks passed.");
