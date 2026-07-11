import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const advisorBrain = read("data/advisor-brain.ts");
const dashboard = read("components/personalized-home.tsx");
const journeyDashboard = read("components/student-journey-dashboard.tsx");
const header = read("components/header.tsx");
const advisorPage = read("components/advisor-page.tsx");
const advisorRoute = read("app/advisor/page.tsx");
const advisorAccess = read("lib/advisor-access.ts");
const profile = read("components/profile-page.tsx");
const profileCareerTab = read("components/profile-career-tab.tsx");
const opportunityPage = read("app/opportunities/[id]/page.tsx");
const opportunityFilter = read("components/opportunity-filter.tsx");
const journey = read("data/journey.ts");
const activity = read("data/student-activity.ts");
const analytics = read("lib/analytics-types.ts");

for (const symbol of [
  "buildAdvisorBrain",
  "explainOpportunityWithAdvisorBrain",
  "buildStudentDigitalTwin",
  "buildEvidenceInventory",
  "runInterviewIntelligence",
  "runRecommendationEngineV1",
  "scoreOpportunityIntelligence",
]) {
  assert.ok(advisorBrain.includes(symbol), `Advisor Brain orchestration must include ${symbol}.`);
}

for (const label of [
  "Journey",
  "Journey progress",
  "Journey timeline",
  "Active opportunities",
  "Journey recap",
  "Share recap",
]) {
  assert.ok(journeyDashboard.includes(label), `Dashboard must render ${label}.`);
}
assert.ok(journeyDashboard.includes("buildAdvisorBrain"), "Dashboard must consume the Advisor Brain API instead of duplicating scoring logic.");
assert.ok(journeyDashboard.includes("buildJourneyMilestones"), "Journey must derive timeline milestones from real student activity.");
assert.ok(journeyDashboard.includes("buildJourneyRecap"), "Journey must derive recap values from real student activity.");
assert.ok(!dashboard.includes("Today’s best opportunity"), "Dashboard should not keep the old generic best-opportunity hero.");
assert.ok(!dashboard.includes("AdvisorBrainSection"), "Dashboard should not render the duplicate advisor recommendation panel.");
assert.ok(!dashboard.includes("Today’s Mission"), "Journey should not keep the old mission dashboard framing.");

for (const label of ["Discover", "For You", "Journey"]) {
  assert.ok(header.includes(label), `Primary navigation must include ${label}.`);
}
assert.ok(header.includes("aria-current"), "Navigation must expose the active section.");
assert.ok(header.includes("/profile"), "Profile must remain available as secondary navigation.");
assert.ok(header.includes("Mobile navigation"), "Authenticated mobile users must have a simple bottom navigation.");

for (const label of [
  "Opportunities selected around you.",
  "Why it fits",
  "Evidence and confidence",
  "Alternatives",
  "Track this",
  "Find matching opportunities",
]) {
  assert.ok(advisorPage.includes(label), `Advisor page must render ${label}.`);
}
assert.ok(!advisorPage.includes("What to do next."), "For You should not expose broad advisor dashboard framing.");
assert.ok(advisorRoute.includes("getSession"), "Advisor route must remain protected by server-side auth.");
assert.ok(advisorPage.includes("buildAdvisorBrain"), "Advisor page must consume Advisor Brain.");
assert.ok(advisorPage.includes("markMilestoneCompleted"), "Advisor completion must update milestone progress through existing helpers.");
assert.ok(advisorPage.includes("updateApplicationStatus"), "Advisor completion must update opportunity progress through existing helpers.");
assert.ok(advisorPage.includes("URLSearchParams"), "Advisor-to-Opportunity flow must produce filtered opportunity URLs.");
assert.ok(opportunityFilter.includes("window.location.search"), "Opportunity search must read Advisor handoff filters.");
assert.ok(opportunityFilter.includes("discover_opened"), "Discover must emit an open event.");

for (const state of ["free", "preview", "pro", "unavailable"]) {
  assert.ok(advisorAccess.includes(`"${state}"`), `Advisor access state must support ${state}.`);
}

for (const label of [
  "Why this is recommended for you",
  "Skills gained",
  "Competencies strengthened",
  "Evidence generated",
  "Resume impact",
  "Interview value",
  "Estimated ROI",
]) {
  assert.ok(opportunityPage.includes(label), `Opportunity page must render ${label}.`);
}
assert.ok(opportunityPage.includes("explainOpportunityWithAdvisorBrain"), "Opportunity pages must use Advisor Brain explanations.");

for (const label of [
  "Career Profile",
  "Current direction",
  "Strongest areas",
  "Top growth areas",
  "Recommended next step",
  "How this was calculated",
]) {
  assert.ok(profileCareerTab.includes(label), `Profile Career Profile tab must render ${label}.`);
}
assert.ok(profileCareerTab.includes("buildAdvisorBrain"), "Profile tab must use Advisor Brain output.");
assert.ok(profile.includes("dynamic(() => import(\"./profile-career-tab\")"), "Career Profile tab should stay split from the initial profile bundle.");
assert.ok(!profileCareerTab.includes("Student Digital Twin"), "Profile primary copy must not expose Student Digital Twin terminology.");
assert.ok(!profileCareerTab.includes("Evidence inventory"), "Profile primary copy must not expose evidence inventory terminology.");
assert.ok(!profileCareerTab.includes("Confidence levels"), "Profile primary copy must not expose repeated confidence labels.");

for (const symbol of ["buildJourneyMilestones", "buildJourneyRecap"]) {
  assert.ok(journey.includes(symbol), `Journey data module must include ${symbol}.`);
}
assert.ok(activity.includes('"Rejected"'), "Opportunity tracker statuses must include rejected applications.");
assert.ok(!journey.includes("streak"), "Journey must not fabricate streak metrics.");
assert.ok(!journey.includes("XP"), "Journey must not fabricate gamified points.");

for (const event of [
  "discover_opened",
  "search_performed",
  "filter_applied",
  "status_changed",
  "application_recorded",
  "for_you_opened",
  "recommendation_viewed",
  "recommendation_clicked",
  "journey_opened",
  "recap_viewed",
  "share_card_generated",
  "share_initiated",
]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics events must include ${event}.`);
}

console.log("Advisor UX integration checks passed.");
