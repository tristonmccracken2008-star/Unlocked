import { getDeadlineDays, getMatchingMajors, getMatchingMinor, gpaRequirement, isSchoolEligible, type OpportunityStudentContext } from "./opportunity-intelligence";
import type { Opportunity, OpportunityEligibilityRules } from "./opportunities";

export type EligibilityCheckKey =
  | "institution_type"
  | "enrollment_status"
  | "school_restrictions"
  | "host_institution"
  | "class_year"
  | "degree_level"
  | "citizenship"
  | "work_authorization"
  | "gpa"
  | "major_requirements"
  | "external_student_eligibility"
  | "age"
  | "residency"
  | "transfer_status"
  | "invitation_status"
  | "financial_need"
  | "merit_status"
  | "demographic_eligibility"
  | "application_cycle"
  | "availability";

export type EligibilityProof = {
  key: EligibilityCheckKey;
  applicable: boolean;
  proven: boolean;
  reason: string;
  evidence: string;
};

export type OpportunityEligibilityEvaluation = {
  eligible: boolean;
  confidence: number;
  checks: EligibilityProof[];
  failures: string[];
};

const normalize = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();

export function rawEligibilityText(opportunity: Opportunity) {
  return [
    opportunity.eligibility,
    opportunity.metadata.citizenship ?? "",
    opportunity.metadata.internationalEligibility ?? "",
    ...(opportunity.metadata.eligibilityNotes ?? []),
    ...(opportunity.metadata.applicationRequirements ?? []),
  ].join(" ");
}

function eligibilityText(opportunity: Opportunity) {
  return normalize(rawEligibilityText(opportunity));
}

export function hasUnknownEligibilityLanguage(opportunity: Opportunity) {
  const text = eligibilityText(opportunity);
  return [
    "eligibility varies",
    "requirements vary",
    "eligibility depends",
    "check official source",
    "confirm current eligibility",
    "site specific",
    "project specific requirements",
    "program specific requirements",
    "institution specific",
    "award specific eligibility varies",
    "not documented",
    "unknown",
  ].some((phrase) => text.includes(phrase));
}

function proof(key: EligibilityCheckKey, applicable: boolean, proven: boolean, reason: string, evidence: string): EligibilityProof {
  return { key, applicable, proven, reason, evidence };
}

function rules(opportunity: Opportunity): OpportunityEligibilityRules {
  return opportunity.metadata.eligibilityRules ?? {};
}

function isSchoolLikeHost(opportunity: Opportunity) {
  const text = normalize(`${opportunity.organization} ${opportunity.title}`);
  return /\b(university|college|institute of technology|school of|state university|community college)\b/.test(text);
}

function hasExternalStudentProof(opportunity: Opportunity) {
  const text = eligibilityText(opportunity);
  const configured = rules(opportunity).externalStudents;
  if (configured === "eligible") return true;
  if (configured === "ineligible" || configured === "unknown") return false;
  return /\b(open to|available to|eligible for|welcomes?)\b.{0,120}\b(students from|undergraduates from|students at any|any accredited|all accredited|other institutions|other colleges|any college|any university|colleges and universities|nationwide|across the united states|external students)\b/.test(text)
    || /\b(all|any) (undergraduate|college|university) students\b/.test(text)
    || /\bstudents enrolled at (an|any) accredited\b/.test(text);
}

function hasInternalOnlyLanguage(opportunity: Opportunity) {
  const text = eligibilityText(opportunity);
  if (rules(opportunity).externalStudents === "ineligible") return true;
  return /\b(current|matriculated|degree seeking|degree-seeking|enrolled)\b.{0,80}\bstudents?\b.{0,50}\b(at|of|from|in)\b/.test(text)
    || /\b(open only to|limited to|restricted to)\b.{0,100}\bstudents?\b/.test(text);
}

function institutionTypeCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const text = eligibilityText(opportunity);
  const configured = rules(opportunity).institutionTypes;
  const highSchoolOnly = /\b(high school|middle school|k 12|secondary school) students?\b/.test(text) && !/\b(college|university|undergraduate) students?\b/.test(text);
  const communityOnly = configured?.length === 1 && configured[0] === "community_college" || /\b(current )?community college students?\b/.test(text) || /\btwo year college students?\b/.test(text);
  const fourYearOnly = /\b(four|4)[ -]year (college|university|institution)\b/.test(text) || /\bbachelor s degree program\b/.test(text);
  const liberalArtsOnly = configured?.length === 1 && configured[0] === "liberal_arts_college";
  const applicable = Boolean(configured?.length || highSchoolOnly || communityOnly || fourYearOnly || liberalArtsOnly);
  if (highSchoolOnly) return proof("institution_type", true, false, "Opportunity is limited to non-college students.", "Eligibility text limits participation to secondary-school students.");
  if (!applicable) return proof("institution_type", false, true, "No institution-type restriction is listed.", "No institution-type restriction found in verified eligibility fields.");
  if (!context.institutionType || context.institutionType === "unknown") return proof("institution_type", true, false, "Student institution type is not known.", "The opportunity has an institution-type requirement.");
  if (configured?.length) return proof("institution_type", true, configured.includes(context.institutionType), configured.includes(context.institutionType) ? "Student institution type is explicitly eligible." : "Student institution type is not listed as eligible.", `Eligible institution types: ${configured.join(", ")}.`);
  if (communityOnly) return proof("institution_type", true, context.institutionType === "community_college", context.institutionType === "community_college" ? "Community-college requirement is satisfied." : "Opportunity is limited to community-college students.", "Eligibility text states a community-college restriction.");
  if (fourYearOnly) return proof("institution_type", true, ["college", "university", "liberal_arts_college"].includes(context.institutionType), "Student must attend a four-year institution.", "Eligibility text states a four-year institution requirement.");
  return proof("institution_type", true, context.institutionType === "liberal_arts_college", "Student must attend a liberal-arts college.", "Structured eligibility limits institution type.");
}

function enrollmentCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const text = eligibilityText(opportunity);
  const configured = rules(opportunity).enrollmentStatuses;
  const requiresCurrentEnrollment = /\b(current student|currently enrolled|actively enrolled|matriculated|degree seeking|degree-seeking)\b/.test(text);
  const allowsIncoming = /\b(incoming|prospective|admitted) students?\b/.test(text);
  const allowsRecentGraduate = /\brecent graduates?\b/.test(text);
  const applicable = Boolean(configured?.length || requiresCurrentEnrollment || allowsIncoming || allowsRecentGraduate);
  if (!applicable) return proof("enrollment_status", false, true, "No separate enrollment restriction is listed.", "No enrollment-status restriction found.");
  if (!context.enrollmentStatus || context.enrollmentStatus === "unknown") return proof("enrollment_status", true, false, "Student enrollment status is not known.", "The opportunity has an enrollment requirement.");
  const allowed = configured?.length
    ? configured
    : [requiresCurrentEnrollment ? "enrolled" : "", allowsIncoming ? "incoming" : "", allowsRecentGraduate ? "recent_graduate" : ""].filter(Boolean);
  const proven = allowed.includes(context.enrollmentStatus);
  return proof("enrollment_status", true, proven, proven ? "Student enrollment status satisfies the requirement." : "Student enrollment status does not satisfy the requirement.", `Eligible enrollment statuses: ${allowed.join(", ")}.`);
}

function schoolRestrictionCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const proven = isSchoolEligible(opportunity, context);
  return proof("school_restrictions", opportunity.school_scope === "School Specific", proven, proven ? "School restriction is satisfied." : "Student is not eligible for this opportunity's school restriction.", opportunity.school_scope === "School Specific" ? `Eligible schools: ${opportunity.schools.join(", ")}.` : "Opportunity is recorded as national.");
}

function hostInstitutionCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  if (opportunity.school_scope === "School Specific") return proof("host_institution", true, isSchoolEligible(opportunity, context), isSchoolEligible(opportunity, context) ? "Student attends the host institution." : "Student does not attend the host institution.", `Host-school list: ${opportunity.schools.join(", ")}.`);
  if (!isSchoolLikeHost(opportunity)) return proof("host_institution", false, true, "No host-institution restriction is apparent.", "Provider is not identified as a college or university host.");
  if (hasInternalOnlyLanguage(opportunity)) return proof("host_institution", true, false, "Host-institution eligibility is not proven for external students.", "Eligibility language appears limited to the host institution.");
  const proven = hasExternalStudentProof(opportunity);
  return proof("host_institution", true, proven, proven ? "External student eligibility is explicitly stated." : "External-student eligibility is not positively proven for this host institution.", proven ? "Verified eligibility states broad or external student access." : "No external-student statement was found.");
}

function classYearCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  if (!context.academicYear) return proof("class_year", true, false, "Student class year is not known.", "Class year is required for recommendation eligibility.");
  const proven = opportunity.academic_years.includes("Any Year") || opportunity.academic_years.includes(context.academicYear);
  return proof("class_year", true, proven, proven ? "Student class year is listed as eligible." : "Student class year is not listed as eligible.", `Eligible class years: ${opportunity.academic_years.join(", ")}.`);
}

function degreeLevelCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const text = eligibilityText(opportunity);
  const configured = rules(opportunity).degreeLevels;
  if (!context.degreeLevel || context.degreeLevel === "unknown") return proof("degree_level", true, false, "Student degree level is not known.", "Degree level is required for recommendation eligibility.");
  if (configured?.length) {
    const proven = configured.includes(context.degreeLevel);
    return proof("degree_level", true, proven, proven ? "Student degree level is explicitly eligible." : "Student degree level is not listed as eligible.", `Eligible degree levels: ${configured.join(", ")}.`);
  }
  const graduateOnly = /\b(graduate|masters?|master s|phd|doctoral) students? only\b/.test(text);
  const undergraduateOnly = /\b(undergraduate|bachelor s|baccalaureate) students?\b/.test(text) && !/\bgraduate students?\b/.test(text);
  if (graduateOnly) return proof("degree_level", true, context.degreeLevel === "graduate", "Opportunity is limited to graduate students.", "Eligibility text states a graduate-only requirement.");
  if (undergraduateOnly) return proof("degree_level", true, context.degreeLevel === "undergraduate" || context.degreeLevel === "associate", "Opportunity is limited to undergraduate students.", "Eligibility text states an undergraduate requirement.");
  const listed = context.degreeLevel === "graduate"
    ? opportunity.academic_years.includes("Graduate student") || (/\b(graduate|masters?|phd|doctoral) students?\b/.test(text) && !graduateOnly)
    : opportunity.academic_years.includes("Any Year") || opportunity.academic_years.some((year) => ["First year", "Second year", "Third year", "Fourth year"].includes(year));
  return proof("degree_level", true, listed, listed ? "Student degree level is supported by the listed class years." : "Student degree level is not positively listed.", `Class-year metadata: ${opportunity.academic_years.join(", ")}.`);
}

function citizenshipCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const text = eligibilityText(opportunity);
  const configured = rules(opportunity).citizenship;
  const usCitizenOnly = configured === "us_citizen" || /\b(u s|us|united states) citizens? only\b/.test(text) || /\bmust be (a )?(u s|us|united states) citizen\b/.test(text);
  const usPerson = configured === "us_person" || /\b(u s|us|united states) citizens? (or|and) (u s )?permanent residents?\b/.test(text);
  const workAuthorized = configured === "us_work_authorized" || /\b(authorized|eligible) to work in the (u s|us|united states)\b/.test(text);
  const internationalAllowed = configured === "international_allowed" || /\binternational students? (are )?(eligible|welcome|may apply)\b/.test(text);
  const genericRestriction = /\b(citizenship|citizen|permanent resident|green card|work authorization|international eligibility)\b/.test(text);
  if (configured === "unrestricted" || internationalAllowed) return proof("citizenship", true, true, "Citizenship eligibility is explicitly broad.", configured === "unrestricted" ? "Structured rules mark citizenship unrestricted." : "Eligibility text explicitly allows international students.");
  if (!genericRestriction && !configured) return proof("citizenship", false, true, "No citizenship restriction is listed.", "No citizenship or work-authorization restriction found in verified eligibility fields.");
  if (usCitizenOnly) return proof("citizenship", true, context.citizenshipStatus === "us_citizen", context.citizenshipStatus === "us_citizen" ? "U.S.-citizen requirement is satisfied." : "U.S.-citizen eligibility is not proven.", "Eligibility requires U.S. citizenship.");
  if (usPerson) {
    const proven = context.citizenshipStatus === "us_citizen" || context.citizenshipStatus === "permanent_resident";
    return proof("citizenship", true, proven, proven ? "U.S.-person requirement is satisfied." : "U.S. citizenship or permanent residency is not proven.", "Eligibility allows U.S. citizens or permanent residents.");
  }
  if (workAuthorized) {
    const proven = context.workAuthorization === "us_authorized";
    return proof("work_authorization", true, proven, proven ? "Work-authorization requirement is satisfied." : "Required U.S. work authorization is not proven.", "Eligibility requires U.S. work authorization.");
  }
  return proof("citizenship", true, false, "Citizenship or work-authorization eligibility is not positively proven.", "Eligibility mentions a citizenship restriction without a deterministic rule.");
}

function gpaCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const requirement = gpaRequirement(opportunity);
  if (requirement === null) return proof("gpa", false, true, "No GPA requirement is listed.", "No numeric GPA requirement found.");
  if (context.gpaStatus !== "reported" || typeof context.gpa !== "number") return proof("gpa", true, false, "Listed GPA requirement cannot be proven from the profile.", `Minimum GPA: ${requirement.toFixed(1)}.`);
  const proven = context.gpa >= requirement;
  return proof("gpa", true, proven, proven ? "Student GPA meets the listed requirement." : "Student GPA is below the listed requirement.", `Student GPA ${context.gpa.toFixed(2)}; minimum ${requirement.toFixed(2)}.`);
}

function majorCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  if (opportunity.majors.includes("Any Major")) return proof("major_requirements", false, true, "Opportunity accepts any major.", "Major metadata is Any Major.");
  if (!context.major) return proof("major_requirements", true, false, "Student major is not known.", `Eligible majors: ${opportunity.majors.join(", ")}.`);
  const matches = [...getMatchingMajors(opportunity, context), ...getMatchingMinor(opportunity, context)];
  return proof("major_requirements", true, matches.length > 0, matches.length ? "Student major or minor matches a listed requirement." : "Student major is not listed as eligible.", `Eligible majors: ${opportunity.majors.join(", ")}.`);
}

function externalStudentCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  if (opportunity.school_scope === "School Specific") return proof("external_student_eligibility", true, isSchoolEligible(opportunity, context), isSchoolEligible(opportunity, context) ? "Student is eligible through the listed school." : "Student is outside the listed school eligibility.", `Eligible schools: ${opportunity.schools.join(", ")}.`);
  if (!isSchoolLikeHost(opportunity)) return proof("external_student_eligibility", false, true, "No external-student restriction is apparent.", "Provider is not a college or university host.");
  const proven = hasExternalStudentProof(opportunity) && !hasInternalOnlyLanguage(opportunity);
  return proof("external_student_eligibility", true, proven, proven ? "External-student eligibility is positively stated." : "External-student eligibility is not positively proven.", proven ? "Verified eligibility explicitly includes external or broad college participation." : "No deterministic external-student rule is available.");
}

function ageCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const text = eligibilityText(opportunity);
  const configured = rules(opportunity);
  const minimum = configured.minimumAge ?? Number(text.match(/\b(?:age )?(\d{1,2})(?:\+| or older| years? or older| minimum)\b/)?.[1] ?? NaN);
  const maximum = configured.maximumAge ?? Number(text.match(/\b(?:under|younger than|no older than) (\d{1,2})\b/)?.[1] ?? NaN);
  const hasMinimum = Number.isFinite(minimum);
  const hasMaximum = Number.isFinite(maximum);
  if (!hasMinimum && !hasMaximum) return proof("age", false, true, "No age restriction is listed.", "No numeric age restriction found.");
  if (typeof context.age !== "number") return proof("age", true, false, "Student age is not known for a listed age requirement.", [hasMinimum ? `Minimum age ${minimum}.` : "", hasMaximum ? `Maximum age ${maximum}.` : ""].filter(Boolean).join(" "));
  const proven = (!hasMinimum || context.age >= minimum) && (!hasMaximum || context.age <= maximum);
  return proof("age", true, proven, proven ? "Student age satisfies the requirement." : "Student age does not satisfy the requirement.", `Student age ${context.age}; allowed range ${hasMinimum ? minimum : "none"}-${hasMaximum ? maximum : "none"}.`);
}

function residencyCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const configured = rules(opportunity).residency;
  const text = eligibilityText(opportunity);
  const residencyMatch = text.match(/\b(?:residents?|residency) (?:of|in|required in) ([a-z ]{3,40})(?:\.|,|;| who| and|$)/);
  const required = configured?.length ? configured : residencyMatch?.[1] ? [residencyMatch[1].trim()] : [];
  if (!required.length) return proof("residency", false, true, "No geographic residency restriction is listed.", "No deterministic residency restriction found.");
  if (!context.residency) return proof("residency", true, false, "Student residency is not known.", `Required residency: ${required.join(", ")}.`);
  const studentResidency = normalize(context.residency);
  const proven = required.some((place) => studentResidency.includes(normalize(place)) || normalize(place).includes(studentResidency));
  return proof("residency", true, proven, proven ? "Student residency satisfies the requirement." : "Student residency does not satisfy the requirement.", `Required residency: ${required.join(", ")}.`);
}

function transferCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const required = rules(opportunity).transferOnly === true || /\b(transfer students? only|community college students? (?:planning|seeking|preparing) to transfer|undergraduate transfer scholarship)\b/.test(eligibilityText(opportunity));
  if (!required) return proof("transfer_status", false, true, "Opportunity is not transfer-only.", "No transfer-only requirement found.");
  const proven = context.transferStatus === "community_college_student" || context.transferStatus === "transfer_applicant";
  return proof("transfer_status", true, proven, proven ? "Student transfer status satisfies the requirement." : "Transfer eligibility is not proven.", "Eligibility limits the opportunity to transfer students.");
}

function invitationCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const required = rules(opportunity).invitationOnly === true || /\b(invitation only|invite only|by invitation)\b/.test(eligibilityText(opportunity));
  if (!required) return proof("invitation_status", false, true, "Opportunity is not invitation-only.", "No invitation requirement found.");
  const proven = context.invitedOpportunityIds?.includes(opportunity.id) === true;
  return proof("invitation_status", true, proven, proven ? "Student invitation is recorded." : "Required invitation is not proven.", "Eligibility is invitation-only.");
}

function needAndMeritChecks(opportunity: Opportunity, context: OpportunityStudentContext) {
  const text = eligibilityText(opportunity);
  const needRequired = rules(opportunity).needBased === true || /\b(demonstrated financial need|financial need required|need based applicants? only)\b/.test(text);
  const meritRequired = rules(opportunity).meritBased === true || /\b(academic merit required|merit based applicants? only)\b/.test(text);
  return [
    proof("financial_need", needRequired, !needRequired || context.financialNeedStatus === "demonstrated", needRequired ? context.financialNeedStatus === "demonstrated" ? "Demonstrated financial need is recorded." : "Required financial need is not proven." : "No mandatory financial-need restriction is listed.", needRequired ? "Eligibility requires demonstrated financial need." : "No mandatory need-based rule found."),
    proof("merit_status", meritRequired, !meritRequired || context.meritStatus === "demonstrated", meritRequired ? context.meritStatus === "demonstrated" ? "Required merit status is recorded." : "Required merit eligibility is not proven." : "No mandatory merit restriction is listed.", meritRequired ? "Eligibility requires demonstrated merit." : "No mandatory merit-only rule found."),
  ];
}

function demographicCheck(opportunity: Opportunity, context: OpportunityStudentContext) {
  const configured = rules(opportunity).demographicRequirements ?? [];
  const text = eligibilityText(opportunity);
  const inferred = [
    /\bstudents? of hispanic heritage\b/.test(text) ? "hispanic_heritage" : "",
    /\b(open to|for|eligible) women\b/.test(text) ? "women" : "",
    /\b(open to|for|eligible) (black|african american) students?\b/.test(text) ? "black_or_african_american" : "",
    /\b(open to|for|eligible) (native american|indigenous) students?\b/.test(text) ? "native_or_indigenous" : "",
    /\b(open to|for|eligible) veterans?\b/.test(text) ? "veteran" : "",
    /\b(open to|for|eligible) students? with disabilities\b/.test(text) ? "disability" : "",
  ].filter(Boolean);
  const required = [...new Set([...configured, ...inferred])];
  if (!required.length) return proof("demographic_eligibility", false, true, "No demographic restriction is listed.", "No deterministic demographic requirement found.");
  const attributes = new Set((context.eligibilityAttributes ?? []).map(normalize));
  const proven = required.every((requirement) => attributes.has(normalize(requirement)));
  return proof("demographic_eligibility", true, proven, proven ? "Student has the required eligibility attributes." : "Required demographic eligibility is not proven.", `Required attributes: ${required.join(", ")}.`);
}

function applicationCycleCheck(opportunity: Opportunity) {
  const configured = rules(opportunity);
  const deadlineDays = getDeadlineDays(opportunity);
  if (deadlineDays !== null) return proof("application_cycle", true, deadlineDays >= 0, deadlineDays >= 0 ? "The verified application deadline is still open." : "The application deadline has passed.", `Deadline: ${opportunity.application_deadline}.`);
  if (configured.availability === "closed" || opportunity.metadata.deadlineType === "current_cycle_closed") return proof("application_cycle", true, false, "The current application cycle is closed.", configured.applicationCycle ?? "Deadline metadata marks the current cycle closed.");
  if (configured.availability === "open" || configured.availability === "rolling" || opportunity.metadata.deadlineType === "rolling" || opportunity.metadata.deadlineType === "no_deadline") return proof("application_cycle", true, true, "Current availability is explicitly recorded.", configured.applicationCycle ?? `Deadline type: ${opportunity.metadata.deadlineType}.`);
  const applicationRequired = ["Career", "Research", "Scholarship"].includes(opportunity.type) && !/career resources|student organizations|certifications/i.test(opportunity.category);
  if (applicationRequired) return proof("application_cycle", true, false, "The current application cycle is not positively proven.", `Deadline type: ${opportunity.metadata.deadlineType ?? "missing"}.`);
  return proof("application_cycle", false, true, "No time-bound application cycle applies.", `Opportunity type: ${opportunity.type}.`);
}

function availabilityCheck(opportunity: Opportunity) {
  const excluded = ["temporarily_closed", "expired", "archived", "broken_source", "incomplete"].includes(opportunity.verification_status);
  if (excluded) return proof("availability", true, false, "Opportunity is not currently actionable.", `Verification status: ${opportunity.verification_status}.`);
  const explicit = rules(opportunity).availability;
  if (explicit === "closed" || explicit === "unknown") return proof("availability", true, false, "Current availability is not proven.", `Structured availability: ${explicit}.`);
  return proof("availability", true, opportunity.verification_status === "verified", opportunity.verification_status === "verified" ? "Current availability passed verification status checks." : "Current availability is not verified.", `Verification status: ${opportunity.verification_status}.`);
}

export function evaluateOpportunityEligibility(opportunity: Opportunity, context: OpportunityStudentContext): OpportunityEligibilityEvaluation {
  const checks = [
    institutionTypeCheck(opportunity, context),
    enrollmentCheck(opportunity, context),
    schoolRestrictionCheck(opportunity, context),
    hostInstitutionCheck(opportunity, context),
    classYearCheck(opportunity, context),
    degreeLevelCheck(opportunity, context),
    citizenshipCheck(opportunity, context),
    gpaCheck(opportunity, context),
    majorCheck(opportunity, context),
    externalStudentCheck(opportunity, context),
    ageCheck(opportunity, context),
    residencyCheck(opportunity, context),
    transferCheck(opportunity, context),
    invitationCheck(opportunity, context),
    ...needAndMeritChecks(opportunity, context),
    demographicCheck(opportunity, context),
    applicationCycleCheck(opportunity),
    availabilityCheck(opportunity),
  ];
  const failures = checks.filter((check) => check.applicable && !check.proven).map((check) => check.reason);
  const explicitVerification = opportunity.metadata.verification?.eligibilityVerified === true;
  const confidence = failures.length ? 0 : explicitVerification ? 96 : opportunity.verification_status === "verified" && !hasUnknownEligibilityLanguage(opportunity) ? 84 : 0;
  return { eligible: failures.length === 0, confidence, checks, failures };
}
