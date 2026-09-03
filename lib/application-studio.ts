import type { AnswerBankRecord, ApplicationRecommenderRecord, ApplicationWorkspaceRecord, WrittenResponseRecord } from "./account-types";
import type { ResumeLabStore } from "@/data/resume-lab";

export type PromptComponent = { label: string; cues: string[]; state: "addressed" | "possibly_missing" | "needs_review" };
export type WritingFinding = { id: string; category: "prompt_coverage" | "specificity" | "evidence" | "clarity" | "structure" | "length" | "repetition"; severity: "fix" | "review" | "note"; title: string; detail: string };

const numberClaim = /(?:[$£€]\s?\d[\d,.]*|\b\d+(?:\.\d+)?\s?(?:%|percent|x|people|students|users|members|hours?|days?|weeks?|months?|years?|projects|awards?))/gi;
const authorityClaim = /\b(led|managed|directed|supervised|largest|best|first|only|top)\b/gi;
const technologyClaim = /\b(?:Python|JavaScript|TypeScript|React|SQL|Excel|Tableau|AWS|Azure|Docker|Kubernetes)\b/gi;
const vague = /\b(i learned a lot|helped with|worked on|things|stuff|very unique|really passionate)\b/i;

export function responseCounts(text: string) {
  return { words: text.trim() ? text.trim().split(/\s+/).length : 0, characters: text.length };
}

export function decomposePrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  if (/challenge|obstacle|setback|difficult/.test(lower)) return [
    { label: "Challenge", cues: ["challenge", "problem", "obstacle", "difficult"] },
    { label: "Your response", cues: ["responded", "decided", "did", "action", "approach"] },
    { label: "Outcome", cues: ["result", "outcome", "changed", "after"] },
    { label: "What you learned", cues: ["learned", "realized", "understand", "growth"] },
  ];
  if (/why|interest|motivat/.test(lower)) return [
    { label: "Your reason", cues: ["because", "interest", "motivated", "drawn"] },
    { label: "Specific connection", cues: ["program", "opportunity", "field", "work"] },
    { label: "Relevant evidence", cues: ["experience", "project", "research", "course"] },
  ];
  if (/lead|team|collaborat/.test(lower)) return [
    { label: "Situation", cues: ["team", "group", "context", "when"] },
    { label: "Your contribution", cues: ["led", "organized", "created", "decided", "contributed"] },
    { label: "Result or learning", cues: ["result", "learned", "outcome", "changed"] },
  ];
  return [
    { label: "Main response", cues: prompt.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 5).slice(0, 6) },
    { label: "Specific example or evidence", cues: ["example", "experience", "project", "research", "work"] },
    { label: "Reflection or connection", cues: ["learned", "because", "therefore", "future", "goal"] },
  ];
}

function evidenceText(resumeLab: ResumeLabStore | undefined, stories: readonly AnswerBankRecord[]) {
  return [
    ...Object.values(resumeLab?.experiences ?? {}).flatMap((experience) => [experience.title ?? "", experience.organization ?? "", ...experience.skills, ...experience.facts.filter((fact) => fact.confirmed).map((fact) => fact.text)]),
    ...stories.flatMap((story) => [story.title, story.situation ?? "", story.action ?? "", story.challenge ?? "", story.result ?? "", story.learning ?? ""]),
  ].join(" ").toLowerCase();
}

export function reviewWrittenResponse(response: WrittenResponseRecord, resumeLab?: ResumeLabStore, stories: readonly AnswerBankRecord[] = []) {
  const findings: WritingFinding[] = [];
  const draft = response.draft.trim();
  const counts = responseCounts(response.draft);
  const evidence = evidenceText(resumeLab, stories);
  const components: PromptComponent[] = decomposePrompt(response.prompt).map((component, index) => {
    const addressed = draft.length > 80 && component.cues.some((cue) => draft.toLowerCase().includes(cue));
    return { ...component, state: !draft ? "needs_review" : addressed || (index === 0 && draft.length > 180) ? "addressed" : "possibly_missing" };
  });
  if (!draft) findings.push({ id: "draft:empty", category: "prompt_coverage", severity: response.required ? "fix" : "review", title: "Response not started", detail: "This prompt has no saved response draft." });
  for (const component of components.filter((item) => item.state !== "addressed")) findings.push({ id: `coverage:${component.label}`, category: "prompt_coverage", severity: "review", title: `${component.label} may be missing`, detail: "Review whether the response addresses this part of the prompt. This is a language check, not an evaluation rubric." });
  if (response.wordLimit && counts.words > response.wordLimit) findings.push({ id: "limit:words", category: "length", severity: "fix", title: `${counts.words - response.wordLimit} words over the verified limit`, detail: `The draft is ${counts.words} words; the recorded limit is ${response.wordLimit}. Nothing was truncated.` });
  if (response.characterLimit && counts.characters > response.characterLimit) findings.push({ id: "limit:characters", category: "length", severity: "fix", title: `${counts.characters - response.characterLimit} characters over the verified limit`, detail: `The draft is ${counts.characters} characters; the recorded limit is ${response.characterLimit}. Nothing was truncated.` });
  if (vague.test(draft)) findings.push({ id: "specificity:vague", category: "specificity", severity: "review", title: "A statement may need a concrete explanation", detail: "Explain what you personally did or what changed without adding unsupported details." });
  const longSentence = draft.split(/[.!?]+/).find((sentence) => sentence.trim().split(/\s+/).length > 42);
  if (longSentence) findings.push({ id: "clarity:sentence", category: "clarity", severity: "review", title: "Long sentence", detail: "One sentence exceeds 42 words. Consider splitting it while preserving meaning." });
  const claims = [...new Set([...(draft.match(numberClaim) ?? []), ...(draft.match(authorityClaim) ?? []), ...(draft.match(technologyClaim) ?? [])])];
  const unsupported = claims.filter((claim) => !evidence.includes(claim.toLowerCase()));
  if (unsupported.length) findings.push({ id: "evidence:claims", category: "evidence", severity: "fix", title: "Confirm new factual claims", detail: `These claims are not present in selected confirmed facts: ${unsupported.slice(0, 8).join(", ")}. Confirm or revise them before marking Ready.` });
  const paragraphs = draft.split(/\n\s*\n/).map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (new Set(paragraphs).size < paragraphs.length) findings.push({ id: "repetition:paragraph", category: "repetition", severity: "review", title: "Repeated paragraph", detail: "Two paragraphs appear identical." });
  return { counts, components, findings, ready: Boolean(draft) && !findings.some((item) => item.severity === "fix") };
}

export function relevantAnswerStories(prompt: string, stories: readonly AnswerBankRecord[]) {
  const terms = new Set(prompt.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4));
  const categorySignals = /lead/.test(prompt.toLowerCase()) ? ["leadership"] : /challenge|problem/.test(prompt.toLowerCase()) ? ["challenge", "problem"] : /team|collaborat/.test(prompt.toLowerCase()) ? ["teamwork"] : /research/.test(prompt.toLowerCase()) ? ["research"] : [];
  return stories.flatMap((story) => {
    const text = [story.title, story.category, story.situation, story.action, story.challenge, story.result, story.learning].filter(Boolean).join(" ").toLowerCase();
    const overlap = [...terms].filter((term) => text.includes(term));
    const category = categorySignals.find((signal) => text.includes(signal));
    if (!overlap.length && !category) return [];
    return [{ story, reason: category ? `Contains a confirmed ${category} example.` : `Shares prompt language: ${overlap.slice(0, 3).join(", ")}.` }];
  }).slice(0, 6);
}

export function recommendationNeedsAction(recommenders: readonly ApplicationRecommenderRecord[]) {
  return !recommenders.length || recommenders.some((person) => ["not_requested", "planning", "unknown", "declined"].includes(person.status));
}
