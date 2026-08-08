import assert from "node:assert/strict";
import { createAdvisorProfile } from "../data/advisor-engine";
import { buildRecommendationDiagnosticReport, buildOpportunityStudentContext, rankOpportunityRecommendations } from "../data/recommendation-engine";
import { recommendationOpportunityClass } from "../data/recommendation-portfolio-policy";
import { evaluateProfessionalRecommendationCandidate } from "../data/recommendation-professional-pipeline";
import { opportunities, type Opportunity } from "../data/opportunities";
import { schoolDirectory } from "../data/school-directory";
import type { StudentActivity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";

const fixtureSchool = schoolDirectory.find((item) => item.slug === "university-of-chicago");
if (!fixtureSchool) throw new Error("Recommendation intelligence fixtures require a canonical school.");
const school = fixtureSchool;
const fixtureResourceSeed = opportunities.find((item) => item.type === "AI" && item.verification_status === "verified");
if (!fixtureResourceSeed) throw new Error("Recommendation intelligence fixtures require one validated resource seed.");
const resourceSeed: Opportunity = fixtureResourceSeed;

const today = new Date().toISOString().slice(0, 10);
const now = `${today}T12:00:00.000Z`;

function verifiedOpportunity(input: {
  id: string;
  title: string;
  organization: string;
  type: Opportunity["type"];
  category: string;
  majors: string[];
  careerPaths: string[];
  estimatedValue?: number;
  paid?: boolean;
  prestige?: Opportunity["prestige"];
}): Opportunity {
  const eligibility = "Open to currently enrolled undergraduate students from any accredited college or university in the United States.";
  return {
    ...resourceSeed,
    id: input.id,
    title: input.title,
    organization: input.organization,
    school_scope: "National",
    schools: [],
    type: input.type,
    category: input.category,
    description: `${input.title} is a structured undergraduate opportunity with documented responsibilities, application guidance, and an official source for students to review before applying.`,
    majors: input.majors,
    academic_years: ["First year", "Second year", "Third year", "Fourth year"],
    eligibility,
    estimated_value: input.estimatedValue ?? null,
    estimated_value_note: input.estimatedValue ? "Documented award or compensation value." : "Value is not published.",
    application_deadline: null,
    deadline: null,
    recurring: true,
    paid: input.paid ?? null,
    tags: [...input.careerPaths, input.category, ...input.majors],
    official_source: `https://example.edu/${input.id}`,
    official_source_url: `https://example.edu/${input.id}`,
    verification_status: "verified",
    last_verified: today,
    date_added: today,
    difficulty: "Competitive",
    prestige: input.prestige ?? "High",
    featured: true,
    hidden_gem: false,
    metadata: {
      ...resourceSeed.metadata,
      deadlineType: "rolling",
      compensation: input.paid ? "Paid" : "Varies",
      careerPaths: input.careerPaths,
      estimatedApplicationTime: "1-2 hours",
      eligibilityRules: {
        availability: "rolling",
        educationLevels: ["undergraduate"],
        canonicalInstitutionTypes: ["university", "four_year_college", "liberal_arts_college"],
        canonicalEnrollmentStatuses: ["currently_enrolled"],
        acceptsExternalStudents: true,
        classYears: ["First year", "Second year", "Third year", "Fourth year"],
        majors: input.majors,
        citizenshipStatuses: ["unrestricted"],
        recommendationEligibilityStatus: "eligible_for_ranking",
        evidence: [eligibility],
      },
      verification: {
        status: "verified",
        lastVerifiedAt: today,
        officialSourceUrl: `https://example.edu/${input.id}`,
        applicationUrlVerified: true,
        deadlineVerified: true,
        eligibilityVerified: true,
        sourceReachable: true,
      },
      lifecycle: {
        schemaVersion: 1,
        identity: { identityId: input.id },
        cycle: { cycleId: `${input.id}:rolling` },
        state: "rolling",
        confidence: "confirmed",
        reason: "rolling_confirmed",
        effectiveAt: now,
        recurrence: { type: "rolling_cohort", confidence: "confirmed" },
        evidence: [{ id: `${input.id}:open`, source: "official_status", observedAt: now, value: "Applications are rolling.", sourceUrl: `https://example.edu/${input.id}`, confidence: "confirmed" }],
        fieldVerifiedAt: { state: today, deadline: today, applicationUrl: today, eligibility: today, description: today },
      },
    },
  };
}

const structuredCandidates: Opportunity[] = [
  verifiedOpportunity({ id: "fixture-cs-internship", title: "Software Engineering Launch Internship", organization: "Acme Technology", type: "Career", category: "Internships", majors: ["Computer Science"], careerPaths: ["Software Engineering"], paid: true, prestige: "Very High" }),
  verifiedOpportunity({ id: "fixture-cs-research", title: "Undergraduate Computing Research Program", organization: "Computing Research Institute", type: "Research", category: "Research", majors: ["Computer Science"], careerPaths: ["Software Engineering", "Research"], paid: true }),
  verifiedOpportunity({ id: "fixture-cs-research-lab", title: "Applied Software Research Lab", organization: "Open Systems Laboratory", type: "Research", category: "Research", majors: ["Computer Science"], careerPaths: ["Software Engineering", "Research"], paid: true }),
  verifiedOpportunity({ id: "fixture-econ-insight", title: "Investment Banking Early Insight Program", organization: "Meridian Bank", type: "Career", category: "Career Programs", majors: ["Economics", "Finance"], careerPaths: ["Investment Banking"], prestige: "Very High" }),
  verifiedOpportunity({ id: "fixture-econ-competition", title: "Undergraduate Markets Competition", organization: "National Finance Association", type: "Career", category: "Competitions", majors: ["Economics", "Finance"], careerPaths: ["Investment Banking", "Finance"] }),
  verifiedOpportunity({ id: "fixture-bio-research", title: "Clinical Research Scholars Program", organization: "National Health Institute", type: "Research", category: "Research", majors: ["Biology / Pre-Med", "Biology"], careerPaths: ["Healthcare", "Health and Medicine"], paid: true, prestige: "Very High" }),
  verifiedOpportunity({ id: "fixture-bio-program", title: "Pre-Med Community Health Fellowship", organization: "Community Health Foundation", type: "Career", category: "Fellowships", majors: ["Biology / Pre-Med", "Biology"], careerPaths: ["Healthcare", "Health and Medicine"] }),
  verifiedOpportunity({ id: "fixture-scholarship", title: "Undergraduate Opportunity Scholarship", organization: "Student Success Foundation", type: "Scholarship", category: "Scholarships", majors: ["Any Major"], careerPaths: ["Funding"], estimatedValue: 10_000, prestige: "High" }),
  verifiedOpportunity({ id: "fixture-exploration", title: "First-Year Career Exploration Institute", organization: "College Futures Network", type: "Career", category: "Career Programs", majors: ["Any Major"], careerPaths: ["Career Exploration"] }),
  ...Array.from({ length: 6 }, (_, index) => verifiedOpportunity({ id: `fixture-resource-${index}`, title: `Student Productivity Tool ${index + 1}`, organization: `Resource Company ${index + 1}`, type: index % 2 ? "Benefit" : "AI", category: index % 2 ? "Student Benefits" : "AI Tools", majors: ["Any Major"], careerPaths: ["Software Engineering"], estimatedValue: 200 })),
];

function profile(overrides: Partial<StudentProfile>): StudentProfile {
  return {
    firstName: "Avery",
    schoolSlug: school.slug,
    major: "Computer Science",
    graduationYear: "2030",
    year: "First year",
    careerGoal: "Software Engineering",
    interests: "Software, Research",
    topics: ["Software", "Research"],
    goals: ["Find internship"],
    currentPriority: "Finding an internship",
    preferredOpportunityTypes: ["Internships"],
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

const emptyActivity: StudentActivity = { viewed: [], saved: [], claimed: [], tracked: {} };
const personas = [
  { id: "cs", profile: profile({}), expected: new Set(["career", "research", "funding"]) },
  { id: "economics", profile: profile({ major: "Economics", careerGoal: "Investment Banking", interests: "Finance, Scholarships", topics: ["Finance"], preferredOpportunityTypes: ["Internships", "Competitions"] }), expected: new Set(["career", "funding"]) },
  { id: "pre-med", profile: profile({ major: "Biology / Pre-Med", careerGoal: "Medicine", interests: "Healthcare, Research", topics: ["Healthcare", "Research"], currentPriority: "Finding research", preferredOpportunityTypes: ["Research", "Fellowships"] }), expected: new Set(["research", "program", "funding"]) },
  { id: "undecided", profile: profile({ major: "Undecided", careerGoal: "Undecided", interests: "Career exploration, Scholarships", topics: ["Career exploration"], currentPriority: "Exploring careers", preferredOpportunityTypes: [] }), expected: new Set(["program", "funding"]) },
];

for (const persona of personas) {
  const advisorProfile = createAdvisorProfile({ profile: persona.profile, school, activity: emptyActivity });
  const recommendations = rankOpportunityRecommendations({ advisorProfile, opportunities: structuredCandidates, limit: 8 });
  const selected = recommendations.map((recommendation) => structuredCandidates.find((item) => item.id === recommendation.relatedOpportunityId)!).filter(Boolean);
  assert.ok(selected.length >= 2, `${persona.id} needs a useful verified shortlist.`);
  assert.ok(selected.filter((item) => recommendationOpportunityClass(item) === "resource").length <= 1, `${persona.id} cannot be dominated by tools or benefits.`);
  assert.ok([...persona.expected].some((expected) => selected.some((item) => recommendationOpportunityClass(item) === expected)), `${persona.id} must surface a relevant high-value opportunity class.`);
  assert.equal(new Set(selected.map((item) => item.organization)).size, selected.length, `${persona.id} must have organization diversity.`);
  const context = buildOpportunityStudentContext(advisorProfile);
  for (const opportunity of selected) assert.equal(evaluateProfessionalRecommendationCandidate(opportunity, context).allowed, true, `${persona.id} received an unproven candidate.`);
}

const resourceOnlyProfile = createAdvisorProfile({ profile: profile({}), school, activity: emptyActivity });
const resources = structuredCandidates.filter((item) => recommendationOpportunityClass(item) === "resource");
assert.equal(rankOpportunityRecommendations({ advisorProfile: resourceOnlyProfile, opportunities: resources, limit: 8 }).length, 1, "Weak inventory must not pad a Pro feed with convenience resources.");
const resourceFan = createAdvisorProfile({ profile: profile({ preferredOpportunityTypes: ["AI Tools", "Student Benefits"] }), school, activity: emptyActivity });
assert.equal(rankOpportunityRecommendations({ advisorProfile: resourceFan, opportunities: resources, limit: 8 }).length, 2, "Strong explicit resource preference may widen the resource budget without dominating the feed.");

const behaviorActivity: StudentActivity = {
  viewed: [],
  saved: ["fixture-cs-research"],
  claimed: [],
  tracked: { "fixture-cs-research": { id: "fixture-cs-research", status: "Submitted", savedAt: now, updatedAt: now } },
};
const behaviorProfile = createAdvisorProfile({ profile: profile({ interests: "Software", topics: ["Software"], preferredOpportunityTypes: [] }), school, activity: behaviorActivity });
const behaviorRecommendations = rankOpportunityRecommendations({ advisorProfile: behaviorProfile, opportunities: structuredCandidates, limit: 8 });
assert.ok(behaviorRecommendations.some((item) => item.reasons.some((reason) => /saved and Journey activity/i.test(reason))), "Meaningful Journey behavior must produce a truthful explanation.");

const diagnosticProfile = createAdvisorProfile({ profile: profile({}), school, activity: emptyActivity });
const diagnostics = buildRecommendationDiagnosticReport({ advisorProfile: diagnosticProfile, opportunities: structuredCandidates, limit: 8 });
assert.ok(diagnostics.finalRankingOrder.length > 0, "Diagnostics need selected recommendations.");
for (const record of diagnostics.finalRankingOrder) {
  assert.deepEqual(Object.keys(record.scoreBreakdown), ["baseRelevance", "eligibility", "quality", "impact", "freshness", "timing", "behavioralContribution", "diversityAdjustment", "repetitionPenalty", "finalScore"]);
  assert.equal(record.scoreBreakdown.finalScore, record.finalScore);
}

console.log("Recommendation Intelligence V1 checks passed", {
  personas: personas.length,
  verifiedFixtures: structuredCandidates.length,
  resourceOnlyCount: 1,
  explicitResourcePreferenceCount: 2,
  diagnosticRecords: diagnostics.finalRankingOrder.length,
});
