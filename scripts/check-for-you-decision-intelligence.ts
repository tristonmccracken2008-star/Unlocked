import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRecommendationService } from "../data/recommendation-service";
import { opportunities } from "../data/opportunities";
import { schoolDirectory } from "../data/school-directory";
import type { StudentActivity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";
import { buildForYouBriefing } from "../lib/for-you-briefing";

const school = schoolDirectory.find((item) => item.slug === "university-of-chicago");
assert.ok(school);
const profile: StudentProfile = {
  schoolSlug: school.slug, major: "Computer Science", graduationYear: "2030", year: "First year",
  careerGoal: "Quantitative Finance", interests: "Finance, Software, Research", goals: ["Find internship"],
  topics: ["Finance", "Software", "Research"], preferredOpportunityTypes: ["Internships", "Research"],
  institutionType: "university", enrollmentStatus: "enrolled", degreeLevel: "undergraduate",
  citizenshipStatus: "us_citizen", workAuthorization: "us_authorized", transferStatus: "not_transfer",
  financialNeedStatus: "unknown", meritStatus: "unknown",
};
const activity: StudentActivity = { viewed: [], saved: [], claimed: [], tracked: {} };
const recommendationViews = buildRecommendationService({ profile, school, activity, progress: { milestones: {}, applications: {} }, source: opportunities, feedRotationKey: "2026-08-20" }).recommendations.slice(0, 8);
assert.ok(recommendationViews.length >= 2);
const opportunityById = new Map(opportunities.map((item) => [item.id, item]));
const watchedId = recommendationViews[0]!.opportunity!.id;
const briefing = buildForYouBriefing({
  recommendations: recommendationViews,
  totalMatches: recommendationViews.length,
  profile,
  activity: { ...activity, viewed: [recommendationViews[1]!.opportunity!.id] },
  opportunityById,
  watchedOpportunityIds: [watchedId],
  now: new Date("2026-08-20T12:00:00.000Z"),
});

assert.equal(briefing.decisionVersion, "for-you-decision-v2");
assert.deepEqual(briefing.watchingIds, [watchedId]);
const recommendationSections = [...briefing.topPickIds, ...briefing.explorationIds, ...briefing.additionalMatchIds];
assert.ok(!recommendationSections.includes(watchedId), "Watched items must not be duplicated as a new recommendation section.");
assert.equal(new Set([...recommendationSections, ...briefing.watchingIds]).size, recommendationViews.length, "Every recommendation must have one primary page context.");
assert.ok(Object.values(briefing.priorityViews).every((ids) => !ids.includes(watchedId)), "Priority views must not duplicate watched opportunities.");
assert.ok(Object.values(briefing.insights).every((insight) => insight.explanations.length >= 1 && insight.explanations.length <= 2 && insight.comparison.matchReason));
assert.ok(Object.values(briefing.insights).every((insight) => !insight.facts.some((fact) => fact.kind === "requirements") || Boolean(opportunityById.get(insight.opportunityId)?.metadata.verification?.applicationUrlVerified)), "Application requirements must require verified application evidence.");
assert.ok(briefing.priorityViews.deadline.every((id) => opportunityById.get(id)?.metadata.verification?.deadlineVerified === true), "Deadline ordering may use only verified deadlines.");
assert.ok(briefing.priorityViews.requirements.every((id) => briefing.insights[id]?.comparison.applicationRequirements), "Requirements ordering may not include unknown workloads.");
assert.doesNotMatch(JSON.stringify(briefing), /\d{1,3}% fit|prestige score|acceptance chance|career impact score/i);

const watchRoute = readFileSync("app/api/advisor/watch/route.ts", "utf8");
assert.match(watchRoute, /assertSameOrigin\(request\)/);
assert.match(watchRoute, /isProUser\(session\.data\.billing\)/);
assert.match(watchRoute, /opportunityIds\.has\(opportunityId\)/);
assert.match(watchRoute, /updateWatchedOpportunity/);
assert.match(watchRoute, /registerTrackedRecipient/);
const authStore = readFileSync("lib/auth-store.ts", "utf8");
assert.match(authStore, /withSecurityLock\("for-you-watch", userId/);
assert.match(authStore, /forYouSnapshots: \[\]/, "Watch changes must invalidate stale For You snapshots.");
assert.doesNotMatch(authStore, /watchedOpportunities:\s*incoming\.watchedOpportunities/, "Generic account writes must not bypass the Pro Watch mutation.");
const accountExport = readFileSync("app/api/account/export/route.ts", "utf8");
assert.match(accountExport, /watchedOpportunities/, "Account export must include Watch data.");

console.log("For You decision intelligence checks passed", {
  recommendations: recommendationViews.length,
  watched: briefing.watchingIds.length,
  deadlineComparable: briefing.priorityViews.deadline.length,
  requirementsComparable: briefing.priorityViews.requirements.length,
});
