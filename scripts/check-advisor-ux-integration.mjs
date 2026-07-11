import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const advisorBrain = read("data/advisor-brain.ts");
const dashboard = read("components/personalized-home.tsx");
const profile = read("components/profile-page.tsx");
const opportunityPage = read("app/opportunities/[id]/page.tsx");

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
  "Today’s Highest-Impact Action",
  "Biggest Career Gap",
  "Career Readiness Score",
  "Why this?",
  "Evidence used",
  "Tradeoffs",
]) {
  assert.ok(dashboard.includes(label), `Dashboard must render ${label}.`);
}
assert.ok(dashboard.includes("buildAdvisorBrain"), "Dashboard must consume the Advisor Brain API instead of duplicating scoring logic.");
assert.ok(!dashboard.includes("Today’s best opportunity"), "Dashboard should not keep the old generic best-opportunity hero.");

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
  "Advisor Brain",
  "Student Digital Twin",
  "Evidence inventory",
  "Competency coverage",
  "Skill graph",
  "Current bottlenecks",
  "Confidence levels",
  "Career trajectory",
  "Interview Intelligence",
  "STAR quality",
]) {
  assert.ok(profile.includes(label), `Profile Advisor Brain tab must render ${label}.`);
}
assert.ok(profile.includes("buildAdvisorBrain"), "Profile tab must use Advisor Brain output.");

console.log("Advisor UX integration checks passed.");
