import type { ResumeExperienceRecord } from "@/data/resume-lab";

export function unsupportedActivityClaims(description: string, experience: ResumeExperienceRecord) {
  const evidence = experience.facts.filter((fact) => fact.confirmed).map((fact) => fact.text).join(" ").toLowerCase().replaceAll(",", "");
  const claims = description.match(/(?:\$\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?%|\b\d[\d,]*(?:\.\d+)?\b)/g) ?? [];
  return [...new Set(claims)].filter((claim) => !evidence.includes(claim.toLowerCase().replaceAll(",", "")));
}

export function highSchoolExperienceSummary(record: ResumeExperienceRecord) {
  const confirmed = record.facts.filter((fact) => fact.confirmed);
  return { confirmedFacts: confirmed.length, unconfirmedFacts: record.facts.length - confirmed.length, grades: record.highSchool?.grades ?? [], roleProgression: record.highSchool?.roleHistory ?? [] };
}
