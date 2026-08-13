import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { buildRecommendationService } from "../data/recommendation-service";
import { opportunities } from "../data/opportunities";
import { schoolDirectory } from "../data/school-directory";
import type { StudentActivity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";
import { buildForYouBriefing } from "../lib/for-you-briefing";

const school = schoolDirectory.find((item) => item.slug === "university-of-chicago");
assert.ok(school, "For You 2.0 fixtures require a canonical school.");
const fixtureSchool = school;

const profile: StudentProfile = {
  firstName: "Avery",
  schoolSlug: school.slug,
  major: "Computer Science",
  graduationYear: "2030",
  year: "First year",
  careerGoal: "Quantitative Finance",
  interests: "Finance, Software, Research",
  goals: ["Find internship"],
  topics: ["Finance", "Software", "Research"],
  currentPriority: "Finding an internship",
  preferredOpportunityTypes: ["Internships", "Research"],
  gpaStatus: "none_yet",
  institutionType: "university",
  enrollmentStatus: "enrolled",
  degreeLevel: "undergraduate",
  citizenshipStatus: "us_citizen",
  workAuthorization: "us_authorized",
  transferStatus: "not_transfer",
  financialNeedStatus: "unknown",
  meritStatus: "unknown",
};
const emptyActivity: StudentActivity = { viewed: [], saved: [], claimed: [], tracked: {} };
const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));

function recommendations(activity: StudentActivity) {
  return buildRecommendationService({
    profile,
    school: fixtureSchool,
    activity,
    progress: { milestones: {}, applications: {} },
    source: opportunities,
    feedRotationKey: "2026-08-13",
  }).recommendations.slice(0, 8);
}

const baselineRecommendations = recommendations(emptyActivity);
assert.ok(baselineRecommendations.length > 0, "The real recommendation-safe catalog must support the For You 2.0 fixture.");
const baseline = buildForYouBriefing({
  recommendations: baselineRecommendations,
  totalMatches: baselineRecommendations.length,
  profile,
  activity: emptyActivity,
  opportunityById,
  now: new Date("2026-08-13T12:00:00.000Z"),
});

assert.equal(baseline.version, "for-you-briefing-v1");
assert.ok(baseline.topPickIds.length >= 1 && baseline.topPickIds.length <= 3, "Top Picks must remain intentionally scarce.");
const sectionIds = [...baseline.topPickIds, ...baseline.dontMissIds, ...baseline.explorationIds, ...baseline.moreMatchIds];
assert.equal(new Set(sectionIds).size, sectionIds.length, "A recommendation may appear in only one briefing section.");
assert.deepEqual(new Set(sectionIds), new Set(baselineRecommendations.map((view) => view.opportunity!.id)), "The briefing must account for every selected recommendation without adding catalog records.");
assert.ok(Object.values(baseline.insights).every((insight) => insight.whyItFits.length > 0), "Every recommendation must have a deterministic explanation.");
assert.doesNotMatch(JSON.stringify(baseline), /\d{1,3}% match|limited seats|students like you|historically fills early/i, "The briefing cannot introduce fake precision, demand, or urgency.");
assert.equal(baseline.portfolio.active, 0);
assert.match(baseline.portfolio.observation, /Journey is open/);

for (const event of baseline.radar) {
  assert.ok(opportunityById.has(event.opportunityId), "Radar events must reference real catalog records.");
  assert.ok(!baseline.topPickIds.includes(event.opportunityId), "Radar must not duplicate a Top Pick on the same page.");
  assert.match(event.href, /^\/opportunities\//, "Radar must use canonical internal opportunity routes.");
}

const trackedIds = baselineRecommendations.slice(0, Math.min(3, baselineRecommendations.length)).map((view) => view.opportunity!.id);
const trackedActivity: StudentActivity = {
  viewed: [],
  saved: trackedIds,
  claimed: [],
  tracked: Object.fromEntries(trackedIds.map((id, index) => [id, {
    id,
    status: index === 0 ? "Applying" : "Saved",
    savedAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-12T12:00:00.000Z",
  }])),
};
const evolvedRecommendations = recommendations(trackedActivity);
assert.ok(evolvedRecommendations.every((view) => !trackedIds.includes(view.opportunity!.id)), "Active Journey records must not consume new recommendation slots.");
const evolved = buildForYouBriefing({
  recommendations: evolvedRecommendations,
  totalMatches: evolvedRecommendations.length,
  profile,
  activity: trackedActivity,
  opportunityById,
  now: new Date("2026-08-13T12:00:00.000Z"),
});
assert.equal(evolved.portfolio.active, trackedIds.length, "The opportunity mix must reflect canonical active Journey records.");
assert.ok(evolved.portfolio.categories.length > 0, "Journey-aware intelligence must identify the student's active category mix.");
assert.ok(Object.values(evolved.insights).some((insight) => insight.whatItAdds), "At least one recommendation should explain incremental Journey value when the catalog supports it.");

for (let index = 0; index < 25; index += 1) {
  buildForYouBriefing({ recommendations: evolvedRecommendations, totalMatches: evolvedRecommendations.length, profile, activity: trackedActivity, opportunityById, now: new Date("2026-08-13T12:00:00.000Z") });
}
const timings = Array.from({ length: 100 }, () => {
  const startedAt = performance.now();
  buildForYouBriefing({ recommendations: evolvedRecommendations, totalMatches: evolvedRecommendations.length, profile, activity: trackedActivity, opportunityById, now: new Date("2026-08-13T12:00:00.000Z") });
  return performance.now() - startedAt;
});
const averageMs = timings.reduce((sum, value) => sum + value, 0) / timings.length;
const p95Ms = [...timings].sort((left, right) => left - right)[94];
assert.ok(averageMs < 5 && p95Ms < 10, `Briefing projection must remain negligible beside ranking; received ${averageMs.toFixed(2)}ms average / ${p95Ms.toFixed(2)}ms p95.`);

console.log("For You 2.0 briefing checks passed", {
  recommendations: baselineRecommendations.length,
  topPicks: baseline.topPickIds.length,
  radar: baseline.radar.length,
  activeJourney: evolved.portfolio.active,
  averageMs: Number(averageMs.toFixed(3)),
  p95Ms: Number(p95Ms.toFixed(3)),
});
