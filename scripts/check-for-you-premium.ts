import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { activeRecommendationFeedback, findFeedbackRequest } from "../lib/advisor/feedback";
import { buildRecommendationService } from "../data/recommendation-service";
import { buildOpportunityStudentContext } from "../data/recommendation-engine";
import { auditFinalOpportunityRecommendation, evaluateProfessionalRecommendationCandidate } from "../data/recommendation-professional-pipeline";
import { getOpportunityIntelligence } from "../data/opportunity-intelligence";
import { opportunities, type Opportunity } from "../data/opportunities";
import { schoolDirectory } from "../data/school-directory";
import type { StudentActivity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";
import type { AdvisorFeedbackRecord } from "../lib/advisor/types";

const school = schoolDirectory.find((item) => item.slug === "university-of-chicago")!;
assert.ok(school, "Premium For You fixtures require a canonical school.");

const emptyActivity = (): StudentActivity => ({ viewed: [], saved: [], claimed: [], tracked: {} });

function profile(overrides: Partial<StudentProfile>): StudentProfile {
  return {
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
    ...overrides,
  };
}

const personas: Array<{ id: string; profile: StudentProfile; activity?: StudentActivity }> = [
  { id: "quant-finance-first-year", profile: profile({}) },
  { id: "computer-science-internships", profile: profile({ major: "Computer Science", careerGoal: "Software Engineering", interests: "Software, AI, Startups", topics: ["Software", "AI"], preferredOpportunityTypes: ["Internships"] }) },
  { id: "pre-med-research", profile: profile({ major: "Biology / Pre-Med", careerGoal: "Medicine", interests: "Healthcare, Research", topics: ["Healthcare", "Research"], currentPriority: "Finding research", preferredOpportunityTypes: ["Research"] }) },
  { id: "scholarship-priority", profile: profile({ major: "Economics", careerGoal: "Business", interests: "Finance, Scholarships", topics: ["Finance", "Scholarships"], currentPriority: "Finding scholarships", preferredOpportunityTypes: ["Scholarships"], financialNeedStatus: "demonstrated" }) },
  { id: "humanities-fellowships", profile: profile({ major: "English", careerGoal: "Graduate School", interests: "Writing, Research, Public Policy", topics: ["Writing", "Research"], currentPriority: "Exploring opportunities", preferredOpportunityTypes: ["Fellowships"] }) },
  { id: "undecided-first-year", profile: profile({ major: "Undecided", careerGoal: "Undecided", interests: "Education, Startups, Public Policy", topics: ["Education", "Startups"], currentPriority: "Exploring careers" }) },
  {
    id: "rich-history",
    profile: profile({ major: "Data Science", careerGoal: "Data Science", interests: "AI, Finance, Research", topics: ["AI", "Finance", "Research"] }),
    activity: {
      viewed: opportunities.filter((item) => ["Internships", "Research"].includes(item.category)).slice(0, 12).map((item) => item.id),
      saved: [],
      claimed: [],
      tracked: {},
    },
  },
];

const timings: number[] = [];
const personaResults: Array<{ id: string; recommendations: number; categories: string[]; organizations: string[] }> = [];
for (const persona of personas) {
  const startedAt = performance.now();
  const service = buildRecommendationService({
    profile: persona.profile,
    school,
    activity: persona.activity ?? emptyActivity(),
    progress: { milestones: {}, applications: {} },
    source: opportunities,
    feedRotationKey: "2026-07-26",
  });
  timings.push(performance.now() - startedAt);
  assert.ok(service.recommendations.length > 0, `${persona.id} should receive at least one high-confidence recommendation.`);
  assert.ok(service.recommendations.length <= 8, `${persona.id} must receive a focused portfolio.`);
  assert.equal(service.recommendations[0]?.recommendation.portfolio?.selectionRole, "Best Overall Match", `${persona.id} must have one clear best match.`);
  const ids = service.recommendations.map((view) => view.opportunity?.id);
  assert.equal(new Set(ids).size, ids.length, `${persona.id} must not receive duplicate opportunities.`);
  const organizations = service.recommendations.map((view) => view.opportunity?.organization);
  assert.equal(new Set(organizations).size, organizations.length, `${persona.id} must not receive repeated organizations.`);
  personaResults.push({
    id: persona.id,
    recommendations: service.recommendations.length,
    categories: [...new Set(service.recommendations.map((view) => view.recommendation.portfolio?.canonicalCategory ?? view.opportunity?.category ?? "Unknown"))],
    organizations: organizations.filter((organization): organization is string => Boolean(organization)),
  });
  const context = buildOpportunityStudentContext(service.advisorProfile);
  for (const view of service.recommendations) {
    assert.ok(view.opportunity);
    assert.equal(evaluateProfessionalRecommendationCandidate(view.opportunity, context).allowed, true, `${persona.id} received an unsafe candidate.`);
    assert.equal(auditFinalOpportunityRecommendation(view.recommendation, view.opportunity, context).approved, true, `${persona.id} received a recommendation that failed the final audit.`);
    assert.ok(view.opportunityScore.value >= 72, `${persona.id} received a recommendation below the quality floor.`);
    assert.notEqual(view.whyApplyNow?.label, "No artificial urgency", "Unsupported urgency placeholders must be omitted.");
    const role = view.recommendation.portfolio?.selectionRole;
    if (role === "Deadline Approaching") assert.ok(view.whyApplyNow && ["high", "medium"].includes(view.whyApplyNow.urgency), "Deadline roles require verified near-term timing.");
    if (role === "Newly Available") assert.ok(view.freshnessLabel === "New this week" || view.freshnessLabel === "Recently added", "New roles require catalog freshness.");
    if (role === "High-Impact Opportunity") assert.ok(getOpportunityIntelligence(view.opportunity).impactScore >= 45, "High-impact roles require structured impact evidence.");
    if (role === "Reach Opportunity") assert.equal(view.opportunity.difficulty, "Highly Competitive", "Reach roles require documented difficulty.");
  }
}

const baseline = buildRecommendationService({
  profile: profile({}),
  school,
  activity: emptyActivity(),
  progress: { milestones: {}, applications: {} },
  source: opportunities,
  feedRotationKey: "2026-07-26",
});
const baselineIds = baseline.recommendations.map((view) => view.opportunity!.id);
const first = baseline.recommendations[0]!;

const savedActivity: StudentActivity = {
  viewed: [],
  saved: [first.opportunity!.id],
  claimed: [],
  tracked: {
    [first.opportunity!.id]: {
      id: first.opportunity!.id,
      status: "Saved",
      savedAt: "2026-07-20T12:00:00.000Z",
      updatedAt: "2026-07-20T12:00:00.000Z",
    },
  },
};
const savedFeed = buildRecommendationService({
  profile: profile({}),
  school,
  activity: savedActivity,
  progress: { milestones: {}, applications: {} },
  source: opportunities,
  feedRotationKey: "2026-07-26",
});
assert.ok(!savedFeed.recommendations.some((view) => view.opportunity?.id === first.opportunity!.id), "Saved and active opportunities must leave the discovery feed.");

function feedback(feedbackType: AdvisorFeedbackRecord["feedbackType"], opportunity: Opportunity, index: number): AdvisorFeedbackRecord {
  return {
    recommendationId: `recommendation-opportunity-${opportunity.id}`,
    actionId: `opportunity:${opportunity.id}`,
    studentId: "premium-test-user",
    requestId: `feedback-request-${index}`,
    signal: `category:${opportunity.category}`,
    feedbackType,
    createdAt: new Date(Date.UTC(2026, 6, 20, 12, index)).toISOString(),
  };
}

const dismissed = feedback("not-interested", first.opportunity!, 1);
const dismissedFeed = buildRecommendationService({
  profile: profile({}),
  school,
  activity: emptyActivity(),
  progress: { milestones: {}, applications: {} },
  source: opportunities,
  feedbackRecords: [dismissed],
  feedRotationKey: "2026-07-26",
});
assert.ok(!dismissedFeed.recommendations.some((view) => view.opportunity?.id === first.opportunity!.id), "Explicit negative feedback must remove the opportunity.");
const undo = feedback("undo", first.opportunity!, 2);
assert.deepEqual(activeRecommendationFeedback([dismissed, undo]), [], "Undo must retract the latest effective preference.");
assert.equal(findFeedbackRequest([dismissed], dismissed.requestId)?.requestId, dismissed.requestId, "Request IDs must support replay detection.");

const restoredFeed = buildRecommendationService({
  profile: profile({}),
  school,
  activity: emptyActivity(),
  progress: { milestones: {}, applications: {} },
  source: opportunities,
  feedbackRecords: [dismissed, undo],
  feedRotationKey: "2026-07-26",
});
assert.deepEqual(restoredFeed.recommendations.map((view) => view.opportunity!.id), baselineIds, "Undo must restore the deterministic feed.");

const oneViewFeed = buildRecommendationService({
  profile: profile({}),
  school,
  activity: { ...emptyActivity(), viewed: [first.opportunity!.id] },
  progress: { milestones: {}, applications: {} },
  source: opportunities,
  feedRotationKey: "2026-07-26",
});
assert.ok(oneViewFeed.recommendations.every((view) => !view.reasons.some((reason) => /opportunities you viewed|organization you explored/i.test(reason))), "One passive view must not change personalization.");

const sameCategory = opportunities.filter((opportunity) => opportunity.category === first.opportunity!.category).slice(0, 2);
assert.equal(sameCategory.length, 2, "Feedback evidence fixture requires two opportunities in one category.");
const oneCategoryPreference = feedback("show-fewer", sameCategory[0], 3);
const twoCategoryPreferences = [oneCategoryPreference, feedback("show-fewer", sameCategory[1], 4)];
const onePreferenceService = buildRecommendationService({
  profile: profile({}),
  school,
  activity: emptyActivity(),
  progress: { milestones: {}, applications: {} },
  source: opportunities,
  feedbackRecords: [oneCategoryPreference],
});
assert.ok(!buildOpportunityStudentContext(onePreferenceService.advisorProfile).ignoredCategories?.includes(first.opportunity!.category), "One category preference must not overcorrect the feed.");
const repeatedPreferenceService = buildRecommendationService({
  profile: profile({}),
  school,
  activity: emptyActivity(),
  progress: { milestones: {}, applications: {} },
  source: opportunities,
  feedbackRecords: twoCategoryPreferences,
});
assert.ok(buildOpportunityStudentContext(repeatedPreferenceService.advisorProfile).ignoredCategories?.includes(first.opportunity!.category), "Repeated explicit category feedback should apply a bounded ranking penalty.");

const repeated = buildRecommendationService({
  profile: profile({}),
  school,
  activity: emptyActivity(),
  progress: { milestones: {}, applications: {} },
  source: opportunities,
  feedRotationKey: "2026-07-26",
});
assert.deepEqual(repeated.recommendations.map((view) => view.opportunity!.id), baselineIds, "The same daily rotation key must produce a stable feed.");

const malformed = { ...first.opportunity!, id: "malformed-premium-fixture", official_source_url: "javascript:alert(1)" } satisfies Opportunity;
const malformedFeed = buildRecommendationService({
  profile: profile({}),
  school,
  activity: emptyActivity(),
  progress: { milestones: {}, applications: {} },
  source: [malformed],
});
assert.equal(malformedFeed.recommendations.length, 0, "Malformed catalog records must never pad the Pro feed.");

const sparseSource = baseline.recommendations.slice(0, 3).map((view) => view.opportunity!);
const sparseFeed = buildRecommendationService({
  profile: profile({}),
  school,
  activity: emptyActivity(),
  progress: { milestones: {}, applications: {} },
  source: sparseSource,
});
assert.ok(sparseFeed.recommendations.length <= sparseSource.length, "Limited inventory must return fewer strong results instead of padding.");

const feedbackRoute = readFileSync("app/api/advisor/feedback/route.ts", "utf8");
assert.match(feedbackRoute, /withSecurityLock\("advisor-feedback"/, "Feedback persistence must be serialized per account.");
assert.match(feedbackRoute, /findFeedbackRequest/, "Feedback request replay must be detected.");
assert.match(feedbackRoute, /validOpportunityFeedbackTarget/, "Malformed recommendation and opportunity identifiers must be rejected.");

const sortedTimings = [...timings].sort((left, right) => left - right);
const averageMs = timings.reduce((sum, value) => sum + value, 0) / timings.length;
const p95Ms = sortedTimings[Math.min(sortedTimings.length - 1, Math.ceil(sortedTimings.length * 0.95) - 1)];
const worstMs = sortedTimings.at(-1) ?? 0;
assert.ok(averageMs < 1_000, `Representative persona average must remain under 1,000ms; received ${averageMs.toFixed(2)}ms.`);

console.log("Premium For You portfolio checks passed", {
  personas: personas.length,
  personaResults,
  averageMs: Number(averageMs.toFixed(2)),
  p95Ms: Number(p95Ms.toFixed(2)),
  worstMs: Number(worstMs.toFixed(2)),
});
