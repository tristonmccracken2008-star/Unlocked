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
  category: "content" | "evidence" | "clarity" | "consistency" | "layout" | "target_alignment";
  title: string;
  detail: string;
  experienceId?: string;
  bulletId?: string;
};
export type ResumeAudit = {
  issues: ResumeAuditIssue[];
  checks: { label: string; status: "ready" | "review" }[];
  counts: Record<ResumeAuditIssue["category"], number>;
  layout: { estimatedLines: number; estimatedPages: number; overflow: boolean; note: string };
};

const claimPattern =
  /(?:[$£€]\s?\d[\d,.]*|\b\d+(?:\.\d+)?\s?(?:%|percent|x|hours?|days?|weeks?|months?|years?|people|students|users|members|projects|applications|awards?)(?=\s|[.,;:!?)]|$))/gi;
const vaguePattern =
  /\b(helped|worked on|responsible for|various|multiple tasks|assisted with|participated in)\b/i;
const firstPersonPattern = /\b(i|my|me|we|our)\b/i;
const fillerPattern = /\b(utilized|leveraged|synerg(?:y|ies)|dynamic solutions?|innovative methodologies|responsible for)\b/i;
const unsupportedAuthorityPattern = /\b(led|managed|directed|supervised|largest|best|first|only|top)\b/i;
const pastVerbPattern = /\b(ed|built|led|wrote|ran|made|taught|presented|analyzed|developed|implemented|coordinated|researched)\b/i;

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

export function bulletAlternatives(facts: readonly ResumeFact[]) {
  const confirmed = facts.filter((fact) => fact.confirmed && fact.text.trim());
  if (!confirmed.length) return [];
  const action = confirmed.find((fact) => fact.kind === "action" || fact.kind === "creation" || fact.kind === "responsibility") ?? confirmed[0]!;
  const context = confirmed.filter((fact) => fact.id !== action.id && !["outcome", "scope", "frequency"].includes(fact.kind));
  const evidence = confirmed.filter((fact) => ["outcome", "scope", "frequency"].includes(fact.kind));
  const sentence = (values: ResumeFact[]) => `${values.map((fact) => fact.text.replace(/[.;]+$/, "")).join("; ")}.`;
  return [
    { label: "Concise", text: sentence([action, ...evidence.slice(0, 1)]) },
    { label: "Detailed", text: sentence([action, ...context, ...evidence]) },
    ...(evidence.length ? [{ label: "Evidence first", text: sentence([...evidence, action, ...context]) }] : []),
  ].filter((item, index, values) => values.findIndex((candidate) => candidate.text === item.text) === index);
}

export function factDiscoveryQuestions(kind: ResumeExperienceRecord["kind"]) {
  const common = [
    "Who did you work with or help?",
    "What tools, methods, or systems did you actually use?",
    "What changed because of your work, if anything you can confirm?",
  ];
  const specific: Partial<Record<ResumeExperienceRecord["kind"], string[]>> = {
    work: ["What did a typical shift include?", "How many people, tables, orders, or requests did you usually support, if known?"],
    internship: ["What did you personally own?", "What did you deliver or present?"],
    research: ["How many samples, records, or papers did you analyze?", "Did you present or document the work?"],
    project: ["What did you personally build?", "How many features, routes, users, or records were involved, if measured?"],
    course_project: ["What part did you personally implement?", "What technical or analytical decision did you make?"],
    independent_project: ["Why did you build it?", "Is it deployed or publicly available?"],
    leadership: ["What decisions were yours?", "How many members or events were involved, if known?"],
    teaching: ["Who did you teach and how often?", "What material did you prepare?"],
    athletics: ["What was your role on the team?", "What training, competition, or leadership responsibility can you confirm?"],
    publication: ["What was your contribution?", "Where and when was it published?"],
  };
  return [...(specific[kind] ?? ["What did you personally do?", "What concrete context would help someone understand the work?"]), ...common].slice(0, 5);
}

export function estimateResumeLayout(resume: ResumeDocumentRecord, experiences: Record<string, ResumeExperienceRecord>) {
  let estimatedLines = 7 + (resume.summary ? Math.max(2, Math.ceil(resume.summary.length / 92)) : 0) + Math.max(1, Math.ceil(resume.skills.join(" · ").length / 105));
  for (const section of resume.sections.filter((item) => item.visible)) {
    estimatedLines += 2;
    for (const entry of section.entries) {
      estimatedLines += 2;
      const experience = experiences[entry.experienceId];
      for (const bulletId of entry.bulletIds) {
        const bullet = experience?.bullets.find((item) => item.id === bulletId);
        const text = entry.bulletOverrides?.[bulletId] ?? bullet?.text ?? "";
        estimatedLines += Math.max(1, Math.ceil(text.length / 96));
      }
    }
  }
  const estimatedPages = Math.max(1, Math.ceil(estimatedLines / 54));
  return { estimatedLines, estimatedPages, overflow: estimatedPages > 1, note: estimatedPages > 1 ? `The current template is likely to run to ${estimatedPages} pages. Review content before shrinking type.` : "The current template is likely to fit on one page. Confirm in print preview." };
}

export function auditResume(
  resume: ResumeDocumentRecord,
  experiences: Record<string, ResumeExperienceRecord>,
): ResumeAudit {
  const issues: ResumeAuditIssue[] = [];
  const verbs = new Map<string, number>();
  let bulletCount = 0;
  const punctuation = new Set<boolean>();
  for (const section of resume.sections.filter((item) => item.visible))
    for (const entry of section.entries) {
      const experience = experiences[entry.experienceId];
      if (!experience) continue;
      if (!experience.startDate)
        issues.push({ id: `date:${experience.id}`, severity: "review", category: "content", title: "Experience date is missing", detail: `${experience.title ?? "An experience"} has no start date. Add it if known.`, experienceId: experience.id });
      if (!entry.bulletIds.length)
        issues.push({ id: `bullets:${experience.id}`, severity: "fix", category: "content", title: `${experience.title ?? "Experience"} has no bullets`, detail: "Capture what you actually did, then draft wording from confirmed facts.", experienceId: experience.id });
      for (const bulletId of entry.bulletIds) {
        const bullet = experience.bullets.find((item) => item.id === bulletId);
        if (!bullet) continue;
        bulletCount += 1;
        const text = entry.bulletOverrides?.[bullet.id] ?? bullet.text;
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        punctuation.add(/[.!?]$/.test(text.trim()));
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
            category: "clarity",
            title: "Bullet may be hard to scan",
            detail:
              `This bullet is ${wordCount} words and may wrap to three lines in the current template. Tighten wording before shrinking type.`,
            experienceId: experience.id,
            bulletId: bullet.id,
          });
        if (vaguePattern.test(text))
          issues.push({
            id: `vague:${bullet.id}`,
            severity: "review",
            category: "clarity",
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
            category: "evidence",
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
            category: "evidence",
            title: "Outcome not recorded",
            detail: "Add an outcome only if you know it. Do not estimate one.",
            experienceId: experience.id,
            bulletId: bullet.id,
          });
        if (firstPersonPattern.test(text))
          issues.push({ id: `pronoun:${bullet.id}`, severity: "review", category: "consistency", title: "First-person wording", detail: "Resume bullets usually omit first-person pronouns. Remove the pronoun without changing the fact.", experienceId: experience.id, bulletId: bullet.id });
        if (fillerPattern.test(text))
          issues.push({ id: `filler:${bullet.id}`, severity: "review", category: "clarity", title: "Plain wording would be clearer", detail: "Replace vague or inflated phrasing with the concrete action you took.", experienceId: experience.id, bulletId: bullet.id });
        if (unsupportedAuthorityPattern.test(text) && !experience.facts.some((fact) => bullet.factIds.includes(fact.id) && fact.confirmed && new RegExp(`\\b${text.match(unsupportedAuthorityPattern)?.[1] ?? ""}\\b`, "i").test(fact.text)))
          issues.push({ id: `authority:${bullet.id}`, severity: "fix", category: "evidence", title: "Confirm responsibility or comparison", detail: "This wording implies leadership or a comparison that is not present in the linked facts.", experienceId: experience.id, bulletId: bullet.id });
        if (experience.current && pastVerbPattern.test(text.split(/\s+/)[0] ?? ""))
          issues.push({ id: `tense:${bullet.id}`, severity: "note", category: "consistency", title: "Review tense", detail: "This is marked as a current experience, but the bullet appears to open in past tense. Keep past tense if the work itself is complete.", experienceId: experience.id, bulletId: bullet.id });
      }
    }
  for (const [verb, count] of verbs)
    if (count >= 3)
      issues.push({
        id: `verb:${verb}`,
        severity: "review",
        category: "consistency",
        title: `Repeated opening: ${verb}`,
        detail: `${count} bullets begin the same way. Vary wording only where the facts support it.`,
      });
  if (!resume.contact.email)
    issues.push({
      id: "contact:email",
      severity: "fix",
      category: "content",
      title: "Email is missing",
      detail: "Add a professional contact email before exporting.",
    });
  if (!bulletCount)
    issues.push({
      id: "content:empty",
      severity: "fix",
      category: "content",
      title: "No resume bullets yet",
      detail:
        "Add confirmed facts to an experience, then draft a bullet from them.",
    });
  if (punctuation.size > 1)
    issues.push({ id: "punctuation:mixed", severity: "review", category: "consistency", title: "Bullet punctuation is inconsistent", detail: "Some bullets end with punctuation and others do not. Choose one style for this version." });
  const layout = estimateResumeLayout(resume, experiences);
  if (layout.overflow)
    issues.push({ id: "layout:overflow", severity: "review", category: "layout", title: `Resume likely runs to ${layout.estimatedPages} pages`, detail: "Remove weak or low-relevance content and tighten wording before reducing spacing or type size." });
  const counts = { content: 0, evidence: 0, clarity: 0, consistency: 0, layout: 0, target_alignment: 0 } satisfies Record<ResumeAuditIssue["category"], number>;
  for (const issue of issues) counts[issue.category] += 1;
  return {
    issues,
    counts,
    layout,
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

export function resumeStudioState(
  resume: ResumeDocumentRecord,
  experiences: Record<string, ResumeExperienceRecord>,
  audit = auditResume(resume, experiences),
) {
  const includedIds = new Set(resume.sections.filter((section) => section.visible).flatMap((section) => section.entries.map((entry) => entry.experienceId)));
  const included = Object.values(experiences).filter((experience) => includedIds.has(experience.id));
  const omitted = Object.values(experiences).filter((experience) => !includedIds.has(experience.id));
  const withoutDescriptions = included.filter((experience) => !experience.bullets.length);
  const education = resume.sections.find((section) => section.kind === "education");
  const firstFix = audit.issues.find((issue) => issue.severity === "fix");
  const nextAction = !resume.contact.email
    ? { kind: "identity", label: "Finish contact information", detail: "Add a professional email before export." }
    : !education?.visible
      ? { kind: "education", label: "Include Education", detail: "Education is hidden from this version." }
      : firstFix
        ? { kind: firstFix.category, label: firstFix.title, detail: firstFix.detail }
        : withoutDescriptions.length
          ? { kind: "content", label: `Add bullets to ${withoutDescriptions[0]!.title ?? "an experience"}`, detail: "Start from confirmed facts, then choose the clearest wording." }
          : audit.layout.overflow
            ? { kind: "layout", label: "Review page overflow", detail: audit.layout.note }
            : resume.target.type === "opportunity"
              ? { kind: "tailor", label: "Review target alignment", detail: "Check what the opportunity explicitly mentions and what your resume truthfully represents." }
              : audit.issues.length
                ? { kind: "review", label: "Review resume findings", detail: `${audit.issues.length} factual or writing item${audit.issues.length === 1 ? "" : "s"} remain.` }
                : { kind: "ready", label: "Open print preview", detail: "No known factual or structural issues remain. Confirm the final page visually." };
  return {
    includedCount: included.length,
    omittedCount: omitted.length,
    factsCount: included.reduce((sum, experience) => sum + experience.facts.filter((fact) => fact.confirmed).length, 0),
    bulletsCount: included.reduce((sum, experience) => sum + experience.bullets.length, 0),
    checklist: [
      { label: "Contact information", ready: Boolean(resume.contact.email) },
      { label: "Education", ready: Boolean(education?.visible) },
      { label: `${included.length} experience${included.length === 1 ? "" : "s"}`, ready: included.length > 0 },
      { label: "Resume bullets", ready: included.length > 0 && !withoutDescriptions.length },
      { label: "Print layout", ready: !audit.layout.overflow },
    ],
    nextAction,
  };
}
