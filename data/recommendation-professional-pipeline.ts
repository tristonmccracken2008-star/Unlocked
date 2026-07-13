import type { AdvisorProfile } from "./advisor-engine";
import { getDeadlineDays, getMatchingMajors, getMatchingMinor, gpaRequirement, isSchoolEligible, type OpportunityStudentContext } from "./opportunity-intelligence";
import { recommendationConfig } from "./recommendation-config";
import type { RecommendationV1 } from "./recommendation-engine";
import type { Opportunity } from "./opportunities";

export type RecommendationPipelineStage =
  | "data_validation"
  | "eligibility_engine"
  | "recommendation_engine"
  | "career_advisor"
  | "explanation_engine"
  | "quality_auditor";

export type CandidateGateResult = {
  allowed: boolean;
  stage: RecommendationPipelineStage;
  reasons: string[];
  confidenceImpact: "none" | "low" | "medium" | "high";
};

export type RecommendationAuditResult = {
  approved: boolean;
  rejections: string[];
  warnings: string[];
};

export type RecommendationHealthMonitor = {
  totalReviewed: number;
  rejected: number;
  wrongSchool: number;
  wrongYear: number;
  wrongGpa: number;
  expiredOrArchived: number;
  duplicateOrganizations: number;
  lowConfidence: number;
  coverage: {
    categories: number;
    types: number;
    organizations: number;
  };
};

type EligibilityProof = {
  key: string;
  proven: boolean;
  reason: string;
};

const normalize = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();

function eligibilityText(opportunity: Opportunity) {
  return normalize([
    opportunity.title,
    opportunity.organization,
    opportunity.category,
    opportunity.description,
    opportunity.eligibility,
    opportunity.location,
    opportunity.metadata.citizenship ?? "",
    opportunity.metadata.internationalEligibility ?? "",
    ...(opportunity.metadata.eligibilityNotes ?? []),
    ...(opportunity.metadata.applicationRequirements ?? []),
    ...opportunity.tags,
  ].join(" "));
}

function rawEligibilityText(opportunity: Opportunity) {
  return [
    opportunity.eligibility,
    opportunity.metadata.citizenship ?? "",
    opportunity.metadata.internationalEligibility ?? "",
    ...(opportunity.metadata.eligibilityNotes ?? []),
    ...(opportunity.metadata.applicationRequirements ?? []),
  ].join(" ");
}

function hasUnknownEligibilityLanguage(opportunity: Opportunity) {
  const text = normalize(rawEligibilityText(opportunity));
  return [
    "eligibility varies",
    "requirements vary",
    "check official source",
    "confirm current eligibility",
    "site specific",
    "project specific requirements",
    "program specific requirements",
    "institution specific",
    "not documented",
    "unknown",
  ].some((phrase) => text.includes(phrase));
}

function isSchoolLikeHost(opportunity: Opportunity) {
  const text = normalize(`${opportunity.organization} ${opportunity.title}`);
  return /\b(university|college|institute of technology|school of|state university|community college)\b/.test(text);
}

function hasExternalStudentProof(opportunity: Opportunity) {
  const text = eligibilityText(opportunity);
  return /\b(open to|available to|eligible for|welcomes?)\b.*\b(students from|undergraduates from|students at|any accredited|all accredited|other institutions|other colleges|any college|any university|colleges and universities|nationwide|across the united states|external students)\b/.test(text)
    || /\bundergraduate students\b/.test(text)
    || /\bcollege students\b/.test(text)
    || /\bstudents enrolled at accredited\b/.test(text);
}

function hasInternalOnlyLanguage(opportunity: Opportunity) {
  const text = eligibilityText(opportunity);
  return /\b(current|matriculated|degree seeking|degree-seeking|enrolled)\b.{0,80}\b(students?)\b.{0,50}\b(at|of|from|in)\b/.test(text)
    || /\b(open only to|limited to|restricted to)\b.{0,100}\b(students?)\b/.test(text);
}

function hasCitizenshipRestriction(opportunity: Opportunity) {
  const text = eligibilityText(opportunity);
  return /\b(u s citizens?|us citizens?|united states citizens?|permanent residents?|green card|work authorization|authorized to work|citizenship|residency requirement|eligible to work in the united states)\b/.test(text);
}

function hasUnprovenCitizenshipLanguage(opportunity: Opportunity) {
  const text = normalize(rawEligibilityText(opportunity));
  return /\b(citizenship|work authorization|international eligibility|residency)\b.{0,80}\b(varies|check|confirm|site specific|project specific|not documented|unknown)\b/.test(text)
    || /\b(varies|check|confirm|site specific|project specific|not documented|unknown)\b.{0,80}\b(citizenship|work authorization|international eligibility|residency)\b/.test(text);
}

function institutionTypeEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  const text = eligibilityText(opportunity);
  if (/\b(high school|middle school|k 12|secondary school)\b/.test(text) && !/\bcollege\b/.test(text)) return { key: "institution_type", proven: false, reason: "Opportunity appears limited to non-college students." };
  if (!context.institutionType || context.institutionType === "unknown") return { key: "institution_type", proven: false, reason: "Student institution type is not proven." };
  return { key: "institution_type", proven: ["college", "university", "community_college", "liberal_arts_college"].includes(context.institutionType), reason: "Student institution type is college-level." };
}

function enrollmentEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  const text = eligibilityText(opportunity);
  const requiresEnrollment = /\b(enrolled|current student|students enrolled|matriculated|degree seeking|degree-seeking|college students?|undergraduate students?)\b/.test(text);
  if (!requiresEnrollment) return { key: "enrollment_status", proven: true, reason: "No separate enrollment restriction is listed." };
  if (context.enrollmentStatus === "enrolled" || context.enrollmentStatus === "incoming") return { key: "enrollment_status", proven: true, reason: "Student enrollment status satisfies the listed requirement." };
  return { key: "enrollment_status", proven: false, reason: "Student enrollment status is not proven for this requirement." };
}

function schoolRestrictionEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  if (isSchoolEligible(opportunity, context)) return { key: "school_restrictions", proven: true, reason: "School restriction is satisfied." };
  return { key: "school_restrictions", proven: false, reason: "Student is not eligible for this opportunity's school restriction." };
}

function hostInstitutionEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  if (opportunity.school_scope === "School Specific") return schoolRestrictionEligible(opportunity, context);
  if (!isSchoolLikeHost(opportunity)) return { key: "host_institution", proven: true, reason: "No host-institution restriction is apparent." };
  if (hasInternalOnlyLanguage(opportunity) && !opportunity.schools.includes(context.schoolSlug ?? "")) return { key: "host_institution", proven: false, reason: "Host-institution eligibility is not proven for external students." };
  if (hasExternalStudentProof(opportunity)) return { key: "host_institution", proven: true, reason: "External student eligibility is stated broadly." };
  return { key: "host_institution", proven: false, reason: "External-student eligibility is not positively proven for this host institution." };
}

function hasKnownDeadlineProblem(opportunity: Opportunity) {
  const deadlineDays = getDeadlineDays(opportunity);
  return deadlineDays !== null && deadlineDays < 0;
}

function classYearEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  if (!context.academicYear) return { key: "class_year", proven: false, reason: "Student class year is not proven." };
  if (opportunity.academic_years.includes("Any Year")) return { key: "class_year", proven: true, reason: "Opportunity accepts any class year." };
  if (opportunity.academic_years.includes(context.academicYear)) return { key: "class_year", proven: true, reason: "Student class year is listed as eligible." };
  return { key: "class_year", proven: false, reason: "Student class year is not listed as eligible." };
}

function degreeLevelEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  const text = eligibilityText(opportunity);
  if (!context.degreeLevel || context.degreeLevel === "unknown") return { key: "degree_level", proven: false, reason: "Student degree level is not proven." };
  if (context.degreeLevel === "undergraduate") {
    if (/\b(graduate students only|masters students only|master s students only|phd students only|doctoral students only)\b/.test(text)) return { key: "degree_level", proven: false, reason: "Opportunity appears limited to graduate students." };
    if (opportunity.academic_years.some((year) => ["First year", "Second year", "Third year", "Fourth year", "Any Year"].includes(year)) || /\b(undergraduate|college student|bachelor|freshman|sophomore|junior|senior)\b/.test(text)) return { key: "degree_level", proven: true, reason: "Undergraduate eligibility is listed." };
  }
  if (context.degreeLevel === "graduate") {
    if (opportunity.academic_years.includes("Graduate student") || /\b(graduate|masters?|phd|doctoral)\b/.test(text)) return { key: "degree_level", proven: true, reason: "Graduate eligibility is listed." };
    return { key: "degree_level", proven: false, reason: "Graduate eligibility is not listed." };
  }
  return { key: "degree_level", proven: false, reason: "Student degree level does not match listed eligibility." };
}

function citizenshipEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  if (hasUnprovenCitizenshipLanguage(opportunity)) return { key: "citizenship", proven: false, reason: "Citizenship or work-authorization requirement is not proven." };
  if (!hasCitizenshipRestriction(opportunity)) return { key: "citizenship", proven: true, reason: "No citizenship or work-authorization restriction is listed." };
  const citizenship = context.citizenshipStatus;
  const authorized = context.workAuthorization;
  if (citizenship === "us_citizen" || citizenship === "permanent_resident" || authorized === "us_authorized") return { key: "citizenship", proven: true, reason: "Student citizenship/work-authorization status satisfies the listed requirement." };
  return { key: "citizenship", proven: false, reason: "Citizenship or work-authorization eligibility is not positively proven." };
}

function gpaEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  const requirement = gpaRequirement(opportunity);
  if (requirement === null) return { key: "gpa", proven: true, reason: "No GPA requirement is listed." };
  if (context.gpaStatus !== "reported" || typeof context.gpa !== "number") return { key: "gpa", proven: false, reason: "Listed GPA requirement cannot be proven from the profile." };
  if (context.gpa >= requirement) return { key: "gpa", proven: true, reason: "Student GPA meets the listed requirement." };
  return { key: "gpa", proven: false, reason: "Student GPA is below the listed requirement." };
}

function majorEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  if (opportunity.majors.includes("Any Major")) return { key: "major_requirements", proven: true, reason: "Opportunity accepts any major." };
  if (!context.major) return { key: "major_requirements", proven: false, reason: "Student major is not proven." };
  if (getMatchingMajors(opportunity, context).length || getMatchingMinor(opportunity, context).length) return { key: "major_requirements", proven: true, reason: "Student major or minor matches listed requirements." };
  return { key: "major_requirements", proven: false, reason: "Student major is not listed as eligible." };
}

function externalStudentEligible(opportunity: Opportunity, context: OpportunityStudentContext): EligibilityProof {
  if (opportunity.school_scope === "School Specific") return schoolRestrictionEligible(opportunity, context);
  if (!isSchoolLikeHost(opportunity)) return { key: "external_student_eligibility", proven: true, reason: "No external-student restriction is apparent." };
  if (context.externalStudentEligible === true || hasExternalStudentProof(opportunity)) return { key: "external_student_eligibility", proven: true, reason: "External-student eligibility is positively stated." };
  return { key: "external_student_eligibility", proven: false, reason: "External-student eligibility is not positively proven." };
}

function hasUsableSource(opportunity: Opportunity) {
  return opportunity.official_source_url.startsWith("https://") && Boolean(opportunity.organization.trim()) && Boolean(opportunity.eligibility.trim());
}

export function validateOpportunityData(opportunity: Opportunity): CandidateGateResult {
  const reasons: string[] = [];
  if (!hasUsableSource(opportunity)) reasons.push("Missing usable source, organization, or eligibility.");
  if (recommendationConfig.verificationQuality.excludedStatuses.includes(opportunity.verification_status as never)) reasons.push(`Verification status is ${opportunity.verification_status}.`);
  if (hasKnownDeadlineProblem(opportunity)) reasons.push("Deadline has passed.");
  if (opportunity.verification_status === "needs_review") reasons.push("Details need manual review before premium promotion.");
  if (opportunity.verification_status === "temporarily_closed") reasons.push("Opportunity is temporarily closed.");
  if (opportunity.verification_status !== "verified") reasons.push("Eligibility has not been positively verified for Pro recommendations.");
  if (opportunity.metadata.verification?.eligibilityVerified === false) reasons.push("Eligibility verification is explicitly incomplete.");
  if (hasUnknownEligibilityLanguage(opportunity)) reasons.push("Eligibility contains unknown or variable requirements.");
  if (rawEligibilityText(opportunity).trim().length < 24) reasons.push("Eligibility detail is too thin to prove fit.");
  return {
    allowed: reasons.length === 0,
    stage: "data_validation",
    reasons,
    confidenceImpact: reasons.length ? "medium" : "none",
  };
}

export function evaluateEligibility(opportunity: Opportunity, context: OpportunityStudentContext): CandidateGateResult {
  const reasons: string[] = [];
  const checks = [
    institutionTypeEligible(opportunity, context),
    enrollmentEligible(opportunity, context),
    schoolRestrictionEligible(opportunity, context),
    hostInstitutionEligible(opportunity, context),
    classYearEligible(opportunity, context),
    degreeLevelEligible(opportunity, context),
    citizenshipEligible(opportunity, context),
    gpaEligible(opportunity, context),
    majorEligible(opportunity, context),
    externalStudentEligible(opportunity, context),
  ];
  reasons.push(...checks.filter((check) => !check.proven).map((check) => check.reason));
  if (context.completedOpportunityIds?.includes(opportunity.id)) reasons.push("Student already completed this opportunity.");
  if (context.rejectedOpportunityIds?.includes(opportunity.id)) reasons.push("Student rejected this opportunity.");
  if (context.activeOpportunityIds?.includes(opportunity.id)) reasons.push("Opportunity is already active in Journey.");
  if (context.dismissedOpportunityIds?.includes(opportunity.id) || context.hiddenOpportunityIds?.includes(opportunity.id)) reasons.push("Student dismissed or hid this opportunity.");
  return {
    allowed: reasons.length === 0,
    stage: "eligibility_engine",
    reasons,
    confidenceImpact: reasons.length ? "high" : "none",
  };
}

export function evaluateProfessionalRecommendationCandidate(opportunity: Opportunity, context: OpportunityStudentContext): CandidateGateResult {
  const validation = validateOpportunityData(opportunity);
  if (!validation.allowed) return validation;
  const eligibility = evaluateEligibility(opportunity, context);
  if (!eligibility.allowed) return eligibility;
  return { allowed: true, stage: "eligibility_engine", reasons: [], confidenceImpact: "none" };
}

export function auditFinalOpportunityRecommendation(recommendation: RecommendationV1, opportunity: Opportunity, context: OpportunityStudentContext): RecommendationAuditResult {
  const rejections: string[] = [];
  const warnings: string[] = [];
  const validation = validateOpportunityData(opportunity);
  const eligibility = evaluateEligibility(opportunity, context);
  if (!validation.allowed) rejections.push(...validation.reasons);
  if (!eligibility.allowed) rejections.push(...eligibility.reasons);
  if (recommendation.confidenceLevel === "Low" || recommendation.confidence < recommendationConfig.confidence.mediumThreshold) rejections.push("Recommendation confidence is too low for Pro.");
  if (!recommendation.reasons.length || recommendation.reasons.some((reason) => /matches your school|available through your university|campus-specific/i.test(reason) && !isSchoolEligible(opportunity, context))) rejections.push("Explanation contains unsupported school relevance.");
  if (opportunity.verification_status === "needs_review") warnings.push("Verified details need review before acting.");
  if (opportunity.metadata.deadlineType === "unknown" || opportunity.metadata.verification?.deadlineVerified === false) warnings.push("Deadline confidence is limited.");
  return { approved: rejections.length === 0, rejections, warnings };
}

export function careerAdvisorFit(profile: AdvisorProfile, opportunity: Opportunity) {
  const roadmapCategories = new Set(profile.future.opportunityCategoriesUsed ?? []);
  const pathwayCategories = new Set(profile.pathway.bestOpportunityCategories);
  const preferredTypes = new Set(profile.goals.preferredOpportunityTypes);
  const categoryFit = pathwayCategories.has(opportunity.category) || pathwayCategories.has(opportunity.type) || preferredTypes.has(opportunity.category) || preferredTypes.has(opportunity.type);
  const addsCoverage = !roadmapCategories.has(opportunity.category) && !roadmapCategories.has(opportunity.type);
  return {
    stage: "career_advisor" as const,
    shouldDoNext: categoryFit || addsCoverage,
    reasons: [
      categoryFit ? "Fits the student's pathway or stated opportunity preferences." : "",
      addsCoverage ? "Adds useful variety to the student's opportunity mix." : "",
    ].filter(Boolean),
  };
}

export function buildRecommendationHealthMonitor(finalRecommendations: RecommendationV1[], reviewedOpportunities: Opportunity[], context: OpportunityStudentContext): RecommendationHealthMonitor {
  const rejected = reviewedOpportunities.filter((opportunity) => !evaluateProfessionalRecommendationCandidate(opportunity, context).allowed);
  const organizationCounts = finalRecommendations.reduce((counts, recommendation) => {
    const opportunity = reviewedOpportunities.find((item) => item.id === recommendation.relatedOpportunityId);
    if (opportunity) counts.set(opportunity.organization, (counts.get(opportunity.organization) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const finalOpportunities = finalRecommendations.map((recommendation) => reviewedOpportunities.find((item) => item.id === recommendation.relatedOpportunityId)).filter((item): item is Opportunity => Boolean(item));
  return {
    totalReviewed: reviewedOpportunities.length,
    rejected: rejected.length,
    wrongSchool: reviewedOpportunities.filter((opportunity) => !isSchoolEligible(opportunity, context)).length,
    wrongYear: reviewedOpportunities.filter((opportunity) => !classYearEligible(opportunity, context).proven).length,
    wrongGpa: reviewedOpportunities.filter((opportunity) => !gpaEligible(opportunity, context).proven).length,
    expiredOrArchived: reviewedOpportunities.filter((opportunity) => recommendationConfig.verificationQuality.excludedStatuses.includes(opportunity.verification_status as never) || hasKnownDeadlineProblem(opportunity)).length,
    duplicateOrganizations: [...organizationCounts.values()].filter((count) => count > 1).length,
    lowConfidence: finalRecommendations.filter((recommendation) => recommendation.confidenceLevel === "Low").length,
    coverage: {
      categories: new Set(finalOpportunities.map((opportunity) => opportunity.category)).size,
      types: new Set(finalOpportunities.map((opportunity) => opportunity.type)).size,
      organizations: new Set(finalOpportunities.map((opportunity) => opportunity.organization)).size,
    },
  };
}
