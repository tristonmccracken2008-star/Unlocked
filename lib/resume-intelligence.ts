import type { Opportunity } from "@/data/opportunities";
import type {
  ResumeBullet,
  ResumeDocumentRecord,
  ResumeExperienceRecord,
  ResumeFact,
} from "@/data/resume-lab";

export type ResumeAuditIssue = {
  id: string;
  severity: "fix" | "review" | "note";
  title: string;
  detail: string;
  experienceId?: string;
  bulletId?: string;
};
export type ResumeAudit = {
  issues: ResumeAuditIssue[];
  checks: { label: string; status: "ready" | "review" }[];
};

const claimPattern =
  /(?:[$£€]\s?\d[\d,.]*|\b\d+(?:\.\d+)?\s?(?:%|percent|x|hours?|days?|weeks?|months?|years?|people|students|users|members|projects|applications|awards?)(?=\s|[.,;:!?)]|$))/gi;
const vaguePattern =
  /\b(helped|worked on|responsible for|various|multiple tasks|assisted with|participated in)\b/i;

export function extractClaims(text: string) {
  return [
    ...new Set(
      text
        .match(claimPattern)
        ?.map((item) => item.toLowerCase().replace(/\s+/g, " ")) ?? [],
    ),
  ];
}
export function unsupportedClaims(
  bullet: ResumeBullet,
  facts: readonly ResumeFact[],
) {
  const evidence = facts
    .filter((fact) => bullet.factIds.includes(fact.id) && fact.confirmed)
    .map((fact) => fact.text.toLowerCase())
    .join(" ");
  const confirmed = new Set(
    bullet.confirmedClaims.map((item) => item.toLowerCase()),
  );
  return extractClaims(bullet.text).filter(
    (claim) => !evidence.includes(claim) && !confirmed.has(claim),
  );
}

export function draftBulletFromFacts(
  facts: readonly ResumeFact[],
  variation = 0,
) {
  const confirmed = facts.filter((fact) => fact.confirmed && fact.text.trim());
  if (!confirmed.length) return null;
  const action =
    confirmed.find((fact) => fact.kind === "action") ?? confirmed[0];
  const rest = confirmed.filter((fact) => fact.id !== action.id);
  const ordered = variation % 2 ? [...rest].reverse() : rest;
  const text = [
    action.text.replace(/[.;]+$/, ""),
    ...ordered.map((fact) => fact.text.replace(/[.;]+$/, "")),
  ].join("; ");
  return {
    text: `${text.charAt(0).toUpperCase()}${text.slice(1)}.`,
    factIds: confirmed.map((fact) => fact.id),
  };
}

export function auditResume(
  resume: ResumeDocumentRecord,
  experiences: Record<string, ResumeExperienceRecord>,
): ResumeAudit {
  const issues: ResumeAuditIssue[] = [];
  const verbs = new Map<string, number>();
  let bulletCount = 0;
  for (const section of resume.sections.filter((item) => item.visible))
    for (const entry of section.entries) {
      const experience = experiences[entry.experienceId];
      if (!experience) continue;
      for (const bulletId of entry.bulletIds) {
        const bullet = experience.bullets.find((item) => item.id === bulletId);
        if (!bullet) continue;
        bulletCount += 1;
        const text = entry.bulletOverrides?.[bullet.id] ?? bullet.text;
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const firstVerb = text
          .trim()
          .split(/\s+/)[0]
          ?.toLowerCase()
          .replace(/[^a-z]/g, "");
        if (firstVerb) verbs.set(firstVerb, (verbs.get(firstVerb) ?? 0) + 1);
        if (wordCount > 38)
          issues.push({
            id: `long:${bullet.id}`,
            severity: "review",
            title: "Bullet may be hard to scan",
            detail:
              "Consider keeping this bullet under 38 words without removing useful evidence.",
            experienceId: experience.id,
            bulletId: bullet.id,
          });
        if (vaguePattern.test(text))
          issues.push({
            id: `vague:${bullet.id}`,
            severity: "review",
            title: "Bullet starts vaguely",
            detail:
              "Name the concrete action you took. Keep the underlying fact unchanged.",
            experienceId: experience.id,
            bulletId: bullet.id,
          });
        const unsupported = unsupportedClaims(
          { ...bullet, text },
          experience.facts,
        );
        if (unsupported.length)
          issues.push({
            id: `claim:${bullet.id}`,
            severity: "fix",
            title: "Confirm a claim",
            detail: `Confirm the source for ${unsupported.join(", ")} or remove it.`,
            experienceId: experience.id,
            bulletId: bullet.id,
          });
        if (
          !experience.facts.some(
            (fact) =>
              fact.kind === "outcome" && bullet.factIds.includes(fact.id),
          )
        )
          issues.push({
            id: `outcome:${bullet.id}`,
            severity: "note",
            title: "Outcome not recorded",
            detail: "Add an outcome only if you know it. Do not estimate one.",
            experienceId: experience.id,
            bulletId: bullet.id,
          });
      }
    }
  for (const [verb, count] of verbs)
    if (count >= 3)
      issues.push({
        id: `verb:${verb}`,
        severity: "review",
        title: `Repeated opening: ${verb}`,
        detail: `${count} bullets begin the same way. Vary wording only where the facts support it.`,
      });
  if (!resume.contact.email)
    issues.push({
      id: "contact:email",
      severity: "fix",
      title: "Email is missing",
      detail: "Add a professional contact email before exporting.",
    });
  if (!bulletCount)
    issues.push({
      id: "content:empty",
      severity: "fix",
      title: "No resume bullets yet",
      detail:
        "Add confirmed facts to an experience, then draft a bullet from them.",
    });
  return {
    issues,
    checks: [
      { label: "Contact", status: resume.contact.email ? "ready" : "review" },
      {
        label: "Evidence",
        status: issues.some((item) => item.id.startsWith("claim:"))
          ? "review"
          : "ready",
      },
      { label: "Structure", status: bulletCount ? "ready" : "review" },
    ],
  };
}

function concepts(values: readonly string[]) {
  return new Set(
    values
      .flatMap((value) => value.toLowerCase().split(/[^a-z0-9+#.]+/))
      .filter((item) => item.length > 2),
  );
}
export function analyzeResumeAlignment(
  resume: ResumeDocumentRecord,
  experiences: Record<string, ResumeExperienceRecord>,
  opportunity?: Opportunity,
) {
  if (!opportunity)
    return {
      represented: [] as string[],
      notRepresented: [] as string[],
      availableElsewhere: [] as string[],
      note: "Choose a verified opportunity to compare its published language with this resume.",
    };
  const targetTerms = [
    ...new Set(
      [
        ...(opportunity.metadata.skillsGained ?? []),
        ...opportunity.tags,
        ...opportunity.majors,
        opportunity.category,
      ]
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 30);
  const includedExperienceIds = new Set(
    resume.sections
      .filter((section) => section.visible)
      .flatMap((section) => section.entries.map((entry) => entry.experienceId)),
  );
  const includedExperiences = Object.values(experiences).filter((item) =>
    includedExperienceIds.has(item.id),
  );
  const availableExperiences = Object.values(experiences).filter(
    (item) => !includedExperienceIds.has(item.id),
  );
  const resumeTerms = concepts([
    resume.summary ?? "",
    ...resume.skills,
    ...includedExperiences.flatMap((item) => [
      item.title ?? "",
      item.organization ?? "",
      ...item.skills,
      ...item.facts.map((fact) => fact.text),
      ...item.bullets.map((bullet) => bullet.text),
    ]),
  ]);
  const represented = targetTerms.filter((term) =>
    [...concepts([term])].some((token) => resumeTerms.has(token)),
  );
  const availableTerms = concepts(
    availableExperiences.flatMap((item) => [
      item.title ?? "",
      item.organization ?? "",
      ...item.skills,
      ...item.facts.map((fact) => fact.text),
    ]),
  );
  const availableElsewhere = targetTerms.filter(
    (term) =>
      !represented.includes(term) &&
      [...concepts([term])].some((token) => availableTerms.has(token)),
  );
  return {
    represented,
    notRepresented: targetTerms.filter((term) => !represented.includes(term)),
    availableElsewhere,
    note: "This compares published opportunity language with facts represented in this resume. It does not predict selection.",
  };
}
