import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const types = readFileSync("lib/advisor/types.ts", "utf8");
const engine = readFileSync("lib/advisor/engine.ts", "utf8");
const authStore = readFileSync("lib/auth-store.ts", "utf8");
const profileVersion = readFileSync("lib/advisor/profile-version.ts", "utf8");
const dashboard = readFileSync("components/personalized-home.tsx", "utf8");
const journeyDashboard = readFileSync("components/student-journey-dashboard.tsx", "utf8");
const journeyEditorial = readFileSync("components/journey-editorial.tsx", "utf8");
const journeyClientEffects = readFileSync("components/journey-client-effects.tsx", "utf8");
const journeyBoard = readFileSync("components/my-opportunities-page.tsx", "utf8");
const profileData = readFileSync("data/student-profile.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const snapshots = JSON.parse(readFileSync("data/advisor-review-snapshots.json", "utf8"));

for (const field of ["profileHash", "profileVersion", "recommendationVersion", "generatedAt", "selectedCareerFramework", "selectedMajorFramework"]) {
  assert.match(types, new RegExp(`\\b${field}\\b`), `AdvisorOutput must include ${field}.`);
  assert.match(engine, new RegExp(`\\b${field}\\b`), `Advisor engine must populate ${field}.`);
}

assert.match(engine, /normalizedAdvisorProfileHash\(student\)/, "Recommendation generation must hash the normalized current profile.");
assert.match(authStore, /meaningfulAdvisorProfileChanged\(current\.profile, incomingProfile\)/, "Account persistence must detect meaningful advisor profile changes.");
assert.match(authStore, /profileChangedForAdvisor \? null : normalizeAdvisorData/, "Old advisor snapshots must be invalidated after meaningful profile changes.");
assert.match(profileVersion, /weeklyAvailability/, "Profile hash must include weekly availability.");
assert.match(profileVersion, /currentExperience/, "Profile hash must include current experience.");
assert.match(profileVersion, /preferredOpportunityTypes/, "Profile hash must include preferred path/opportunity type.");
assert.match(profileData, /advisorProfileUpdatedMessageKey/, "Profile saves must set a one-time plan-updated acknowledgement.");
assert.match(journeyClientEffects, /localStorage\.removeItem\(advisorProfileUpdatedMessageKey\)/, "Journey must consume the profile-change acknowledgement once.");

assert.match(dashboard, /Journey/, "Private home must be the student's Journey.");
assert.match(journeyEditorial, /What matters now/, "Journey must explain the student's current waypoint.");
assert.match(journeyEditorial, /The moments that shaped your path/, "Journey must expose real activity history below the opening composition.");
assert.match(journeyEditorial, /Manage applications/, "Journey must keep application management accessible below progressive disclosure.");
assert.match(journeyEditorial, /PathMomentEntry/, "Journey history must expose the lazy evidence-based Path Moment experience.");
assert.doesNotMatch(journeyBoard, /Journey Card|journeyCardSvg/, "The application board cannot duplicate Path Moment sharing.");
assert.doesNotMatch(journeyDashboard, /Share recap/, "Dashboard must not duplicate Path Moment sharing.");
assert.doesNotMatch(dashboard, /Today’s Mission/, "Journey should not keep the old coaching-dashboard copy.");
assert.doesNotMatch(dashboard, /Object\.entries\(advisor\.dimensionScores\)/, "Readiness breakdown should not render as an initial dashboard block.");

const byId = Object.fromEntries(snapshots.map((item) => [item.profileId, item]));
const comparisons = [
  ["first-year-cs-no-projects", "psychology-clinical"],
  ["first-year-cs-no-projects", "finance-investment-banking"],
  ["biology-research", "undecided-first-year"],
  ["psychology-clinical", "finance-investment-banking"],
].filter(([left, right]) => byId[left] && byId[right]);

for (const [leftId, rightId] of comparisons) {
  const left = byId[leftId];
  const right = byId[rightId];
  for (const field of ["primaryRecommendation", "whyRecommended", "evidenceProduced", "opportunityRecommendationType"]) {
    assert.notEqual(left[field], right[field], `${leftId} and ${rightId} should not share ${field}.`);
  }
  assert.notDeepEqual(left.alternatives, right.alternatives, `${leftId} and ${rightId} should have different alternatives.`);
  assert.notDeepEqual(left.recommendationChain, right.recommendationChain, `${leftId} and ${rightId} should have different recommendation chains.`);
}

assert.ok(packageJson.scripts["check:profile-flow"]?.includes("check-advisor-profile-flow.mjs"), "Profile-flow test must be available as an npm script.");

console.log("Advisor profile-change flow checks passed.");
