import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const advisorBrain = read("data/advisor-brain.ts");
const dashboard = read("components/personalized-home.tsx");
const header = read("components/header.tsx");
const advisorPage = read("components/advisor-page.tsx");
const advisorRoute = read("app/advisor/page.tsx");
const advisorAccess = read("lib/advisor-access.ts");
const profile = read("components/profile-page.tsx");
const opportunityPage = read("app/opportunities/[id]/page.tsx");
const opportunityFilter = read("components/opportunity-filter.tsx");

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
  "Today’s Mission",
  "Open Advisor",
  "Why this mission?",
  "View readiness and career gap",
  "Saved opportunities and deadlines",
]) {
  assert.ok(dashboard.includes(label), `Dashboard must render ${label}.`);
}
assert.ok(dashboard.includes("buildAdvisorBrain"), "Dashboard must consume the Advisor Brain API instead of duplicating scoring logic.");
assert.ok(!dashboard.includes("Today’s best opportunity"), "Dashboard should not keep the old generic best-opportunity hero.");
assert.ok(!dashboard.includes("AdvisorBrainSection"), "Dashboard should not render the duplicate advisor recommendation panel.");

for (const label of ["Home", "Opportunities", "Advisor"]) {
  assert.ok(header.includes(label), `Primary navigation must include ${label}.`);
}
assert.ok(header.includes("aria-current"), "Navigation must expose the active section.");
assert.ok(header.includes("/profile"), "Profile must remain available as secondary navigation.");

for (const label of [
  "What to do next.",
  "Why now",
  "Evidence and confidence",
  "Alternatives",
  "Mark done",
  "Find matching opportunities",
]) {
  assert.ok(advisorPage.includes(label), `Advisor page must render ${label}.`);
}
assert.ok(advisorRoute.includes("getSession"), "Advisor route must remain protected by server-side auth.");
assert.ok(advisorPage.includes("buildAdvisorBrain"), "Advisor page must consume Advisor Brain.");
assert.ok(advisorPage.includes("markMilestoneCompleted"), "Advisor completion must update milestone progress through existing helpers.");
assert.ok(advisorPage.includes("updateApplicationStatus"), "Advisor completion must update opportunity progress through existing helpers.");
assert.ok(advisorPage.includes("URLSearchParams"), "Advisor-to-Opportunity flow must produce filtered opportunity URLs.");
assert.ok(opportunityFilter.includes("window.location.search"), "Opportunity search must read Advisor handoff filters.");

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
  assert.ok(profile.includes(label), `Profile Career Profile tab must render ${label}.`);
}
assert.ok(profile.includes("buildAdvisorBrain"), "Profile tab must use Advisor Brain output.");
assert.ok(!profile.includes("Student Digital Twin"), "Profile primary copy must not expose Student Digital Twin terminology.");
assert.ok(!profile.includes("Evidence inventory"), "Profile primary copy must not expose evidence inventory terminology.");
assert.ok(!profile.includes("Confidence levels"), "Profile primary copy must not expose repeated confidence labels.");

console.log("Advisor UX integration checks passed.");
