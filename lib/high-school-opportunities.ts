import type { Opportunity } from "@/data/opportunities";
import type { StudentProfile } from "@/data/student-profile";

export type HighSchoolEligibility = {
  state: "eligible" | "likely" | "needs_information" | "not_eligible";
  label: string;
  summary: string;
  checks: Array<{ label: string; state: "met" | "unknown" | "not_met"; detail: string }>;
};

export function isHighSchoolOpportunity(
  opportunity: Opportunity,
): opportunity is Opportunity & { metadata: Opportunity["metadata"] & { highSchool: NonNullable<Opportunity["metadata"]["highSchool"]> } } {
  return (
    opportunity.metadata.eligibilityRules?.educationLevels?.includes(
      "high_school",
    ) === true && Boolean(opportunity.metadata.highSchool)
  );
}

export function highSchoolCatalog(
  source: readonly Opportunity[],
) {
  return source.filter(isHighSchoolOpportunity);
}

function gradeFromProfile(profile: StudentProfile | null | undefined) {
  const value = profile?.year?.toLowerCase() ?? "";
  if (/\b(9|ninth|freshman)\b/.test(value)) return 9;
  if (/\b(10|tenth|sophomore)\b/.test(value)) return 10;
  if (/\b(11|eleventh|junior)\b/.test(value)) return 11;
  if (/\b(12|twelfth|senior)\b/.test(value)) return 12;
  return null;
}

export function evaluateHighSchoolEligibility(
  opportunity: Opportunity,
  profile: StudentProfile | null | undefined,
): HighSchoolEligibility {
  const rules = opportunity.metadata.eligibilityRules;
  const checks: HighSchoolEligibility["checks"] = [];
  const grade = gradeFromProfile(profile);

  if (rules?.highSchoolGrades?.length) {
    checks.push(
      grade === null
        ? { label: "Grade", state: "unknown", detail: `Open to grades ${rules.highSchoolGrades.join(", ")}. Add your grade to check.` }
        : rules.highSchoolGrades.includes(grade)
          ? { label: "Grade", state: "met", detail: `Your recorded grade (${grade}) is included.` }
          : { label: "Grade", state: "not_met", detail: `The official rules list grades ${rules.highSchoolGrades.join(", ")}; your recorded grade is ${grade}.` },
    );
  }
  if (rules?.expectedGraduationYears?.length) {
    const year = Number(profile?.graduationYear);
    checks.push(
      !Number.isInteger(year)
        ? { label: "Graduation year", state: "unknown", detail: `Graduation year ${rules.expectedGraduationYears.join(" or ")} is required.` }
        : rules.expectedGraduationYears.includes(year)
          ? { label: "Graduation year", state: "met", detail: `Your recorded graduation year is ${year}.` }
          : { label: "Graduation year", state: "not_met", detail: `This cycle requires graduation in ${rules.expectedGraduationYears.join(" or ")}.` },
    );
  }
  if (typeof rules?.minimumGpa === "number") {
    checks.push(
      typeof profile?.gpa !== "number"
        ? { label: "GPA", state: "unknown", detail: `A GPA of at least ${rules.minimumGpa.toFixed(1)} is required. Add yours to check.` }
        : profile.gpa >= rules.minimumGpa
          ? { label: "GPA", state: "met", detail: `Your recorded GPA meets the ${rules.minimumGpa.toFixed(1)} minimum.` }
          : { label: "GPA", state: "not_met", detail: `Your recorded GPA is below the ${rules.minimumGpa.toFixed(1)} minimum.` },
    );
  }
  if (rules?.citizenship === "us_citizen") {
    checks.push(
      !profile?.citizenshipStatus || profile.citizenshipStatus === "unknown"
        ? { label: "Citizenship", state: "unknown", detail: "U.S. citizenship is required. Add your status to check." }
        : profile.citizenshipStatus === "us_citizen"
          ? { label: "Citizenship", state: "met", detail: "Your recorded status meets the U.S. citizenship requirement." }
          : { label: "Citizenship", state: "not_met", detail: "The official rules require U.S. citizenship." },
    );
  }
  if (rules?.residency?.length) {
    const residency = profile?.residency?.trim();
    const match = residency && rules.residency.some((item) => residency.toLowerCase().includes(item.toLowerCase()));
    checks.push(
      !residency
        ? { label: "Residency", state: "unknown", detail: `${rules.residency.join(" or ")} residency is required. Add yours to check.` }
        : match
          ? { label: "Residency", state: "met", detail: `Your recorded residency (${residency}) matches.` }
          : { label: "Residency", state: "not_met", detail: `The official rules require ${rules.residency.join(" or ")} residency.` },
    );
  }
  if (rules?.ageRange) {
    const age = profile?.age;
    const { minimum, maximum } = rules.ageRange;
    const meets = typeof age === "number" && (minimum === undefined || age >= minimum) && (maximum === undefined || age <= maximum);
    checks.push(
      typeof age !== "number"
        ? { label: "Age", state: "unknown", detail: `The official age range is ${minimum ?? "any"}–${maximum ?? "any"}. Add your age to check.` }
        : meets
          ? { label: "Age", state: "met", detail: `Your recorded age (${age}) is in the official range.` }
          : { label: "Age", state: "not_met", detail: `The official age range is ${minimum ?? "any"}–${maximum ?? "any"}.` },
    );
  }
  if (rules?.participatingDistrictRequired) {
    checks.push({ label: "Congressional district", state: "unknown", detail: "Your district must participate. Confirm it on the official site before applying." });
  }
  for (const requirement of rules?.demographicRequirements ?? []) {
    checks.push({ label: "Program audience", state: "unknown", detail: `This program is for ${requirement.toLowerCase()}. Confirm this requirement for yourself.` });
  }

  if (checks.some((check) => check.state === "not_met"))
    return { state: "not_eligible", label: "Not eligible based on your profile", summary: "At least one recorded profile fact conflicts with the official rules.", checks };
  if (checks.some((check) => check.state === "unknown"))
    return { state: "needs_information", label: "More information needed", summary: "You may be eligible, but UnlockED needs one or more facts before it can say so.", checks };
  if (opportunity.metadata.eligibilityRules?.availability === "unknown")
    return { state: "likely", label: "Likely eligible", summary: "Your recorded facts match, but the current application window still needs confirmation.", checks };
  return { state: "eligible", label: "Eligible based on your profile", summary: "Your recorded facts match every explicit requirement UnlockED can verify.", checks };
}
