import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAdvisorProfile } from "../data/advisor-engine";
import { getRecommendationReasons, scoreOpportunityIntelligence } from "../data/opportunity-intelligence";
import { buildOpportunityStudentContext } from "../data/recommendation-engine";
import { buildRecommendationService } from "../data/recommendation-service";
import { opportunities } from "../data/opportunities";
import { schools } from "../data/seed";
import type { StudentActivity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { forYouProfileVersion } from "../lib/for-you-snapshot";

const school = schools.find((item) => item.slug === "university-of-chicago");
assert.ok(school, "Personalization fixture school must exist.");

const profile: StudentProfile = {
  firstName: "Avery",
  schoolSlug: school.slug,
  major: "Mathematics",
  graduationYear: "2030",
  year: "First year",
  careerGoal: "Quantitative Finance",
  interests: "Finance, Software, Research",
  goals: ["Find internship"],
  topics: ["Finance", "Software", "Research"],
  currentPriority: "Finding an internship",
  preferredOpportunityTypes: [],
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
const activity: StudentActivity = { viewed: [], saved: [], claimed: [], tracked: {} };
const progress = { milestones: {}, applications: {} };
const service = buildRecommendationService({ profile, school, activity, progress, source: opportunities });
assert.ok(service.recommendations.length > 0, "For You must return eligible recommendations.");
const shortlist = service.recommendations.slice(0, 8);

const organizationCounts = new Map<string, number>();
const categoryCounts = new Map<string, number>();
const typeCounts = new Map<string, number>();
for (const view of shortlist) {
  assert.ok(view.opportunity, "Every visible recommendation must resolve to an opportunity.");
  assert.ok(view.summaryReason && !/^You are a /i.test(view.summaryReason), "The primary explanation must lead with a useful recommendation signal.");
  assert.ok(view.signals?.length && view.signals.length <= 4, "Each recommendation must expose a short structured signal set.");
  organizationCounts.set(view.opportunity.organization, (organizationCounts.get(view.opportunity.organization) ?? 0) + 1);
  categoryCounts.set(view.opportunity.category, (categoryCounts.get(view.opportunity.category) ?? 0) + 1);
  typeCounts.set(view.opportunity.type, (typeCounts.get(view.opportunity.type) ?? 0) + 1);
}
assert.ok([...organizationCounts.values()].every((count) => count <= 1), "One organization cannot dominate For You.");
assert.ok([...categoryCounts.values()].every((count) => count <= 2), "One category cannot dominate For You.");
assert.ok([...typeCounts.values()].every((count) => count <= 3), "One opportunity type cannot dominate For You.");

const candidate = shortlist[0].opportunity;
assert.ok(candidate);
const advisorProfile = createAdvisorProfile({ profile, school, activity, progress });
const baselineContext = buildOpportunityStudentContext(advisorProfile);
const baseline = scoreOpportunityIntelligence(candidate, baselineContext);
const behaviorContext = {
  ...baselineContext,
  preferredCategories: [candidate.category],
  viewedCategories: [candidate.category],
  interactedOrganizations: [candidate.organization],
};
const behavior = scoreOpportunityIntelligence(candidate, behaviorContext);
assert.ok(behavior.rawScore >= baseline.rawScore + 17, "Existing preference and exploration signals must change ranking predictably.");
const behaviorReasons = getRecommendationReasons(candidate, behaviorContext);
for (const expected of ["preferred opportunity type", "opportunities you viewed", "organization you explored"]) {
  assert.ok(behaviorReasons.some((reason) => reason.toLowerCase().includes(expected)), `Behavior reason must truthfully include ${expected}.`);
}

const account: AccountData = {
  profile,
  onboardingComplete: true,
  billing: defaultBillingRecord(),
  activity,
  savedOpportunities: [],
  tracker: {},
  preferences: { preferredTypes: [], updatedAt: "2026-07-21T00:00:00.000Z" },
  journeyProgress: {},
  advisor: null,
  referrals: null,
  updatedAt: "2026-07-21T00:00:00.000Z",
};
const baselineVersion = forYouProfileVersion(profile, account);
assert.notEqual(forYouProfileVersion(profile, { ...account, activity: { ...activity, viewed: [candidate.id] } }), baselineVersion, "Recent views must invalidate a stale recommendation snapshot.");
assert.notEqual(forYouProfileVersion(profile, { ...account, preferences: { preferredTypes: [candidate.type], updatedAt: account.updatedAt } }), baselineVersion, "Preference changes must invalidate a stale recommendation snapshot.");

const page = readFileSync(new URL("../components/advisor-page.tsx", import.meta.url), "utf8");
const timeline = readFileSync(new URL("../components/journey-timeline.tsx", import.meta.url), "utf8");
assert.match(page, /view\.signals/);
assert.match(page, /view\.summaryReason/);
assert.match(timeline, /formatMonth/);
assert.match(timeline, /data-journey-moment/);

console.log("Premium personalization checks passed", {
  recommendations: shortlist.length,
  categories: categoryCounts.size,
  organizations: organizationCounts.size,
  behaviorLift: behavior.rawScore - baseline.rawScore,
});
