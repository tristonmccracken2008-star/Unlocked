import { collegeCdsRecords, type CdsAdmissionFactor, type CdsImportance, type CollegeCdsSnapshot } from "@/data/college-cds";

export const cdsImportanceLabels: Record<CdsImportance, string> = {
  very_important: "Very Important",
  important: "Important",
  considered: "Considered",
  not_considered: "Not Considered",
};

export const cdsFactorLabels: Record<CdsAdmissionFactor, string> = {
  rigor: "Rigor of secondary school record", class_rank: "Class rank", academic_gpa: "Academic GPA",
  standardized_tests: "Standardized test scores", essay: "Application essay", recommendations: "Recommendations",
  interview: "Interview", extracurriculars: "Extracurricular activities", talent_ability: "Talent or ability",
  character_personal_qualities: "Character and personal qualities", first_generation: "First generation", alumni_relation: "Alumni relation",
  geographic_residence: "Geographic residence", state_residency: "State residency", religious_affiliation: "Religious affiliation or commitment",
  volunteer_work: "Volunteer work", work_experience: "Work experience", level_of_interest: "Level of applicant interest",
};

export function latestCollegeCds(collegeId: string): CollegeCdsSnapshot | undefined {
  return collegeCdsRecords[collegeId]?.snapshots[0];
}

export function derivedRate(numerator?: number, denominator?: number): number | undefined {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || !numerator || !denominator || numerator < 0 || denominator <= 0 || numerator > denominator) return undefined;
  return numerator / denominator;
}

export function groupedCdsFactors(snapshot: CollegeCdsSnapshot): Array<{ importance: CdsImportance; factors: string[] }> {
  return (["very_important", "important", "considered", "not_considered"] as const).map((importance) => ({
    importance,
    factors: Object.entries(snapshot.factors ?? {}).filter(([, value]) => value === importance).map(([factor]) => cdsFactorLabels[factor as CdsAdmissionFactor]),
  })).filter((group) => group.factors.length > 0);
}
