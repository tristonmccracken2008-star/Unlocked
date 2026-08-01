import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { addOpportunityToJourney } from "../data/journey-add";
import { buildRecommendationService } from "../data/recommendation-service";
import { opportunities } from "../data/opportunities";
import { schoolDirectory } from "../data/school-directory";
import type { StudentProfile } from "../data/student-profile";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";

const source = (path: string) => readFileSync(path, "utf8");
const now = "2026-07-26T12:00:00.000Z";
const emptyAccount = (): AccountData => ({
  profile: null,
  onboardingComplete: false,
  firstLaunchComplete: false,
  billing: defaultBillingRecord(),
  activity: null,
  savedOpportunities: [],
  tracker: {},
  preferences: null,
  journeyProgress: {},
  advisor: null,
  referrals: null,
  updatedAt: now,
});

const opportunityId = opportunities[0]!.id;
const first = addOpportunityToJourney(emptyAccount(), opportunityId, now);
assert.equal(first.firstSave, true);
assert.equal(first.duplicate, false);
assert.equal(first.record.status, "Saved");
assert.deepEqual(first.record.history, []);
assert.deepEqual(first.activity.saved, [opportunityId]);

const persisted: AccountData = {
  ...emptyAccount(),
  activity: first.activity,
  tracker: first.tracker,
  savedOpportunities: [{ opportunityId, savedAt: now }],
};
const replay = addOpportunityToJourney(persisted, opportunityId, "2026-07-26T12:01:00.000Z");
assert.equal(replay.firstSave, false);
assert.equal(replay.duplicate, true);
assert.equal(replay.record.savedAt, now);
assert.equal(replay.record.status, "Saved");

const route = source("app/api/journey/add/route.ts");
const service = source("lib/journey-add-service.ts");
for (const guard of ["assertSameOrigin", "getSession", "enforceRateLimit", "withSecurityLock", "idempotencyKey"]) {
  assert.ok(route.includes(guard) || service.includes(guard), `Journey add must preserve ${guard}.`);
}
assert.match(route, /activationAchieved/);
assert.match(route, /if \(!result\.duplicate\)/);
assert.match(source("app/api/account/data/route.ts"), /New opportunities require the Add to Journey endpoint\./);

const action = source("components/opportunity-activity.tsx");
assert.match(action, /await authenticatedFetch\("\/api\/journey\/add"/);
assert.match(action, /Added to your Journey/);
assert.ok(action.indexOf("setAdded(true)") > action.indexOf("if (!response.ok"), "The UI may confirm only after a successful server response.");
assert.doesNotMatch(action, /saveOpportunity\(opportunityId/);

const onboarding = source("components/onboarding-flow.tsx");
assert.match(onboarding, /const totalSteps = 10/);
assert.match(onboarding, /window\.location\.assign\("\/welcome"\)/);
const firstLaunch = source("components/first-launch-walkthrough.tsx");
assert.match(firstLaunch, /Start Exploring/);
assert.match(firstLaunch, /\/api\/account\/first-launch/);
assert.match(firstLaunch, /router\.replace\("\/opportunities"\)/);
assert.match(onboarding, /unlocked-onboarding-draft-v2/);
assert.doesNotMatch(onboarding, /title="Do you have a minor\?"/);
assert.doesNotMatch(onboarding, /title="What is your current GPA\?"/);
assert.match(onboarding, /onboarding_abandoned/);
assert.match(onboarding, /localStorage\.setItem\(draftKey/);

const snapshot = source("lib/for-you-snapshot.ts");
assert.match(snapshot, /slice\(0, pro \? 8 : 1\)/);
assert.match(snapshot, /entitlements\.canViewRecommendationExplanations \? view\.reasons : view\.reasons\.slice\(0, 1\)/);
const advisorPage = source("components/advisor-page.tsx");
assert.match(advisorPage, /pageState === "free_preview" \? <ForYouUpgradeGate/);
assert.match(advisorPage, /Your opportunities are ready\./);
const journey = source("components/journey-timeline.tsx");
assert.match(journey, /Saved is not the same as applied\./);
assert.match(journey, /Nothing moves forward automatically\./);

const school = schoolDirectory.find((item) => item.slug === "university-of-chicago")!;
const baseProfile: StudentProfile = {
  firstName: "Avery",
  schoolSlug: school.slug,
  major: "Mathematics",
  graduationYear: "2030",
  year: "First year",
  careerGoal: "Quantitative Finance",
  interests: "Finance, Internships, Research",
  currentPriority: "Finding an internship",
  preferredOpportunityTypes: ["Internships"],
  goals: ["Finding an internship"],
  topics: ["Finance", "Research"],
  gpaStatus: "none_yet",
  onboardingCompletedAt: now,
};
const personas: Array<Partial<StudentProfile>> = [
  {},
  { major: "Undecided", careerGoal: "Undecided", interests: "Research, Scholarships", topics: ["Research", "Scholarships"] },
  { major: "Computer Science", careerGoal: "Software Engineering", interests: "Software, AI", topics: ["Software", "AI"] },
  { major: "Biology / Pre-Med", careerGoal: "Medicine", interests: "Healthcare, Research", topics: ["Healthcare", "Research"], currentPriority: "Finding research" },
  { major: "Economics", careerGoal: "Business", interests: "Scholarships, Finance", topics: ["Scholarships", "Finance"], currentPriority: "Finding scholarships", financialNeedStatus: "demonstrated" },
  { major: "English", careerGoal: "Graduate School", interests: "Writing, Research", topics: ["Writing", "Research"] },
  { major: "Anthropology", careerGoal: "Research", interests: "Research, Public Policy", topics: ["Research", "Public Policy"] },
  { major: "Data Science", careerGoal: "Data Science", interests: "AI, Research", topics: ["AI", "Research"] },
  { major: "Psychology", careerGoal: "Research", interests: "Healthcare, Research", topics: ["Healthcare", "Research"] },
  { major: "Political Science", careerGoal: "Law", interests: "Public Policy, Fellowships", topics: ["Public Policy", "Fellowships"] },
  { major: "Engineering", careerGoal: "Engineering", interests: "Robotics, Internships", topics: ["Robotics", "Internships"] },
  { major: "Finance", careerGoal: "Investment Banking", interests: "Finance, Internships", topics: ["Finance", "Internships"] },
  { major: "History", careerGoal: "Undecided", interests: "Scholarships", topics: ["Scholarships"], preferredOpportunityTypes: [] },
];
const timings: number[] = [];
for (const override of personas) {
  const profile = { ...baseProfile, ...override };
  const startedAt = performance.now();
  const result = buildRecommendationService({
    profile,
    school,
    activity: { viewed: [], saved: [], claimed: [], tracked: {} },
    progress: { milestones: {}, applications: {} },
    source: opportunities,
    feedRotationKey: "2026-07-26",
  });
  timings.push(performance.now() - startedAt);
  assert.ok(result.recommendations.length > 0, `${profile.major} must receive at least one safe cold-start recommendation.`);
}
const sorted = [...timings].sort((left, right) => left - right);
const averageMs = timings.reduce((sum, value) => sum + value, 0) / timings.length;
const p95Ms = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)]!;
const worstMs = sorted.at(-1)!;
assert.ok(averageMs < 1_000, `Cold-start persona average must remain below 1,000ms; received ${averageMs.toFixed(2)}ms.`);

console.log("First-session checks passed", {
  personas: personas.length,
  averageMs: Number(averageMs.toFixed(2)),
  p95Ms: Number(p95Ms.toFixed(2)),
  worstMs: Number(worstMs.toFixed(2)),
});
