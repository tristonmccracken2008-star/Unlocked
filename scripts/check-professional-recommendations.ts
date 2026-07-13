import assert from "node:assert/strict";
import catalogJson from "../data/db/opportunities.json";
import institutionsJson from "../data/db/institutions.json";
import schoolsJson from "../data/db/schools.json";
import { createAdvisorProfile } from "../data/advisor-engine";
import { evaluateOpportunityEligibility } from "../data/opportunity-eligibility";
import { buildOpportunityStudentContext, rankOpportunityRecommendations } from "../data/recommendation-engine";
import { evaluateProfessionalRecommendationCandidate, validateOpportunityData } from "../data/recommendation-professional-pipeline";
import type { Opportunity, OpportunityEligibilityRules } from "../data/opportunities";
import type { School } from "../data/schemas";
import type { StudentProfile } from "../data/student-profile";

const catalog = catalogJson as Opportunity[];
const professionalCatalog = catalog.filter((opportunity) => validateOpportunityData(opportunity).allowed);
const allSchools = [...schoolsJson, ...institutionsJson].filter((school, index, values) => values.findIndex((candidate) => candidate.slug === school.slug) === index) as School[];
const majors = ["Computer Science", "Mathematics", "Economics", "Finance", "Biology", "Engineering", "Business", "Psychology", "Data Science", "Political Science"];
const years = ["First year", "Second year", "Third year", "Fourth year", "Graduate student"];
const careerGoals = ["Software Engineering", "Quantitative Finance", "Medicine", "Research", "Investment Banking", "Consulting", "Law", "Graduate School", "Entrepreneurship", "Undecided"];
const citizenshipStatuses: NonNullable<StudentProfile["citizenshipStatus"]>[] = ["us_citizen", "permanent_resident", "international", "unknown"];

function institutionType(name: string): NonNullable<StudentProfile["institutionType"]> {
  const normalized = name.toLowerCase();
  if (normalized.includes("community college") || normalized.includes("technical college")) return "community_college";
  if (normalized.includes("university") || normalized.includes("institute of technology")) return "university";
  if (normalized.includes("college")) return "college";
  return "unknown";
}

function syntheticProfile(index: number, school: School): StudentProfile {
  const year = years[index % years.length];
  const major = majors[index % majors.length];
  const citizenshipStatus = citizenshipStatuses[index % citizenshipStatuses.length];
  const type = institutionType(school.name);
  return {
    firstName: `Student${index}`,
    schoolSlug: school.slug,
    major,
    graduationYear: String(2026 + Math.max(0, 4 - years.indexOf(year))),
    year,
    careerGoal: careerGoals[index % careerGoals.length],
    interests: [major, index % 2 ? "Research" : "Internships"].join(", "),
    goals: [index % 3 ? "Finding an internship" : "Finding scholarships"],
    topics: [major, index % 2 ? "Research" : "Software"],
    preferredOpportunityTypes: [index % 2 ? "Research" : "Internships"],
    onboardingCompletedAt: "2026-07-13T00:00:00.000Z",
    institutionType: type,
    enrollmentStatus: year === "Graduate student" ? "recent_graduate" : index % 13 === 0 ? "incoming" : "enrolled",
    degreeLevel: year === "Graduate student" ? "graduate" : type === "community_college" ? "associate" : "undergraduate",
    citizenshipStatus,
    workAuthorization: citizenshipStatus === "us_citizen" || citizenshipStatus === "permanent_resident" ? "us_authorized" : index % 3 === 0 ? "us_authorized" : "unknown",
    residency: index % 4 === 0 ? "Illinois" : index % 4 === 1 ? "California" : index % 4 === 2 ? "New York" : undefined,
    age: index % 6 === 0 ? undefined : 17 + (index % 8),
    transferStatus: index % 11 === 0 ? "transfer_applicant" : index % 7 === 0 && type === "community_college" ? "community_college_student" : "not_transfer",
    financialNeedStatus: index % 3 === 0 ? "demonstrated" : index % 3 === 1 ? "not_demonstrated" : "unknown",
    meritStatus: index % 3 === 0 ? "demonstrated" : index % 3 === 1 ? "not_demonstrated" : "unknown",
    eligibilityAttributes: index % 8 === 0 ? ["women"] : index % 9 === 0 ? ["hispanic_heritage"] : [],
    gpaStatus: index % 5 === 0 ? "none_yet" : "reported",
    gpa: index % 5 === 0 ? undefined : 2.5 + (index % 15) / 10,
  };
}

function baseOpportunity(id: string, eligibilityRules: OpportunityEligibilityRules = {}): Opportunity {
  return {
    id,
    title: `Eligibility fixture ${id}`,
    type: "Benefit",
    category: "Student Benefits",
    description: "A deterministic eligibility fixture used to prove that every professional recommendation gate fails closed.",
    organization: "National Student Foundation",
    school_scope: "National",
    schools: [],
    majors: ["Any Major"],
    academic_years: ["Any Year"],
    eligibility: "Current college students who satisfy every explicitly listed requirement are eligible to participate.",
    estimated_value: null,
    application_deadline: null,
    recurring: true,
    location: "United States",
    remote: true,
    paid: null,
    tags: ["Student", "Verified", "National"],
    official_source: "https://example.org/official",
    official_source_url: "https://example.org/official",
    verification_status: "verified",
    last_verified: "2026-07-13",
    deadline: null,
    reviewer_notes: "Fixture with explicit eligibility verification.",
    estimated_value_note: "Unknown - no verified dollar value is documented by the official source.",
    date_added: "2026-07-13",
    difficulty: "Open",
    prestige: "Established",
    icon: null,
    featured: false,
    hidden_gem: false,
    metadata: {
      deadlineType: "no_deadline",
      eligibilityRules,
      verification: {
        status: "verified",
        lastVerifiedAt: "2026-07-13",
        officialSourceUrl: "https://example.org/official",
        applicationUrlVerified: true,
        deadlineVerified: true,
        eligibilityVerified: true,
        sourceReachable: true,
      },
    },
  };
}

const baselineContext = {
  schoolSlug: "university-of-chicago",
  schoolName: "University of Chicago",
  institutionType: "university" as const,
  enrollmentStatus: "enrolled" as const,
  degreeLevel: "undergraduate" as const,
  citizenshipStatus: "us_citizen" as const,
  workAuthorization: "us_authorized" as const,
  residency: "Illinois",
  age: 20,
  transferStatus: "not_transfer" as const,
  financialNeedStatus: "not_demonstrated" as const,
  meritStatus: "demonstrated" as const,
  eligibilityAttributes: [] as string[],
  academicYear: "Second year",
  major: "Mathematics",
};

const hardGateCases = [
  { name: "wrong school", opportunity: { ...baseOpportunity("wrong-school"), school_scope: "School Specific" as const, schools: ["purdue-university-main-campus"] }, context: baselineContext },
  { name: "community-college only", opportunity: baseOpportunity("community-only", { institutionTypes: ["community_college"] }), context: baselineContext },
  { name: "transfer only", opportunity: baseOpportunity("transfer-only", { transferOnly: true }), context: baselineContext },
  { name: "GPA unknown", opportunity: { ...baseOpportunity("gpa"), eligibility: "Current college students with a minimum GPA of 3.5 are eligible." }, context: { ...baselineContext, gpaStatus: "none_yet" as const, gpa: undefined } },
  { name: "citizenship mismatch", opportunity: baseOpportunity("citizenship", { citizenship: "us_citizen" }), context: { ...baselineContext, citizenshipStatus: "international" as const, workAuthorization: "us_authorized" as const } },
  { name: "work authorization unknown", opportunity: baseOpportunity("work-auth", { citizenship: "us_work_authorized" }), context: { ...baselineContext, citizenshipStatus: "international" as const, workAuthorization: "unknown" as const } },
  { name: "age unknown", opportunity: baseOpportunity("age", { minimumAge: 18 }), context: { ...baselineContext, age: undefined } },
  { name: "residency mismatch", opportunity: baseOpportunity("residency", { residency: ["California"] }), context: baselineContext },
  { name: "invitation missing", opportunity: baseOpportunity("invitation", { invitationOnly: true }), context: baselineContext },
  { name: "financial need unknown", opportunity: baseOpportunity("need", { needBased: true }), context: { ...baselineContext, financialNeedStatus: "unknown" as const } },
  { name: "demographic eligibility unknown", opportunity: baseOpportunity("demographic", { demographicRequirements: ["women"] }), context: baselineContext },
  { name: "external student unknown", opportunity: { ...baseOpportunity("external"), organization: "Example University", eligibility: "Current undergraduate students at Example University are eligible." }, context: baselineContext },
  { name: "closed cycle", opportunity: { ...baseOpportunity("closed"), metadata: { ...baseOpportunity("closed").metadata, deadlineType: "current_cycle_closed" as const, eligibilityRules: { availability: "closed" as const } } }, context: baselineContext },
  { name: "unknown eligibility", opportunity: { ...baseOpportunity("unknown"), eligibility: "Eligibility varies by program and students should check official source." }, context: baselineContext },
];

for (const testCase of hardGateCases) {
  const result = evaluateProfessionalRecommendationCandidate(testCase.opportunity, testCase.context);
  assert.equal(result.allowed, false, `${testCase.name} must fail closed.`);
  assert.ok(result.reasons.length > 0, `${testCase.name} must provide a deterministic rejection reason.`);
}

const externalPositive = { ...baseOpportunity("external-positive"), organization: "Example University", eligibility: "Open to undergraduate students from any accredited college or university in the United States." };
assert.equal(evaluateProfessionalRecommendationCandidate(externalPositive, baselineContext).allowed, true, "Explicit external-student eligibility should pass.");
assert.equal(evaluateProfessionalRecommendationCandidate(baseOpportunity("community-positive", { institutionTypes: ["community_college"] }), { ...baselineContext, institutionType: "community_college", degreeLevel: "associate" }).allowed, true, "Matching community-college eligibility should pass.");
assert.equal(evaluateProfessionalRecommendationCandidate(baseOpportunity("transfer-positive", { transferOnly: true }), { ...baselineContext, transferStatus: "transfer_applicant" }).allowed, true, "Known transfer eligibility should pass.");

const profileCount = process.argv.includes("--quick") ? 32 : 512;
let recommendationCount = 0;
let emptyProfiles = 0;
let slowestMs = 0;
const rejectionReasons = new Map<string, number>();
const segmentStats = new Map<string, { profiles: number; recommendations: number; empty: number }>();
const started = performance.now();

for (let index = 0; index < profileCount; index += 1) {
  const school = allSchools[index % allSchools.length];
  const profile = syntheticProfile(index, school);
  const advisorProfile = createAdvisorProfile({ profile, school });
  const context = buildOpportunityStudentContext(advisorProfile);
  const profileStarted = performance.now();
  const recommendations = rankOpportunityRecommendations({ advisorProfile, opportunities: professionalCatalog, limit: 8 });
  slowestMs = Math.max(slowestMs, performance.now() - profileStarted);
  recommendationCount += recommendations.length;
  if (!recommendations.length) emptyProfiles += 1;
  const segment = `${profile.year}|${profile.institutionType}|${profile.citizenshipStatus}`;
  const currentSegment = segmentStats.get(segment) ?? { profiles: 0, recommendations: 0, empty: 0 };
  currentSegment.profiles += 1;
  currentSegment.recommendations += recommendations.length;
  if (!recommendations.length) currentSegment.empty += 1;
  segmentStats.set(segment, currentSegment);
  assert.ok(recommendations.length <= 8, "Professional feeds must never exceed eight recommendations.");
  const semanticKeys = new Set<string>();
  for (const recommendation of recommendations) {
    assert.ok(recommendation.relatedOpportunityId, "Professional opportunity recommendations need an opportunity id.");
    const opportunity = catalog.find((item) => item.id === recommendation.relatedOpportunityId);
    assert.ok(opportunity, `Missing recommended opportunity ${recommendation.relatedOpportunityId}.`);
    const gate = evaluateProfessionalRecommendationCandidate(opportunity, context);
    assert.equal(gate.allowed, true, `${opportunity.id} bypassed the professional eligibility gate for profile ${index}: ${gate.reasons.join("; ")}`);
    const eligibility = evaluateOpportunityEligibility(opportunity, context);
    assert.equal(eligibility.eligible, true, `${opportunity.id} has an unresolved eligibility check.`);
    const confidence = recommendation.confidenceBreakdown;
    assert.ok(confidence.eligibilityConfidence >= 78, `${opportunity.id} has low eligibility confidence.`);
    assert.ok(confidence.metadataConfidence >= 78, `${opportunity.id} has low metadata confidence.`);
    assert.ok(confidence.verificationConfidence >= 78, `${opportunity.id} has low verification confidence.`);
    if (recommendation.tier === "explore") {
      assert.ok(confidence.recommendationConfidence >= 52, `${opportunity.id} Explore recommendation confidence is below 52.`);
      assert.notEqual(recommendation.confidenceLevel, "Low", `${opportunity.id} Explore recommendation has Low confidence.`);
    } else {
      assert.equal(recommendation.confidenceLevel, "High", `${opportunity.id} ${recommendation.tier} recommendation does not have High confidence.`);
      assert.ok(confidence.overallConfidence >= 78, `${opportunity.id} ${recommendation.tier} overall confidence is below 78.`);
      assert.ok(confidence.recommendationConfidence >= 78, `${opportunity.id} ${recommendation.tier} recommendation confidence is below 78.`);
    }
    assert.ok(recommendation.explainability.whyThisUser && recommendation.explainability.whyNow && recommendation.explainability.whyThisOpportunity && recommendation.explainability.whyAboveAlternatives, `${opportunity.id} has incomplete explainability.`);
    assert.ok(recommendation.explainability.evidence.length > 0, `${opportunity.id} has no eligibility evidence.`);
    const key = `${opportunity.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${opportunity.organization.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
    assert.equal(semanticKeys.has(key), false, `${opportunity.id} duplicates another recommendation in the same feed.`);
    semanticKeys.add(key);
  }

  if (index < 16) {
    for (const opportunity of catalog.slice(0, 300)) {
      const gate = evaluateProfessionalRecommendationCandidate(opportunity, context);
      if (!gate.allowed) for (const reason of gate.reasons) rejectionReasons.set(reason, (rejectionReasons.get(reason) ?? 0) + 1);
    }
  }
}

const elapsedMs = Math.round(performance.now() - started);
assert.ok(slowestMs < 2000, `A single recommendation run exceeded the 2 second production target (${Math.round(slowestMs)}ms).`);

console.log(JSON.stringify({
  profiles: profileCount,
  recommendations: recommendationCount,
  averageRecommendations: Number((recommendationCount / profileCount).toFixed(2)),
  emptyProfiles,
  emptyProfileRate: Number((emptyProfiles / profileCount).toFixed(3)),
  elapsedMs,
  averageEngineMs: Number((elapsedMs / profileCount).toFixed(2)),
  slowestEngineMs: Math.round(slowestMs),
  emptySegments: [...segmentStats.entries()].filter(([, value]) => value.empty > 0).map(([segment, value]) => ({ segment, ...value })),
  topRejectionReasons: [...rejectionReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
}, null, 2));
