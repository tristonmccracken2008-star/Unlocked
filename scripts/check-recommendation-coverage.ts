import assert from "node:assert/strict";
import { createAdvisorProfile } from "../data/advisor-engine";
import { evaluateOpportunityEligibility } from "../data/opportunity-eligibility";
import { normalizeOpportunityEligibility } from "../data/opportunity-eligibility-model";
import { buildOpportunityStudentContext, buildRecommendationCandidateFunnel, rankOpportunityRecommendations, type RecommendationTier } from "../data/recommendation-engine";
import { validateOpportunityData } from "../data/recommendation-professional-pipeline";
import { opportunities, type Opportunity } from "../data/opportunities";
import { schools, type School } from "../data/seed";
import type { StudentProfile } from "../data/student-profile";

type GoldenProfile = {
  id: string;
  school: School;
  profile: StudentProfile | null;
  eligibilityContext?: ReturnType<typeof buildOpportunityStudentContext>;
  mustNotAppear: string[];
  allowedOpportunityClasses: string[];
  minimumUsefulRecommendationCount: number;
  acceptableFallbackCategories: string[];
  forbiddenExplanationClaims: RegExp[];
};

const schoolBySlug = (slug: string) => schools.find((item) => item.slug === slug) ?? schools[0];
const caltech: School = { slug: "california-institute-of-technology", name: "California Institute of Technology", aliases: ["Caltech"], domain: "caltech.edu", location: "Pasadena, CA", initials: "CIT", website: "https://www.caltech.edu", benefitSlugs: [] };
const baseSchools = [
  schoolBySlug("university-of-chicago"),
  schoolBySlug("purdue-university-main-campus"),
  caltech,
  schoolBySlug("university-of-california-berkeley"),
  schoolBySlug("miami-dade-college"),
].filter(Boolean);
const majors = ["Mathematics", "Biology", "Engineering", "Physics", "Computer Science", "Economics", "English", "Data Science", "Political Science", "Psychology", "Business", "Undecided"];
const careerGoals = ["Quantitative Finance", "Medicine", "Software Engineering", "Research", "Investment Banking", "Publishing", "Public Policy", "Consulting", "Graduate School", "Undecided"];
const years = ["First year", "Second year", "Third year", "Fourth year"];
const highSchoolOnlyIds = opportunities.filter((item) => normalizeOpportunityEligibility(item).highSchoolSeniorOnly).map((item) => item.id);
const cciId = "research--doe-cci";
const allOpportunityClasses = ["Benefit", "AI", "Career", "Research", "Scholarship"];
const fallbackCategories = ["Software", "AI Tools", "Certifications", "Career Resources", "Competitions", "Student Benefits", "Productivity", "Developer Tools", "Fellowships"];

function institutionType(school: School): NonNullable<StudentProfile["institutionType"]> {
  const name = school.name.toLowerCase();
  if (name.includes("community college") || name.includes("technical college")) return "community_college";
  if (name.includes("university") || name.includes("institute of technology")) return "university";
  return "college";
}

function profileFor(index: number, school: School, overrides: Partial<StudentProfile> = {}): StudentProfile {
  const type = institutionType(school);
  const year = years[index % years.length];
  const major = majors[index % majors.length];
  const citizenshipStatus = index % 17 === 0 ? "international" : index % 9 === 0 ? "permanent_resident" : "us_citizen";
  return {
    firstName: `Golden${index}`,
    schoolSlug: school.slug,
    major,
    graduationYear: String(2030 - years.indexOf(year)),
    year,
    careerGoal: careerGoals[index % careerGoals.length],
    interests: `${major}, ${index % 2 ? "Research" : "Internships"}, ${index % 3 ? "Software" : "Scholarships"}`,
    topics: [major, index % 2 ? "Research" : "Software"],
    goals: [index % 2 ? "Join research" : "Find internship"],
    currentPriority: index % 2 ? "Join research" : "Finding an internship",
    preferredOpportunityTypes: [index % 2 ? "Research" : "Internships"],
    gpaStatus: index % 8 === 0 ? "none_yet" : "reported",
    gpa: index % 8 === 0 ? undefined : 3.1 + (index % 8) / 10,
    institutionType: type,
    enrollmentStatus: "enrolled",
    degreeLevel: type === "community_college" ? "associate" : "undergraduate",
    citizenshipStatus,
    workAuthorization: citizenshipStatus === "international" ? "unknown" : "us_authorized",
    transferStatus: type === "community_college" ? "community_college_student" : "not_transfer",
    financialNeedStatus: index % 4 === 0 ? "demonstrated" : "unknown",
    meritStatus: index % 5 === 0 ? "demonstrated" : "unknown",
    eligibilityAttributes: index % 10 === 0 ? ["women", "gender_minority_in_aerospace"] : [],
    ...overrides,
  };
}

function golden(id: string, profile: StudentProfile, school: School, minimum = 4): GoldenProfile {
  const mustNotAppear = [
    ...(profile.institutionType === "community_college" ? [] : [cciId]),
    ...(profile.enrollmentStatus === "enrolled" ? highSchoolOnlyIds : []),
    ...opportunities.filter((item) => item.school_scope === "School Specific" && !item.schools.includes(profile.schoolSlug)).slice(0, 20).map((item) => item.id),
  ];
  return {
    id,
    school,
    profile,
    mustNotAppear,
    allowedOpportunityClasses: allOpportunityClasses,
    minimumUsefulRecommendationCount: minimum,
    acceptableFallbackCategories: fallbackCategories,
    forbiddenExplanationClaims: [/available through your university/i, /matches your school/i],
  };
}

const uChicago = schoolBySlug("university-of-chicago");
const purdue = schoolBySlug("purdue-university-main-campus");
const miamiDade = schoolBySlug("miami-dade-college");
const named: GoldenProfile[] = [
  golden("uchicago-math-cs-freshman-quant", profileFor(1, uChicago, { major: "Mathematics", minor: "Computer Science", year: "First year", careerGoal: "Quantitative Finance", interests: "Finance, Software, Research" }), uChicago),
  golden("uchicago-biology-premed-freshman", profileFor(2, uChicago, { major: "Biology", year: "First year", careerGoal: "Medicine", interests: "Healthcare, Research, Scholarships" }), uChicago),
  golden("purdue-engineering-sophomore", profileFor(3, purdue, { major: "Engineering", year: "Second year", careerGoal: "Engineering", interests: "Engineering, Internships, Robotics" }), purdue),
  golden("caltech-physics", profileFor(4, caltech, { major: "Physics", year: "Second year", careerGoal: "Research", interests: "Physics, Research, Space" }), caltech),
  golden("community-college-transfer", profileFor(5, miamiDade, { major: "Computer Science", year: "Second year", careerGoal: "Software Engineering", institutionType: "community_college", degreeLevel: "associate", transferStatus: "transfer_applicant", age: 20, gpaStatus: "reported", gpa: 3.4 }), miamiDade, 2),
  golden("four-year-university-freshman", profileFor(6, uChicago, { year: "First year", major: "Economics", careerGoal: "Consulting" }), uChicago),
  golden("international-cs-undergraduate", profileFor(7, purdue, { major: "Computer Science", citizenshipStatus: "international", workAuthorization: "unknown", careerGoal: "Software Engineering" }), purdue, 3),
  golden("economics-junior-banking", profileFor(8, uChicago, { major: "Economics", year: "Third year", careerGoal: "Investment Banking", interests: "Finance, Banking, Internships" }), uChicago),
  golden("english-publishing", profileFor(9, uChicago, { major: "English", careerGoal: "Publishing", interests: "Writing, Publishing, Communications" }), uChicago, 3),
  golden("no-gpa", profileFor(10, purdue, { gpaStatus: "none_yet", gpa: undefined }), purdue),
  golden("undecided", profileFor(11, uChicago, { major: "Undecided", careerGoal: "Undecided", interests: "Explore careers, Student Benefits" }), uChicago, 3),
  golden("research-interest", profileFor(12, caltech, { major: "Biology", careerGoal: "Research", interests: "Research, Graduate School" }), caltech),
  golden("remote-interest", profileFor(13, purdue, { major: "Data Science", interests: "Remote, Software, AI", careerGoal: "Data Science" }), purdue),
];

const highSchoolContext = {
  schoolSlug: "high-school-fixture",
  schoolName: "Public High School",
  institutionType: "high_school" as const,
  enrollmentStatus: "incoming" as const,
  degreeLevel: "high_school" as const,
  citizenshipStatus: "us_citizen" as const,
  workAuthorization: "us_authorized" as const,
  transferStatus: "not_transfer" as const,
  financialNeedStatus: "demonstrated" as const,
  meritStatus: "unknown" as const,
  academicYear: "First year",
  major: "Computer Science",
  gpaStatus: "reported" as const,
  gpa: 3.7,
};
named.push({ id: "first-generation-high-school-senior", school: uChicago, profile: null, eligibilityContext: highSchoolContext, mustNotAppear: [cciId], allowedOpportunityClasses: ["Scholarship"], minimumUsefulRecommendationCount: 0, acceptableFallbackCategories: ["First-Year Scholarships"], forbiddenExplanationClaims: [] });

const profiles: GoldenProfile[] = [...named];
for (let index = profiles.length; index < 250; index += 1) {
  const variant = index % 4;
  const school = baseSchools[variant % baseSchools.length];
  profiles.push(golden(`realistic-undergraduate-${index}`, profileFor(variant, school), school, institutionType(school) === "community_college" ? 2 : 3));
}
assert.equal(profiles.length, 250, "Coverage suite must contain exactly 250 explicit golden profiles.");

const rankingCatalog = opportunities.filter((item) => validateOpportunityData(item).allowed);
let totalRecommendations = 0;
let emptyUndergraduates = 0;
const tierCounts: Record<RecommendationTier, number> = { excellent: 0, strong: 0, explore: 0 };
const started = performance.now();
const recommendationCache = new Map<string, ReturnType<typeof rankOpportunityRecommendations>>();

for (const goldenProfile of profiles) {
  if (!goldenProfile.profile) {
    assert.ok(goldenProfile.eligibilityContext, `${goldenProfile.id} needs an eligibility context.`);
    const highSchoolCandidate = opportunities.find((item) => item.id === "scholarship--amazon-future-engineer");
    assert.ok(highSchoolCandidate, "The high-school golden profile needs the real Amazon fixture.");
    assert.equal(evaluateOpportunityEligibility(highSchoolCandidate, goldenProfile.eligibilityContext).eligible, true, `${highSchoolCandidate.id} should recognize the eligible high-school profile even while the closed cycle remains outside ranking.`);
    continue;
  }
  const advisorProfile = createAdvisorProfile({ profile: goldenProfile.profile, school: goldenProfile.school });
  const context = buildOpportunityStudentContext(advisorProfile);
  const cacheKey = JSON.stringify({ ...goldenProfile.profile, firstName: "", school: goldenProfile.school.slug });
  const cachedRecommendations = recommendationCache.get(cacheKey);
  const recommendations = cachedRecommendations ?? rankOpportunityRecommendations({ advisorProfile, opportunities: rankingCatalog, limit: 8 });
  if (!cachedRecommendations) recommendationCache.set(cacheKey, recommendations);
  totalRecommendations += recommendations.length;
  if (!recommendations.length) emptyUndergraduates += 1;
  assert.ok(recommendations.length >= goldenProfile.minimumUsefulRecommendationCount, `${goldenProfile.id} returned ${recommendations.length}; expected at least ${goldenProfile.minimumUsefulRecommendationCount}.`);
  const ids = new Set(recommendations.map((item) => item.relatedOpportunityId));
  for (const forbiddenId of goldenProfile.mustNotAppear) assert.equal(ids.has(forbiddenId), false, `${goldenProfile.id} received forbidden ${forbiddenId}.`);
  for (const recommendation of recommendations) {
    tierCounts[recommendation.tier] += 1;
    const opportunity = rankingCatalog.find((item) => item.id === recommendation.relatedOpportunityId);
    assert.ok(opportunity, `${recommendation.relatedOpportunityId} must resolve in the production ranking index.`);
    assert.ok(goldenProfile.allowedOpportunityClasses.includes(opportunity.type), `${goldenProfile.id} received an unsupported opportunity class ${opportunity.type}.`);
    const evaluation = evaluateOpportunityEligibility(opportunity, context);
    assert.equal(evaluation.eligible, true, `${goldenProfile.id} received ineligible ${opportunity.id}: ${evaluation.failures.join("; ")}`);
    assert.equal(evaluation.canonical.recommendationEligibilityStatus, "eligible_for_ranking", `${opportunity.id} is quarantined from Pro ranking.`);
    const explanation = `${recommendation.reasons.join(" ")} ${recommendation.explainability.whyThisUser} ${recommendation.explainability.whyNow}`;
    if (opportunity.school_scope !== "School Specific") for (const forbiddenClaim of goldenProfile.forbiddenExplanationClaims) assert.doesNotMatch(explanation, forbiddenClaim, `${opportunity.id} made an unsupported school claim.`);
    if (recommendation.tier === "explore") assert.ok(goldenProfile.acceptableFallbackCategories.includes(opportunity.category) || ["Benefit", "AI", "Career", "Research", "Scholarship"].includes(opportunity.type), `${opportunity.id} is not an acceptable fallback.`);
  }
}

const representative = profiles.find((item) => item.id === "uchicago-math-cs-freshman-quant");
assert.ok(representative?.profile, "Representative profile must exist.");
const representativeAdvisor = createAdvisorProfile({ profile: representative.profile, school: representative.school });
const funnel = buildRecommendationCandidateFunnel({ advisorProfile: representativeAdvisor, opportunities: rankingCatalog, limit: 8 });
assert.ok(funnel.finalRecommendations > 0, "The production funnel must select recommendations for the UChicago regression profile.");
assert.ok(funnel.verificationEligible >= funnel.finalRecommendations, "Funnel counts must remain monotonic at selection.");
assert.equal(emptyUndergraduates, 0, "No valid undergraduate golden profile may receive an empty feed while safe candidates exist.");

const gapCounts = new Map<string, number>();
const statusCounts = new Map<string, number>();
for (const opportunity of opportunities) {
  const canonical = normalizeOpportunityEligibility(opportunity);
  statusCounts.set(canonical.recommendationEligibilityStatus, (statusCounts.get(canonical.recommendationEligibilityStatus) ?? 0) + 1);
  for (const gap of canonical.criticalUnknowns) gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
}

console.log(JSON.stringify({
  goldenProfiles: profiles.length,
  rankedUndergraduates: profiles.filter((item) => item.profile).length,
  totalRecommendations,
  averageRecommendations: Number((totalRecommendations / profiles.filter((item) => item.profile).length).toFixed(2)),
  emptyUndergraduates,
  tierCounts,
  elapsedMs: Math.round(performance.now() - started),
  representativeFunnel: funnel,
  totalCatalogOpportunities: opportunities.length,
  catalogRecommendationStatuses: Object.fromEntries([...statusCounts.entries()].sort()),
  remainingCriticalMetadataGaps: Object.fromEntries([...gapCounts.entries()].sort((a, b) => b[1] - a[1])),
}, null, 2));
