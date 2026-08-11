import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const layout = read("app/layout.tsx");
const globals = read("app/globals.css");
const header = read("components/header.tsx");
const footer = read("components/footer.tsx");
const profile = read("components/profile-page.tsx");
const notifications = read("components/notification-settings.tsx");
const notificationCenter = read("components/notification-center.tsx");
const actionFeedback = read("components/action-feedback.tsx");
const pricing = read("app/pricing/page.tsx");
const billingSuccess = read("app/billing/success/page.tsx");
const home = read("components/personalized-home.tsx");
const page = read("app/page.tsx");
const clientError = read("app/error.tsx");
const loading = read("app/loading.tsx");
const loadingSystem = read("components/loading-system.tsx");
const authBoundary = read("components/auth-boundary.tsx");
const opportunityActivity = read("components/opportunity-activity.tsx");
const opportunityDetail = read("app/opportunities/[id]/page.tsx");
const benefitDetail = read("app/benefits/[slug]/page.tsx");
const lifecycleSections = [
  read("components/career-section.tsx"),
  read("components/research-section.tsx"),
  read("components/scholarship-section.tsx"),
  read("components/ai-tools-section.tsx"),
  benefitDetail,
];

assert.match(layout, /href="#main-content"/, "The global shell must expose a skip link.");
assert.match(layout, /id="main-content"/, "The global shell must expose a stable content target.");
assert.match(globals, /\.skip-link/, "The skip link must become visible on focus.");

assert.match(header, /const destinations = \[\["Discover", "\/opportunities"\], \["For You", "\/advisor"\], \["Journey", "\/"\]\]/, "Primary navigation must use the three canonical product destinations.");
assert.doesNotMatch(header, /\["Refer", "\/referral"\]/, "Referrals must not compete with primary product navigation.");
assert.match(header, /grid-cols-3/, "Mobile navigation must reserve equal space for the three primary destinations.");
assert.match(footer, /safe-area-inset-bottom/, "The footer must clear mobile navigation and the device safe area.");

for (const token of ["sectionFromHash", "billingReturnMessage", '"popstate"', '"hashchange"', 'href="/referral"']) {
  assert.ok(profile.includes(token), `Profile navigation must preserve ${token}.`);
}
assert.match(profile, /priorAccountId \? "profile" : sectionFromHash\(window\.location\.hash\)/, "Initial account hydration must preserve a deep-linked section while later account switches reset it.");
assert.match(profile, /href="\/referral"[\s\S]*Referrals/, "Referrals must remain reachable from the account center.");
assert.match(billingSuccess, /href="\/profile#billing"/, "Checkout success must return to the billing section.");

assert.match(notifications, /if \(loading\)/, "Notification settings must model loading explicitly.");
assert.match(notifications, /if \(!preferences\)/, "Notification settings must render a durable failure state.");
assert.match(notifications, /Retry notification settings/, "Notification settings failures must be retryable.");
assert.match(notifications, /ActionFeedback[\s\S]*state=\{messageKind/, "Notification settings must use the shared semantic feedback surface.");
assert.match(actionFeedback, /role=\{state === "error" \? "alert" : "status"\}/, "Shared feedback must distinguish failures from successful status updates.");
assert.match(notificationCenter, /\.catch\(\(\) => setError\(/, "Notification destination state failures must be observable without blocking navigation.");

for (const token of ["getServerSessionForProduct", "isProUser", 'dynamic = "force-dynamic"', 'href="/profile#billing"', "Current plan"]) {
  assert.ok(pricing.includes(token), `Pricing must render account-aware state using ${token}.`);
}

assert.match(page, /<PersonalizedHome initialSession=\{initialSession\}/, "The home page must pass the server-known session into the client.");
assert.match(home, /initialSession\?: AccountSession \| null/, "The home client must accept the server-known session.");
assert.match(home, /account=deleted|searchParams\.get\("account"\)/, "The signed-out landing page must confirm account deletion returns.");

for (const section of lifecycleSections) {
  assert.match(section, /resolveOpportunityLifecycle/, "Every legacy opportunity surface must use the canonical lifecycle resolver.");
  assert.match(section, /LifecycleBadge/, "Every legacy opportunity surface must use the canonical lifecycle badge.");
}
assert.match(opportunityActivity, /opens in a new tab/, "Primary opportunity source actions must announce new-tab behavior.");
assert.match(opportunityDetail, /opens in a new tab/, "Opportunity detail source actions must announce new-tab behavior.");
assert.match(benefitDetail, /opens in a new tab/, "Benefit source actions must announce new-tab behavior.");

assert.doesNotMatch(clientError, /console\.error\(error\)/, "The client error boundary must not expose the full Error object.");
assert.match(clientError, /hasDigest/, "Client diagnostics should log only a safe error category.");
assert.match(loading, /AppPageLoading/, "Global routes must use the shared loading system.");
assert.match(loadingSystem, /bg-paper/, "Global loading must use the theme surface token.");
assert.match(authBoundary, /AccountPageLoading/, "Protected routes must use the shared account loading state.");
assert.match(loadingSystem, /aria-busy="true"/, "Protected-route loading must expose busy state.");
assert.match(globals, /prefers-reduced-motion:\s*reduce[\s\S]*unlocked-skeleton-block/, "Shared loading must respect reduced motion.");

console.log("Global UX consistency checks passed.");
