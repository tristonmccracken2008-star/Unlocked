import assert from "node:assert/strict";
import { applyOnboardingPersonalization, onboardingProfileV2Issues, personalizationFromLegacyProfile, type OnboardingPersonalization } from "../data/onboarding-personalization";
import { onboardingSchemaVersion } from "../data/onboarding-options";
import { buildRecommendationService } from "../data/recommendation-service";
import { buildOpportunityStudentContext } from "../data/recommendation-engine";
import { createAdvisorProfile } from "../data/advisor-engine";
import { getOpportunityIntelligence } from "../data/opportunity-intelligence";
import { opportunities } from "../data/opportunities";
import { schoolDirectory } from "../data/school-directory";
import type { StudentProfile } from "../data/student-profile";
import { cleanStudentProfile } from "../lib/account-input";

const school = schoolDirectory.find((item) => item.slug === "university-of-chicago")!;
const completedAt = "2026-08-01T12:00:00.000Z";
const emptyActivity = { viewed: [], saved: [], claimed: [], tracked: {} };
const emptyProgress = { milestones: {}, applications: {} };

type Persona = {
  name: string;
  academic?: Partial<StudentProfile>;
  answers: OnboardingPersonalization;
};

const defaults: OnboardingPersonalization = {
  opportunityTypeInterests: ["Internships", "Scholarships and grants", "Research"],
  fieldInterests: ["Computer Science and AI"],
  goals: ["Building professional experience"],
  specificCareerInterests: [],
  locationFormats: ["no_preference"],
  compensationPreference: "no_preference",
  timeCommitments: ["no_preference"],
};

const personas: Persona[] = [
  { name: "Math and CS pursuing quant", academic: { major: "Mathematics", secondaryMajor: "Computer Science" }, answers: { ...defaults, fieldInterests: ["Computer Science and AI", "Business and Finance"], goals: ["Finding my first internship", "Building technical or practical skills"], specificCareerInterests: ["Quantitative Finance"], compensationPreference: "prefer_paid", timeCommitments: ["summer"] } },
  { name: "Undecided first year", academic: { major: "Undeclared" }, answers: { ...defaults, opportunityTypeInterests: ["Still exploring"], fieldInterests: ["Still exploring"], goals: ["Still figuring it out"], specificCareerInterests: ["Not sure yet"] } },
  { name: "Pre-med", academic: { major: "Biology" }, answers: { ...defaults, fieldInterests: ["Medicine and Health", "Natural Sciences"], goals: ["Finding research experience", "Preparing for graduate or professional school"], specificCareerInterests: ["Medicine", "Public Health"] } },
  { name: "Humanities", academic: { major: "English" }, answers: { ...defaults, opportunityTypeInterests: ["Fellowships and academic programs", "Scholarships and grants"], fieldInterests: ["Humanities", "Arts, Design, and Media"], goals: ["Building professional experience"], specificCareerInterests: ["Journalism"] } },
  { name: "Engineering", academic: { major: "Mechanical Engineering" }, answers: { ...defaults, fieldInterests: ["Engineering"], goals: ["Building technical or practical skills", "Finding my first internship"] } },
  { name: "Financial support", academic: { major: "Economics", financialNeedStatus: "demonstrated" }, answers: { ...defaults, opportunityTypeInterests: ["Scholarships and grants", "Jobs and part-time work"], fieldInterests: ["Business and Finance"], goals: ["Finding scholarships or financial support", "Finding a job during school"], compensationPreference: "prefer_paid" } },
  { name: "Research seeker", academic: { major: "Psychology" }, answers: { ...defaults, opportunityTypeInterests: ["Research", "Fellowships and academic programs"], fieldInterests: ["Social Sciences"], goals: ["Finding research experience"], specificCareerInterests: ["Academic Research"] } },
  { name: "Part-time work seeker", academic: { major: "History" }, answers: { ...defaults, opportunityTypeInterests: ["Jobs and part-time work"], fieldInterests: ["Humanities"], goals: ["Finding a job during school"], compensationPreference: "prefer_paid", timeCommitments: ["semester", "year_round"] } },
  { name: "Double major", academic: { major: "Economics", secondaryMajor: "Political Science" }, answers: { ...defaults, fieldInterests: ["Business and Finance", "Law and Public Policy"], goals: ["Growing my network"], specificCareerInterests: ["Consulting", "Law"] } },
  { name: "No minor", academic: { major: "Data Science", minorStatus: "none" }, answers: { ...defaults, fieldInterests: ["Computer Science and AI"], specificCareerInterests: ["Data Science"] } },
  { name: "Custom school", academic: { schoolSlug: "custom-lakeshore-college", schoolName: "Lakeshore College", major: "Public Health" }, answers: { ...defaults, fieldInterests: ["Medicine and Health"], specificCareerInterests: ["Public Health"] } },
  { name: "Still exploring", academic: { major: "Interdisciplinary Studies" }, answers: { ...defaults, opportunityTypeInterests: ["Still exploring"], fieldInterests: ["Still exploring"], goals: ["Exploring possible careers"], specificCareerInterests: [] } },
];

function buildProfile(persona: Persona) {
  const base: StudentProfile = {
    firstName: "Avery",
    schoolSlug: school.slug,
    major: "Mathematics",
    graduationYear: "2030",
    year: "First year",
    careerGoal: "Exploring possible careers",
    interests: "Still exploring",
    minorStatus: "none",
    gpaStatus: "none_yet",
    onboardingCompletedAt: completedAt,
    ...persona.academic,
  };
  return applyOnboardingPersonalization(base, persona.answers);
}

const representativeResults: Record<string, string[]> = {};
for (const persona of personas) {
  const projected = buildProfile(persona);
  assert.equal(projected.onboardingSchemaVersion, onboardingSchemaVersion);
  assert.deepEqual(onboardingProfileV2Issues(projected), [], `${persona.name} must pass V2 validation.`);
  const cleaned = cleanStudentProfile(projected);
  assert.ok(cleaned, `${persona.name} must survive the account input cleaner.`);
  assert.deepEqual(onboardingProfileV2Issues(cleaned), [], `${persona.name} must remain valid after server cleaning.`);
  assert.equal(new Set([cleaned.major, cleaned.secondaryMajor].filter(Boolean)).size, [cleaned.major, cleaned.secondaryMajor].filter(Boolean).length, `${persona.name} must not duplicate majors.`);
  assert.equal(new Set(cleaned.goals).size, cleaned.goals?.length, `${persona.name} must not duplicate goals.`);

  const recommendationSchool = cleaned.schoolSlug === school.slug ? school : {
    ...school,
    slug: cleaned.schoolSlug,
    name: cleaned.schoolName ?? cleaned.schoolSlug,
    aliases: [],
    domain: "",
    location: "",
    initials: (cleaned.schoolName ?? "School").split(/\s+/).map((part) => part[0]).join("").slice(0, 5).toUpperCase(),
    benefitSlugs: [],
  };
  const advisorProfile = createAdvisorProfile({ profile: cleaned, school: recommendationSchool, activity: emptyActivity, progress: emptyProgress });
  const context = buildOpportunityStudentContext(advisorProfile);
  assert.equal(context.secondaryMajor, cleaned.secondaryMajor);
  assert.deepEqual(context.currentGoals, cleaned.goals);
  assert.deepEqual(context.locationFormats, persona.answers.locationFormats);
  assert.equal(context.compensationPreference, persona.answers.compensationPreference);
  assert.deepEqual(context.timeCommitments, persona.answers.timeCommitments);

  const result = buildRecommendationService({ profile: cleaned, school: recommendationSchool, activity: emptyActivity, progress: emptyProgress, source: opportunities, feedRotationKey: "2026-08-01" });
  assert.ok(result.recommendations.length > 0, `${persona.name} must receive at least one eligible cold-start recommendation.`);
  const ids = result.recommendations.map((item) => item.opportunity?.id).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, `${persona.name} must not receive duplicate opportunities.`);
  const organizations = result.recommendations.map((item) => item.opportunity?.organization).filter(Boolean);
  assert.ok(Math.max(...[...new Set(organizations)].map((organization) => organizations.filter((item) => item === organization).length)) <= 2, `${persona.name} must not be dominated by one organization.`);
  const types = result.recommendations.map((item) => item.opportunity?.type).filter(Boolean);
  assert.ok(Math.max(...[...new Set(types)].map((type) => types.filter((item) => item === type).length)) <= 3, `${persona.name} must not contain four results of one opportunity type.`);
  if (persona.answers.compensationPreference === "paid_only") {
    assert.ok(result.recommendations.every((item) => item.opportunity && getOpportunityIntelligence(item.opportunity).payStatus === "Paid"), `${persona.name} must receive only positively paid opportunities.`);
  }
  representativeResults[persona.name] = result.recommendations.slice(0, 4).map((item) => `${item.opportunity?.type}: ${item.opportunity?.title}`);
}

const legacy: StudentProfile = {
  firstName: "Jordan",
  schoolSlug: school.slug,
  major: "Economics",
  graduationYear: "2029",
  year: "Sophomore",
  careerGoal: "Investment Banking",
  interests: "Finance, Internships, Scholarships",
  currentPriority: "Finding scholarships",
  preferredOpportunityTypes: ["Internships", "Scholarships"],
  goals: ["Finding scholarships"],
  topics: ["Finance", "Internships", "Scholarships"],
  onboardingCompletedAt: completedAt,
};
const migrated = personalizationFromLegacyProfile(legacy);
assert.ok(migrated.opportunityTypeInterests.includes("Internships"));
assert.ok(migrated.opportunityTypeInterests.includes("Scholarships and grants"));
assert.deepEqual(migrated.fieldInterests, legacy.topics, "Ambiguous legacy topics must be preserved exactly rather than guessed.");
assert.ok(migrated.goals.includes("Finding scholarships or financial support"));
assert.equal(legacy.onboardingSchemaVersion, undefined, "Migration must not mutate an existing profile in place.");

const contradictory = buildProfile(personas[0]!);
contradictory.fieldInterests = ["Still exploring", "Engineering"];
assert.ok(onboardingProfileV2Issues(contradictory).includes("fieldInterests"), "Server validation must reject contradictory exploration choices.");

const paidOnlyProfile = buildProfile({ ...personas[0]!, answers: { ...personas[0]!.answers, compensationPreference: "paid_only" } });
const paidOnlyResult = buildRecommendationService({ profile: paidOnlyProfile, school, activity: emptyActivity, progress: emptyProgress, source: opportunities, feedRotationKey: "2026-08-01" });
assert.ok(paidOnlyResult.recommendations.every((item) => item.opportunity && getOpportunityIntelligence(item.opportunity).payStatus === "Paid"), "Paid-only must fail closed rather than return uncertain or unpaid opportunities.");

console.log("Onboarding personalization checks passed", { personas: personas.length + 1, representativeResults });
