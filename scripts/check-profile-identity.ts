import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { opportunities } from "../data/opportunities";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";
import type { AccountData } from "../lib/account-types";
import { buildProfileIdentityJourney, buildProfileIdentityModel } from "../lib/profile-identity";
import { rankOpportunities, type RecommendationProfile } from "../data/recommendations";

const occurredAt = "2026-07-20T12:00:00.000Z";
const baseProfile: StudentProfile = {
  firstName: "Triston",
  lastName: "McCracken",
  schoolSlug: "university-of-chicago",
  major: "Mathematics",
  graduationYear: "2030",
  year: "First year",
  careerGoal: "Quantitative Research",
  interests: "Research, Finance",
  currentPriority: "Finding research",
};
const emptyAccount = {
  activity: null,
  tracker: {},
  journeyProgress: {},
} satisfies Pick<AccountData, "activity" | "tracker" | "journeyProgress">;

function tracked(id: string, status: OpportunityTrackerStatus, transitions: TrackedOpportunity["history"] = []): TrackedOpportunity {
  return { id, status, savedAt: occurredAt, updatedAt: occurredAt, version: 1, history: transitions };
}

const complete = buildProfileIdentityModel(baseProfile, { name: "Google Account Name" }, emptyAccount);
assert.equal(complete.name, "Triston McCracken");
assert.equal(complete.school, "University of Chicago");
assert.equal(complete.majors, "Mathematics");
assert.equal(complete.graduation, "Graduating 2030");
assert.equal(complete.careerGoal, "Quantitative Research");
assert.equal(complete.journey, null);

assert.equal(buildProfileIdentityModel({ ...baseProfile, secondaryMajor: "Computer Science" }, { name: "Student" }, emptyAccount).majors, "Mathematics • Computer Science");
assert.equal(buildProfileIdentityModel({ ...baseProfile, minor: "Economics", minorStatus: "declared" }, { name: "Student" }, emptyAccount).minor, "Minor in Economics");
const dualMinor = buildProfileIdentityModel({ ...baseProfile, secondaryMajor: "Computer Science", minor: "Economics", minorStatus: "declared" }, { name: "Student" }, emptyAccount);
assert.equal(dualMinor.majors, "Mathematics • Computer Science");
assert.equal(dualMinor.minor, "Minor in Economics");
assert.equal(buildProfileIdentityModel({ ...baseProfile, lastName: undefined, careerGoal: "" }, { name: "Fallback Name" }, emptyAccount).name, "Triston");
assert.equal(buildProfileIdentityModel({ ...baseProfile, firstName: undefined, lastName: undefined }, { name: "Fallback Name" }, emptyAccount).name, "Fallback Name");
assert.equal(buildProfileIdentityModel({ ...baseProfile, schoolSlug: "custom-long-school", schoolName: "The International College of Arts, Sciences, Engineering, and Public Policy" }, { name: "Student" }, emptyAccount).school, "The International College of Arts, Sciences, Engineering, and Public Policy");
assert.equal(buildProfileIdentityModel({ ...baseProfile, major: "Environmental Engineering and Sustainable Infrastructure Systems" }, { name: "Student" }, emptyAccount).majors, "Environmental Engineering and Sustainable Infrastructure Systems");
assert.equal(buildProfileIdentityModel({ ...baseProfile, firstName: "Alexandria-Cassandra", lastName: "Montgomery-Worthington" }, { name: "Student" }, emptyAccount).initials, "AM");

const journey = buildProfileIdentityJourney({
  activity: {
    viewed: [],
    saved: ["saved", "submitted", "closed-after-interview"],
    claimed: [],
    tracked: {
      saved: tracked("saved", "Saved"),
      submitted: tracked("submitted", "Submitted"),
      "closed-after-interview": tracked("closed-after-interview", "Rejected", [
        { id: "submit", transition: "submit", priorStatus: "Applying", resultingStatus: "Submitted", occurredAt },
        { id: "interview", transition: "interview", priorStatus: "Submitted", resultingStatus: "Interview", occurredAt },
      ]),
    },
  },
  tracker: {
    accepted: tracked("accepted", "Accepted"),
    completed: tracked("completed", "Completed"),
  },
  journeyProgress: { resume: true, project: true, skipped: false },
});
assert.deepEqual(journey?.map((item) => [item.id, item.value]), [
  ["saved", 5],
  ["applied", 4],
  ["interviews", 3],
  ["offers", 2],
  ["milestones", 2],
]);

const frozenProfile = structuredClone(baseProfile);
const recommendationProfile: RecommendationProfile = {
  schoolSlug: baseProfile.schoolSlug,
  schoolName: "University of Chicago",
  schoolLocation: "Chicago, IL",
  major: baseProfile.major,
  academicYear: baseProfile.year,
  interests: baseProfile.interests,
  careerGoals: baseProfile.careerGoal,
};
const recommendationFixture = opportunities.slice(0, 40);
const before = rankOpportunities(recommendationProfile, recommendationFixture).map((item) => [item.opportunity.id, item.score]);
buildProfileIdentityModel(baseProfile, { name: "Student" }, emptyAccount);
const after = rankOpportunities(recommendationProfile, recommendationFixture).map((item) => [item.opportunity.id, item.score]);
assert.deepEqual(after, before, "Rendering identity data must not alter recommendation output.");
assert.deepEqual(baseProfile, frozenProfile, "Identity projection must not mutate the canonical profile.");

const cardSource = readFileSync("components/profile-identity-card.tsx", "utf8");
assert.doesNotMatch(cardSource, /\bgpa\b|trackProductEvent|recommend/i, "The identity card must not expose GPA or create recommendation/analytics signals.");
assert.match(cardSource, /data-profile-identity-card/);
assert.match(cardSource, /var\(--unlocked-surface\)/);
assert.match(cardSource, /alt=\{`\$\{identity\.name\}'s profile photo`\}/);
const pageSource = readFileSync("components/profile-page.tsx", "utf8");
assert.match(pageSource, /Profile settings\./);
assert.match(pageSource, /showHeader=\{false\}/);
assert.doesNotMatch(pageSource, /Your account, clearly organized|The facts that shape your matches/);

const largeTracker = Object.fromEntries(Array.from({ length: 10_000 }, (_, index) => {
  const status: OpportunityTrackerStatus = index % 5 === 0 ? "Completed" : index % 5 === 1 ? "Accepted" : index % 5 === 2 ? "Interview" : index % 5 === 3 ? "Submitted" : "Saved";
  return [`large-${index}`, tracked(`large-${index}`, status)];
}));
const samples: number[] = [];
for (let run = 0; run < 40; run += 1) {
  const started = performance.now();
  buildProfileIdentityJourney({ activity: null, tracker: largeTracker, journeyProgress: { one: true, two: true } });
  samples.push(performance.now() - started);
}
samples.sort((left, right) => left - right);
const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const p95Ms = samples[Math.ceil(samples.length * 0.95) - 1]!;
assert.ok(p95Ms < 20, `A 10,000-record Journey aggregate must remain under 20ms p95; received ${p95Ms.toFixed(2)}ms.`);

console.log("Profile identity checks passed", {
  profileCases: 10,
  recommendationIsolation: true,
  additionalQueries: 0,
  largeJourneyRecords: 10_000,
  aggregateAverageMs: Number(averageMs.toFixed(2)),
  aggregateP95Ms: Number(p95Ms.toFixed(2)),
});
