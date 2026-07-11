import type { AdvisorProfile } from "./advisor-engine";
import { advisorRuleKnowledgeReference, mergeKnowledgeReferences, type KnowledgeReferences } from "./knowledge-references";
import type { RecommendationV1 } from "./recommendation-engine";
import { buildStudentDigitalTwin, type StudentDigitalTwin } from "./student-digital-twin";
import type { StudentProgress } from "./student-progress";

export type InterviewCompetency = "leadership" | "teamwork" | "conflict" | "failure" | "initiative" | "communication" | "technical-depth" | "career-fit";
export type InterviewReadinessStage = "Not Ready" | "Story Mining" | "Evidence Building" | "Practice Ready" | "Interview Ready";

export type InterviewStoryInput = {
  id: string;
  title: string;
  competency: InterviewCompetency;
  situation?: string;
  task?: string;
  action?: string;
  result?: string;
  reflection?: string;
  evidenceItemIds?: string[];
};

export type InterviewStoryEvaluation = {
  storyId: string;
  title: string;
  competency: InterviewCompetency;
  starCompleteness: number;
  evidenceSupport: "none" | "weak" | "moderate" | "strong";
  missingParts: ("situation" | "task" | "action" | "result" | "reflection" | "evidence")[];
  usableForInterview: boolean;
  improvementPrompt: string;
};

export type InterviewIntelligenceResult = {
  version: "interview-intelligence-v1";
  generatedAt: string;
  readinessStage: InterviewReadinessStage;
  readinessScore: number;
  primaryRecommendation: string;
  nextAction: string;
  competencyCoverage: Record<InterviewCompetency, {
    covered: boolean;
    evidenceItemIds: string[];
    confidence: "low" | "medium" | "high";
  }>;
  storyEvaluations: InterviewStoryEvaluation[];
  evidenceBackedStoryIdeas: {
    competency: InterviewCompetency;
    title: string;
    evidenceItemIds: string[];
    whyItWorks: string;
  }[];
  practicePlan: {
    title: string;
    reason: string;
    sourceRecommendationIds: string[];
  }[];
  risks: string[];
  twin: StudentDigitalTwin;
  knowledgeReferences: KnowledgeReferences;
};

const competencies: InterviewCompetency[] = ["leadership", "teamwork", "conflict", "failure", "initiative", "communication", "technical-depth", "career-fit"];

const competencySignals: Record<InterviewCompetency, string[]> = {
  leadership: ["leadership", "professional-reliability"],
  teamwork: ["teamwork", "communication"],
  conflict: ["communication", "professional-reliability"],
  failure: ["communication", "interview-story-quality"],
  initiative: ["career-fit-evidence", "professional-reliability"],
  communication: ["communication", "interview-story-quality"],
  "technical-depth": ["technical-depth", "research-reasoning"],
  "career-fit": ["career-fit-evidence", "external-validation"],
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function evidenceSupport(count: number, strongestLevel: number): InterviewStoryEvaluation["evidenceSupport"] {
  if (count >= 2 && strongestLevel >= 3) return "strong";
  if (count >= 1 && strongestLevel >= 2) return "moderate";
  if (count >= 1) return "weak";
  return "none";
}

function storyMissingParts(story: InterviewStoryInput, support: InterviewStoryEvaluation["evidenceSupport"]): InterviewStoryEvaluation["missingParts"] {
  return [
    story.situation ? null : "situation",
    story.task ? null : "task",
    story.action ? null : "action",
    story.result ? null : "result",
    story.reflection ? null : "reflection",
    support === "none" ? "evidence" : null,
  ].filter((item): item is InterviewStoryEvaluation["missingParts"][number] => Boolean(item));
}

function evaluateStory(story: InterviewStoryInput, twin: StudentDigitalTwin): InterviewStoryEvaluation {
  const evidenceIds = story.evidenceItemIds ?? [];
  const levels = evidenceIds
    .map((id) => twin.evidenceInventory.items.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => Math.max(0, ...Object.values(item.dimensions).map(Number)));
  const support = evidenceSupport(evidenceIds.length, Math.max(0, ...levels));
  const missingParts = storyMissingParts(story, support);
  const starFields = [story.situation, story.task, story.action, story.result].filter(Boolean).length;
  const starCompleteness = clamp(starFields * 22 + (story.reflection ? 7 : 0) + (support === "strong" ? 5 : support === "moderate" ? 3 : 0));
  const missingText = missingParts.length ? `Add ${missingParts.join(", ")} before using this in an interview.` : "Practice this story aloud and make the result specific.";
  return {
    storyId: story.id,
    title: story.title,
    competency: story.competency,
    starCompleteness,
    evidenceSupport: support,
    missingParts,
    usableForInterview: starCompleteness >= 75 && support !== "none",
    improvementPrompt: missingText,
  };
}

function coverageFromTwin(twin: StudentDigitalTwin): InterviewIntelligenceResult["competencyCoverage"] {
  return Object.fromEntries(competencies.map((competency) => {
    const dimensions = competencySignals[competency];
    const evidence = twin.evidenceInventory.items.filter((item) => dimensions.some((dimension) => Number(item.dimensions[dimension as keyof typeof twin.evidenceInventory.summary] ?? 0) >= 2));
    const maxLevel = Math.max(0, ...evidence.flatMap((item) => dimensions.map((dimension) => Number(item.dimensions[dimension as keyof typeof twin.evidenceInventory.summary] ?? 0))));
    const confidence = evidence.some((item) => item.confidence === "high") ? "high" : evidence.some((item) => item.confidence === "medium") ? "medium" : "low";
    return [competency, { covered: maxLevel >= 2, evidenceItemIds: evidence.map((item) => item.id), confidence }];
  })) as InterviewIntelligenceResult["competencyCoverage"];
}

function storyIdeas(twin: StudentDigitalTwin, coverage: InterviewIntelligenceResult["competencyCoverage"]) {
  return competencies.flatMap((competency) => {
    const covered = coverage[competency];
    if (!covered.evidenceItemIds.length) return [];
    const item = twin.evidenceInventory.items.find((candidate) => candidate.id === covered.evidenceItemIds[0]);
    if (!item) return [];
    return [{
      competency,
      title: `${item.title} story`,
      evidenceItemIds: covered.evidenceItemIds.slice(0, 3),
      whyItWorks: `${item.producedBy} This can support ${competency.replaceAll("-", " ")} because it has ${covered.confidence} evidence confidence.`,
    }];
  }).slice(0, 6);
}

function recommendationPracticePlan(recommendations: readonly RecommendationV1[]) {
  return recommendations.slice(0, 3).map((recommendation) => ({
    title: `Prepare an interview answer for: ${recommendation.title}`,
    reason: recommendation.reason,
    sourceRecommendationIds: [recommendation.id],
  }));
}

function readinessStage(score: number, usableStories: number, coveredCompetencies: number): InterviewReadinessStage {
  if (score >= 82 && usableStories >= 3 && coveredCompetencies >= 5) return "Interview Ready";
  if (score >= 64 && usableStories >= 1) return "Practice Ready";
  if (coveredCompetencies >= 3) return "Evidence Building";
  if (coveredCompetencies >= 1) return "Story Mining";
  return "Not Ready";
}

export function runInterviewIntelligence(input: {
  advisorProfile: AdvisorProfile;
  progress?: StudentProgress;
  recommendations?: readonly RecommendationV1[];
  stories?: readonly InterviewStoryInput[];
}): InterviewIntelligenceResult {
  const recommendations = input.recommendations ?? [];
  const twin = buildStudentDigitalTwin({ advisorProfile: input.advisorProfile, progress: input.progress, recommendations });
  const coverage = coverageFromTwin(twin);
  const storyEvaluations = (input.stories ?? []).map((story) => evaluateStory(story, twin));
  const coveredCompetencies = Object.values(coverage).filter((item) => item.covered).length;
  const usableStories = storyEvaluations.filter((story) => story.usableForInterview).length;
  const evidenceScore = twin.dimensions.interview * 0.45 + twin.dimensions.communication * 0.25 + twin.dimensions.evidence * 0.2 + Math.min(10, usableStories * 3);
  const readinessScore = clamp(evidenceScore);
  const stage = readinessStage(readinessScore, usableStories, coveredCompetencies);
  const missing = competencies.filter((competency) => !coverage[competency].covered);
  const risks = [
    missing.length ? `Missing interview evidence for: ${missing.slice(0, 3).map((item) => item.replaceAll("-", " ")).join(", ")}.` : "",
    twin.stateFlags.includes("time-constrained") ? "Weekly availability is tight, so practice should stay short and repeatable." : "",
    twin.evidenceInventory.gaps.includes("external-validation") ? "Most stories need stronger external validation before they sound credible." : "",
  ].filter(Boolean);
  const firstGap = missing[0];
  return {
    version: "interview-intelligence-v1",
    generatedAt: new Date().toISOString(),
    readinessStage: stage,
    readinessScore,
    primaryRecommendation: firstGap ? `Develop one evidence-backed ${firstGap.replaceAll("-", " ")} story from your existing activities.` : "Practice your strongest evidence-backed stories with feedback.",
    nextAction: firstGap ? "Pick one real activity, write the situation-task-action-result-reflection outline, and attach the evidence it produced." : "Run one mock interview and record what to improve.",
    competencyCoverage: coverage,
    storyEvaluations,
    evidenceBackedStoryIdeas: storyIdeas(twin, coverage),
    practicePlan: recommendationPracticePlan(recommendations),
    risks,
    twin,
    knowledgeReferences: mergeKnowledgeReferences(
      advisorRuleKnowledgeReference("interview_intelligence_v1"),
      advisorRuleKnowledgeReference("student_digital_twin_v1"),
      advisorRuleKnowledgeReference("evidence_inventory_v1"),
    ),
  };
}
