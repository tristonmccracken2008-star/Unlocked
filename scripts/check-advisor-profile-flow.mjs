import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const types = readFileSync("lib/advisor/types.ts", "utf8");
const engine = readFileSync("lib/advisor/engine.ts", "utf8");
const authStore = readFileSync("lib/auth-store.ts", "utf8");
const profileVersion = readFileSync("lib/advisor/profile-version.ts", "utf8");
const dashboard = readFileSync("components/personalized-home.tsx", "utf8");
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
assert.match(dashboard, /localStorage\.removeItem\(advisorProfileUpdatedMessageKey\)/, "Dashboard must consume the profile-change acknowledgement once.");

assert.match(dashboard, /Your next step/, "Advisor dashboard must focus on one next step.");
assert.match(dashboard, /Learn More ⓘ/, "Advisor dashboard must use progressive disclosure for details.");
assert.match(dashboard, /Show other options/, "Advisor dashboard must hide alternatives initially.");
assert.match(dashboard, /View your plan/, "Advisor dashboard must hide plan details initially.");
assert.match(dashboard, /Explore matching opportunities/, "Advisor dashboard must hide opportunity matches initially.");
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
