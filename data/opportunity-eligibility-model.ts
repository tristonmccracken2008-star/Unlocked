import type {
  CanonicalEnrollmentStatus,
  CanonicalInstitutionType,
  Opportunity,
  OpportunityEducationLevel,
  RecommendationEligibilityStatus,
} from "./opportunities";

export const eligibilitySchemaVersion = "opportunity-eligibility-v3";

export type CanonicalOpportunityEligibility = {
  educationLevels: OpportunityEducationLevel[];
  enrollmentStatuses: CanonicalEnrollmentStatus[];
  institutionTypes: CanonicalInstitutionType[];
  specificSchoolIds: string[];
  hostSchoolId: string | null;
  acceptsExternalStudents: boolean | null;
  classYears: string[];
  majors: string[];
  minimumGpa: number | null;
  citizenship: string[];
  residency: string[];
  ageRange: { minimum?: number; maximum?: number } | null;
  financialNeedRequired: boolean;
  transferOnly: boolean;
  highSchoolSeniorOnly: boolean;
  invitationOnly: boolean;
  recommendationEligibilityStatus: RecommendationEligibilityStatus;
  criticalUnknowns: string[];
  evidence: string[];
};

const unique = <T,>(items: T[]) => [...new Set(items.filter(Boolean))];
const normalize = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
const normalizedEligibilityCache = new WeakMap<Opportunity, CanonicalOpportunityEligibility>();

export function opportunityEligibilityText(opportunity: Opportunity) {
  return normalize([
    opportunity.eligibility,
    opportunity.metadata.citizenship ?? "",
    opportunity.metadata.internationalEligibility ?? "",
    ...(opportunity.metadata.eligibilityNotes ?? []),
    ...(opportunity.metadata.applicationRequirements ?? []),
  ].join(" "));
}

export function opportunityHasSchoolLikeHost(opportunity: Opportunity) {
  const text = normalize(opportunity.organization);
  return /\b(university|college|institute of technology|school of|state university|community college)\b/.test(text);
}

function explicitlyAllowsExternalStudents(opportunity: Opportunity, text: string) {
  const configured = opportunity.metadata.eligibilityRules?.acceptsExternalStudents;
  if (typeof configured === "boolean") return configured;
  const legacy = opportunity.metadata.eligibilityRules?.externalStudents;
  if (legacy === "eligible") return true;
  if (legacy === "ineligible") return false;
  if (/\b(open to|available to|eligible for|welcomes?)\b.{0,120}\b(students from|undergraduates from|students at any|any accredited|all accredited|other institutions|other colleges|any college|any university|colleges and universities|nationwide|external students)\b/.test(text)) return true;
  if (/\b(all|any) (undergraduate|college|university) students\b/.test(text) || /\bstudents enrolled at (an|any) accredited\b/.test(text)) return true;
  if (/\b(open only to|limited to|restricted to)\b.{0,100}\bstudents\b/.test(text)) return false;
  return null;
}

function inferredEducationLevels(opportunity: Opportunity, text: string): OpportunityEducationLevel[] {
  const configured = opportunity.metadata.eligibilityRules?.educationLevels;
  if (configured?.length) return unique(configured);
  const highSchool = opportunity.metadata.eligibilityRules?.highSchoolSeniorOnly === true
    || /\bhigh school (?:students?|seniors?|juniors?|graduates?)\b/.test(text)
    || /\b(?:11th|12th) grade students?\b/.test(text);
  if (highSchool && !/\b(current|enrolled) (?:college|university|undergraduate) students?\b/.test(text)) return ["high_school"];
  if (/\b(current )?community college students?\b/.test(text) || /\baccredited two year college\b/.test(text)) return ["community_college"];
  const graduateOnly = /\b(graduate|masters?|master s|phd|doctoral) students? only\b/.test(text);
  if (graduateOnly || opportunity.academic_years.length === 1 && opportunity.academic_years[0] === "Graduate student") return ["graduate"];
  const recentGraduate = /\brecent graduates?\b/.test(text);
  const undergraduate = /\b(undergraduate|bachelor s|baccalaureate|college students?|university students?)\b/.test(text)
    || opportunity.academic_years.some((year) => ["First year", "Second year", "Third year", "Fourth year", "Any Year"].includes(year));
  const broadCollegeAccess = ["Benefit", "AI"].includes(opportunity.type)
    && !/\b(undergraduate|bachelor s|baccalaureate|four year|4 year)\b/.test(text);
  return unique([undergraduate ? "undergraduate" : "", broadCollegeAccess ? "community_college" : "", recentGraduate ? "recent_graduate" : ""] as OpportunityEducationLevel[]);
}

function inferredInstitutionTypes(opportunity: Opportunity, educationLevels: OpportunityEducationLevel[], text: string): CanonicalInstitutionType[] {
  const explicit = opportunity.metadata.eligibilityRules?.canonicalInstitutionTypes;
  if (explicit?.length) return unique(explicit);
  const legacy = opportunity.metadata.eligibilityRules?.institutionTypes ?? [];
  if (legacy.length) return unique(legacy.map((value) => value === "community_college" ? "community_college" : value === "university" ? "university" : value === "liberal_arts_college" ? "liberal_arts_college" : "four_year_college"));
  if (educationLevels.includes("high_school")) return ["high_school"];
  if (educationLevels.includes("community_college") && !educationLevels.includes("undergraduate")) return ["community_college"];
  if (/\b(four|4) year (college|university|institution)\b/.test(text) || /\bbachelor s degree program\b/.test(text)) return ["four_year_college", "university", "liberal_arts_college"];
  if (educationLevels.includes("graduate") && !educationLevels.includes("undergraduate")) return ["graduate_school", "university"];
  if (educationLevels.includes("undergraduate")) return ["community_college", "four_year_college", "university", "liberal_arts_college"];
  return [];
}

function inferredEnrollmentStatuses(opportunity: Opportunity, educationLevels: OpportunityEducationLevel[], text: string): CanonicalEnrollmentStatus[] {
  const explicit = opportunity.metadata.eligibilityRules?.canonicalEnrollmentStatuses;
  if (explicit?.length) return unique(explicit);
  const legacy = opportunity.metadata.eligibilityRules?.enrollmentStatuses ?? [];
  if (legacy.length) return unique(legacy.map((value) => value === "incoming" ? "prospective" : value === "recent_graduate" ? "graduated" : "currently_enrolled"));
  if (educationLevels.includes("high_school")) return ["prospective"];
  if (opportunity.metadata.eligibilityRules?.transferOnly === true || /\btransfer (students?|applicants?)\b/.test(text)) return ["transfer_applicant"];
  const statuses: CanonicalEnrollmentStatus[] = [];
  if (/\b(current student|currently enrolled|actively enrolled|matriculated|degree seeking|degree-seeking|undergraduate student)\b/.test(text) || educationLevels.some((level) => ["community_college", "undergraduate", "graduate"].includes(level))) statuses.push("currently_enrolled");
  if (/\b(incoming|prospective|admitted) students?\b/.test(text)) statuses.push("prospective");
  if (educationLevels.includes("recent_graduate") || /\brecent graduates?\b/.test(text)) statuses.push("graduated");
  return unique(statuses);
}

function inferredCitizenship(opportunity: Opportunity, text: string) {
  const explicit = opportunity.metadata.eligibilityRules?.citizenshipStatuses;
  if (explicit?.length) return unique(explicit);
  const legacy = opportunity.metadata.eligibilityRules?.citizenship;
  if (legacy && legacy !== "unknown") return [legacy];
  if (/\binternational students? (are )?(eligible|welcome|may apply)\b/.test(text)) return ["international_allowed"];
  if (/\bmust be (a )?(u s|us|united states) citizen\b/.test(text) || /\b(u s|us|united states) citizens? only\b/.test(text)) return ["us_citizen"];
  if (/\b(u s|us|united states) citizens? (or|and) (u s )?permanent residents?\b/.test(text)) return ["us_citizen", "permanent_resident"];
  if (/\b(authorized|eligible) to work in the (u s|us|united states)\b/.test(text)) return ["us_work_authorized"];
  return [];
}

function numericGpa(opportunity: Opportunity, text: string) {
  if (typeof opportunity.metadata.eligibilityRules?.minimumGpa === "number") return opportunity.metadata.eligibilityRules.minimumGpa;
  const match = text.match(/\b(?:minimum|cumulative|at least|gpa of)\s*(?:gpa\s*)?(?:of\s*)?([0-4](?:\.\d{1,2})?)\b/);
  return match ? Number(match[1]) : null;
}

export function normalizeOpportunityEligibility(opportunity: Opportunity): CanonicalOpportunityEligibility {
  const cached = normalizedEligibilityCache.get(opportunity);
  if (cached) return cached;
  const text = opportunityEligibilityText(opportunity);
  const configured = opportunity.metadata.eligibilityRules ?? {};
  const educationLevels = inferredEducationLevels(opportunity, text);
  const institutionTypes = inferredInstitutionTypes(opportunity, educationLevels, text);
  const enrollmentStatuses = inferredEnrollmentStatuses(opportunity, educationLevels, text);
  const specificSchoolIds = unique([...(configured.specificSchoolIds ?? []), ...(opportunity.school_scope === "School Specific" ? opportunity.schools : [])]);
  const schoolHost = Boolean(configured.hostSchoolId) || opportunityHasSchoolLikeHost(opportunity);
  const acceptsExternalStudents = opportunity.school_scope === "School Specific"
    ? false
    : typeof configured.acceptsExternalStudents === "boolean"
      ? configured.acceptsExternalStudents
      : schoolHost
        ? explicitlyAllowsExternalStudents(opportunity, text)
        : null;
  const citizenship = inferredCitizenship(opportunity, text);
  const citizenshipMentioned = /\b(citizenship|citizen|permanent resident|green card|work authorization|international eligibility)\b/.test(text);
  const highSchoolSeniorOnly = configured.highSchoolSeniorOnly === true || /\bhigh school seniors?\b/.test(text);
  const transferOnly = configured.transferOnly === true || /\b(transfer students? only|community college students? (?:planning|seeking|preparing) to transfer|undergraduate transfer scholarship)\b/.test(text);
  const criticalUnknowns = unique([
    educationLevels.length ? "" : "education_level",
    institutionTypes.length || educationLevels.includes("recent_graduate") ? "" : "institution_type",
    enrollmentStatuses.length || educationLevels.includes("recent_graduate") ? "" : "enrollment_status",
    schoolHost && opportunity.school_scope === "National" && acceptsExternalStudents === null ? "external_student_eligibility" : "",
    citizenshipMentioned && !citizenship.length ? "citizenship" : "",
    /\b(eligibility varies|requirements vary|eligibility depends|institution specific|program specific requirements|unknown)\b/.test(text) ? "variable_eligibility" : "",
  ]);
  let recommendationEligibilityStatus = configured.recommendationEligibilityStatus;
  if (!recommendationEligibilityStatus) {
    if (["expired", "archived", "broken_source", "incomplete"].includes(opportunity.verification_status)) recommendationEligibilityStatus = "ineligible";
    else if (opportunity.verification_status !== "verified") recommendationEligibilityStatus = "needs_eligibility_review";
    else if (criticalUnknowns.length) recommendationEligibilityStatus = "needs_eligibility_review";
    else if (configured.availability === "closed" || opportunity.metadata.deadlineType === "current_cycle_closed") recommendationEligibilityStatus = "discover_only";
    else recommendationEligibilityStatus = "eligible_for_ranking";
  }
  const normalized: CanonicalOpportunityEligibility = {
    educationLevels,
    enrollmentStatuses,
    institutionTypes,
    specificSchoolIds,
    hostSchoolId: configured.hostSchoolId ?? null,
    acceptsExternalStudents,
    classYears: unique(configured.classYears?.length ? configured.classYears : opportunity.academic_years),
    majors: unique(configured.majors?.length ? configured.majors : opportunity.majors),
    minimumGpa: numericGpa(opportunity, text),
    citizenship,
    residency: unique(configured.residency ?? []),
    ageRange: configured.ageRange ?? (configured.minimumAge || configured.maximumAge ? { minimum: configured.minimumAge, maximum: configured.maximumAge } : null),
    financialNeedRequired: configured.financialNeedRequired ?? configured.needBased === true,
    transferOnly,
    highSchoolSeniorOnly,
    invitationOnly: configured.invitationOnly === true,
    recommendationEligibilityStatus,
    criticalUnknowns,
    evidence: unique([
      ...(configured.evidence ?? []),
      opportunity.eligibility,
      opportunity.school_scope === "School Specific" ? `School restriction: ${opportunity.schools.join(", ")}.` : "",
    ]),
  };
  normalizedEligibilityCache.set(opportunity, normalized);
  return normalized;
}
