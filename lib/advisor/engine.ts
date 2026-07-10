import "server-only";
import crypto from "node:crypto";
import { opportunities } from "@/data/opportunities";
import type { Opportunity } from "@/data/opportunities";
import type { StudentProfile } from "@/data/student-profile";
import { careerReadinessFrameworks, dependencyGraph, recruitingCalendars } from "./config";
import { advisorEngineVersion, advisorSourceSnapshotVersion, type AdvisorAction, type AdvisorCareerId, type AdvisorFeedbackRecord, type AdvisorOpportunity, type AdvisorOutput, type DeadlineUrgency, type EligibilityResult, type NormalizedAdvisorProfile, type RankedAdvisorOpportunity, type RawAdvisorProfile, type ReadinessResult, type RecommendationAuditRecord, type SemesterPlanItem } from "./types";

const stageMap: Record<string, NormalizedAdvisorProfile["academicStage"]> = {
  "incoming freshman": "incoming-first-year",
  "incoming first year": "incoming-first-year",
  "first year": "first-year",
  freshman: "first-year",
  "second year": "second-year",
  sophomore: "second-year",
  "third year": "third-year",
  junior: "third-year",
  "fourth year": "fourth-year",
  senior: "fourth-year",
  "graduate student": "recent-graduate",
  "recent graduate": "recent-graduate",
};

const majorAliases: Record<string, string> = {
  "computer science": "major.computer-science",
  cs: "major.computer-science",
  mathematics: "major.mathematics",
  math: "major.mathematics",
  statistics: "major.statistics",
  "data science": "major.data-science",
  economics: "major.economics",
  finance: "major.finance",
  biology: "major.biology",
  "pre-med": "major.biology",
  "pre med": "major.biology",
  biochemistry: "major.biochemistry",
  neuroscience: "major.neuroscience",
  "public health": "major.public-health",
  psychology: "major.psychology",
};

const careerAliases: Record<string, AdvisorCareerId> = {
  "quant trader": "career.quantitative-trader",
  "quantitative trader": "career.quantitative-trader",
  "quant researcher": "career.quantitative-trader",
  "quantitative researcher": "career.quantitative-trader",
  "quant developer": "career.quantitative-trader",
  "software engineering": "career.software-engineer",
  "software engineer": "career.software-engineer",
  "software developer": "career.software-engineer",
  "computer science": "career.software-engineer",
  "data scientist": "career.software-engineer",
  "machine learning engineer": "career.software-engineer",
  physician: "career.physician",
  doctor: "career.physician",
  medicine: "career.physician",
  "pre-med": "career.physician",
};

const actionTemplates: Record<string, [string, number, number]> = {
  probability: ["Complete or begin a rigorous probability course.", 5, 0.95],
  statistics: ["Strengthen statistics through coursework and one applied project.", 5, 0.9],
  programming: ["Build programming fluency through a finished, tested project.", 6, 0.9],
  mental_math: ["Practice structured mental math and probability games.", 2, 0.8],
  quant_project: ["Complete one quantitative research or simulation project.", 6, 0.95],
  finished_projects: ["Finish one substantial project before starting another.", 6, 0.95],
  data_structures: ["Complete data structures and apply them in code.", 5, 0.95],
  algorithms: ["Build algorithmic problem-solving and interview foundations.", 5, 0.9],
  team_project: ["Gain one team-based software or technical project.", 4, 0.75],
  relevant_experience: ["Pursue one relevant internship, research, campus, or client role.", 5, 0.9],
  resume_ready: ["Create and review a role-specific one-page resume.", 2, 0.85],
  interview_prep: ["Begin role-specific interview preparation with feedback.", 4, 0.8],
  clinical_exposure: ["Gain meaningful exposure to patient care and healthcare teams.", 4, 0.95],
  service_experience: ["Begin one sustained service commitment.", 3, 0.85],
  research_or_inquiry: ["Join a research or inquiry-based experience aligned with genuine interest.", 4, 0.7],
  application_timeline_ready: ["Build a verified application and testing timeline.", 2, 0.9],
  letters_plan: ["Identify potential letter writers and build sustained relationships.", 2, 0.8],
  career_fit_explored: ["Complete targeted career-fit exploration through conversations and reflection.", 2, 0.75],
  reflection_quality: ["Write structured reflections on experiences, responsibilities, and fit.", 2, 0.7],
  project_explanation: ["Practice explaining one project, tradeoffs, and results.", 2, 0.8],
  science_foundation: ["Strengthen required science foundations.", 6, 0.95],
  quantitative_reasoning: ["Strengthen quantitative reasoning through coursework and practice.", 4, 0.8],
};

function clean(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function list(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [String(value)];
}

function numeric(raw: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = raw[key];
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function boolSignal(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number") return value > 0 ? 1 : 0;
    if (typeof value === "string" && ["yes", "true", "completed", "done"].includes(clean(value))) return 1;
  }
  return 0;
}

export function normalizeOnboardingProfile(raw: RawAdvisorProfile): NormalizedAdvisorProfile {
  const input = raw as Record<string, unknown>;
  const stage = stageMap[clean(raw.academicStage ?? raw.year ?? raw.classYear ?? raw.studentYear)] ?? "incoming-first-year";
  const majors = list(raw.majors ?? raw.major ?? raw.intendedMajors);
  const goals = list(raw.careerGoals ?? raw.careerGoal ?? raw.goals ?? raw.targetCareers);
  const majorIds: string[] = [];
  const unresolvedMajors: string[] = [];
  for (const major of majors) {
    const resolved = majorAliases[clean(major)];
    if (resolved) majorIds.push(resolved);
    else unresolvedMajors.push(major);
  }
  const careerGoals: AdvisorCareerId[] = [];
  const unresolvedCareerGoals: string[] = [];
  for (const goal of goals) {
    const resolved = careerAliases[clean(goal)];
    if (resolved) careerGoals.push(resolved);
    else unresolvedCareerGoals.push(goal);
  }
  return {
    studentId: String(raw.studentId ?? raw.userId ?? "unknown-student"),
    academicStage: stage,
    majorIds: [...new Set(majorIds)].sort(),
    careerGoals: [...new Set(careerGoals)].sort(),
    weeklyAvailableHours: numeric(input, ["weeklyAvailableHours", "hoursPerWeek"], 5),
    signals: {
      programming: numeric(input, ["programming", "programmingSkill", "codingSkill"]),
      probability: numeric(input, ["probability", "probabilitySkill"]),
      statistics: numeric(input, ["statistics", "statisticsSkill"]),
      mental_math: numeric(input, ["mentalMath", "mental_math"]),
      data_structures: numeric(input, ["dataStructures", "data_structures"]),
      algorithms: numeric(input, ["algorithms", "algorithmSkill"]),
      interview_prep: numeric(input, ["interviewPrep", "interview_prep"]),
      science_foundation: numeric(input, ["scienceFoundation", "science_foundation"]),
      quantitative_reasoning: numeric(input, ["quantitativeReasoning", "quantitative_reasoning"]),
      reflection_quality: numeric(input, ["reflectionQuality", "reflection_quality"]),
      project_explanation: numeric(input, ["projectExplanation", "project_explanation"]),
      finished_projects: numeric(input, ["finishedProjects", "finished_projects"]),
      quant_project: boolSignal(input, "hasQuantProject", "quantProject"),
      team_project: boolSignal(input, "hasTeamProject", "teamProject"),
      relevant_experience: boolSignal(input, "hasRelevantExperience", "relevantExperience"),
      resume_ready: boolSignal(input, "resumeReady", "hasResume"),
      career_fit_explored: boolSignal(input, "careerFitExplored", "informationalInterviews"),
      clinical_exposure: boolSignal(input, "clinicalExposure", "hasClinicalExperience"),
      service_experience: boolSignal(input, "serviceExperience", "hasServiceExperience"),
      research_or_inquiry: boolSignal(input, "researchExperience", "hasResearchExperience"),
      application_timeline_ready: boolSignal(input, "applicationTimelineReady"),
      letters_plan: boolSignal(input, "lettersPlan", "recommendationPlan"),
    },
    constraints: raw.constraints ?? {},
    preferences: raw.preferences ?? {},
    completedDependencyNodes: raw.completedDependencyNodes,
    normalization: { unresolvedMajors, unresolvedCareerGoals, sourceVersion: "onboarding-normalizer-v0.3" },
  };
}

export function profileToRawAdvisorProfile(profile: StudentProfile, userId: string): RawAdvisorProfile {
  const weekly = Number(profile.weeklyAvailability?.match(/\d+/)?.[0] ?? 5);
  const text = `${profile.major} ${profile.careerGoal} ${profile.interests} ${profile.currentExperience ?? ""} ${(profile.goals ?? []).join(" ")} ${(profile.topics ?? []).join(" ")}`.toLowerCase();
  return {
    ...profile,
    userId,
    majors: [profile.major],
    careerGoals: [profile.careerGoal, ...(profile.goals ?? [])],
    hoursPerWeek: weekly,
    programmingSkill: /software|computer|coding|programming|data|ai/.test(text) ? 35 : 0,
    probabilitySkill: /quant|finance|math|statistics/.test(text) ? 20 : 0,
    statisticsSkill: /statistics|data|research|quant|psychology|biology/.test(text) ? 25 : 0,
    mentalMath: /quant|finance|trading/.test(text) ? 20 : 0,
    scienceFoundation: /medicine|pre-med|biology|health/.test(text) ? 35 : 0,
    quantitativeReasoning: /math|economics|finance|data|engineering/.test(text) ? 35 : 0,
    finishedProjects: /project|portfolio|github/.test(text) ? 1 : 0,
    hasResume: /resume/.test(text),
    hasResearchExperience: /research/.test(text),
    hasRelevantExperience: /internship|work experience|leadership|campus job/.test(text),
    hasClinicalExperience: /clinical|medicine|healthcare/.test(text),
    hasServiceExperience: /volunteer|service/.test(text),
    informationalInterviews: /network|explore careers|consulting/.test(text),
  };
}

function normalizedScore(value: unknown, target: number) {
  const numeric = typeof value === "boolean" ? value ? 1 : 0 : Number(value ?? 0);
  if (target <= 0) return 1;
  return Math.max(0, Math.min(1, (Number.isFinite(numeric) ? numeric : 0) / target));
}

export function scoreReadiness(student: NormalizedAdvisorProfile, careerId: AdvisorCareerId): ReadinessResult {
  const framework = careerReadinessFrameworks[careerId];
  const totals = Object.fromEntries(Object.keys(framework.dimensions).map((name) => [name, 0]));
  const counts = Object.fromEntries(Object.keys(framework.dimensions).map((name) => [name, 0]));
  const gaps: ReadinessResult["gaps"] = [];
  for (const [signal, rule] of Object.entries(framework.requirements)) {
    const current = student.signals[signal] ?? 0;
    const score = normalizedScore(current, rule.target);
    totals[rule.dimension] += score;
    counts[rule.dimension] += 1;
    if (score < 1) {
      const gapRatio = Math.max(0, 1 - score);
      gaps.push({ signal, current, target: rule.target, dimension: rule.dimension, gapRatio: Math.round(gapRatio * 1000) / 1000, estimatedReadinessGain: Math.max(1, Math.round(gapRatio * framework.dimensions[rule.dimension] * 100)) });
    }
  }
  let overall = 0;
  const dimensionScores: Record<string, number> = {};
  for (const [dimension, weight] of Object.entries(framework.dimensions)) {
    const avg = counts[dimension] ? totals[dimension] / counts[dimension] : 0;
    dimensionScores[dimension] = Math.round(avg * 100);
    overall += avg * weight;
  }
  const evidenceCoverage = Object.keys(framework.requirements).filter((signal) => student.signals[signal] !== undefined && student.signals[signal] !== 0).length / Math.max(1, Object.keys(framework.requirements).length);
  const confidence = Math.min(98, Math.round(55 + evidenceCoverage * 40 + (Object.keys(student.constraints).length ? 3 : 0)));
  gaps.sort((a, b) => b.estimatedReadinessGain - a.estimatedReadinessGain || b.gapRatio - a.gapRatio);
  return { careerId, overallScore: Math.round(overall * 100), dimensionScores, gaps, confidence };
}

export function rankActions(readiness: ReadinessResult, student: NormalizedAdvisorProfile, maximumActions = 3): AdvisorAction[] {
  const weeklyHours = student.weeklyAvailableHours || 5;
  return readiness.gaps.map((gap) => {
    const [title, effort, dependency] = actionTemplates[gap.signal] ?? [`Close the readiness gap in ${gap.signal.replaceAll("_", " ")}.`, 4, 0.65];
    const urgency = ["resume_ready", "application_timeline_ready", "relevant_experience"].includes(gap.signal) ? 1 : 0.65;
    const effortEfficiency = Math.min(1, weeklyHours / Math.max(1, effort));
    const priorityScore = Math.round((gap.estimatedReadinessGain * 0.5 + urgency * 20 * 0.2 + dependency * 15 * 0.15 + effortEfficiency * 15 * 0.15) * 10) / 10;
    return {
      actionId: `${readiness.careerId}:${gap.signal}`,
      signal: gap.signal,
      title,
      estimatedReadinessGain: gap.estimatedReadinessGain,
      weeklyHoursSuggested: Math.min(effort, Math.max(1, Math.round(weeklyHours))),
      priorityScore,
      reason: `This is currently below the target for ${gap.dimension.replaceAll("_", " ")} and is estimated to add about ${gap.estimatedReadinessGain} readiness points.`,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore).slice(0, maximumActions);
}

function successEvidence(signal: string) {
  const mapping: Record<string, string> = {
    probability: "Completed course/module plus solved problem set or project.",
    statistics: "Completed analysis demonstrating inference and uncertainty.",
    programming: "Working, tested, documented code.",
    quant_project: "Finished report, code, results, and limitations.",
    finished_projects: "Deployed or inspectable project with README and tests.",
    relevant_experience: "Confirmed role with defined responsibilities.",
    resume_ready: "Reviewed one-page resume tailored to the career.",
    interview_prep: "Completed mock interview with feedback log.",
    clinical_exposure: "Sustained healthcare exposure plus reflection.",
    service_experience: "Ongoing commitment with defined responsibility.",
    application_timeline_ready: "Verified calendar with sources and milestones.",
  };
  return mapping[signal] ?? "Inspectable output or verified completion evidence.";
}

export function buildSemesterPlan(student: NormalizedAdvisorProfile, actions: AdvisorAction[], maximumActions = 6): SemesterPlanItem[] {
  let remaining = student.weeklyAvailableHours || 5;
  const plan: SemesterPlanItem[] = [];
  for (const [index, action] of actions.entries()) {
    const hours = Math.min(action.weeklyHoursSuggested, remaining);
    if (hours <= 0) break;
    plan.push({ sequence: index + 1, actionId: action.actionId, title: action.title, weeklyHours: Math.round(hours * 10) / 10, successEvidence: successEvidence(action.signal), reason: action.reason });
    remaining -= hours;
    if (plan.length >= maximumActions) break;
  }
  return plan;
}

export function deadlineUrgency(deadline: string | null, today = new Date()): DeadlineUrgency {
  if (!deadline) return { label: "unknown", score: 0.3, daysRemaining: null, reason: "No verified deadline is available." };
  const parsed = new Date(`${deadline}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return { label: "unknown", score: 0.3, daysRemaining: null, reason: "No verified deadline is available." };
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((parsed.getTime() - start) / 86400000);
  if (days < 0) return { label: "closed", score: 0, daysRemaining: days, reason: "The deadline has passed." };
  if (days <= 7) return { label: "immediate", score: 1, daysRemaining: days, reason: "The deadline is within one week." };
  if (days <= 21) return { label: "high", score: 0.85, daysRemaining: days, reason: "The deadline is within three weeks." };
  if (days <= 60) return { label: "medium", score: 0.6, daysRemaining: days, reason: "The deadline is within two months." };
  return { label: "low", score: 0.35, daysRemaining: days, reason: "The deadline is more than two months away." };
}

export function checkEligibility(student: NormalizedAdvisorProfile, opportunity: AdvisorOpportunity): EligibilityResult {
  const reasons: string[] = [];
  let eligible = true;
  const eligibility = opportunity.eligibility;
  if (eligibility.academicStages?.length && !eligibility.academicStages.includes(student.academicStage)) {
    eligible = false;
    reasons.push("Academic stage does not match.");
  }
  if (eligibility.majorIds?.length && !student.majorIds.some((major) => eligibility.majorIds?.includes(major))) {
    eligible = false;
    reasons.push("No listed major matches the opportunity.");
  }
  const workAuthorization = eligibility.workAuthorization;
  if (workAuthorization?.length) {
    const studentAuth = student.constraints.workAuthorization;
    if (!studentAuth) reasons.push("Work authorization cannot be verified.");
    else if (!workAuthorization.includes(String(studentAuth))) {
      eligible = false;
      reasons.push("Work authorization does not match.");
    }
  }
  if (!reasons.length) reasons.push("No eligibility conflicts were detected.");
  return { eligible, reasons, confidence: eligible && reasons.length === 1 ? "high" : "medium" };
}

export function rankVerifiedOpportunities(student: NormalizedAdvisorProfile, careerId: AdvisorCareerId, advisorOpportunities: AdvisorOpportunity[], today = new Date()) {
  return advisorOpportunities.flatMap((opportunity) => {
    if (!opportunity.careerIds.includes(careerId)) return [];
    const eligibility = checkEligibility(student, opportunity);
    const urgency = deadlineUrgency(opportunity.deadline, today);
    if (!eligibility.eligible || urgency.label === "closed") return [];
    const sourceScore = { high: 1, medium: 0.7, low: 0.35 }[opportunity.sourceConfidence];
    const required = opportunity.requiredSignals ?? {};
    const ratios = Object.entries(required).map(([signal, target]) => Math.min(1, Number(student.signals[signal] ?? 0) / Number(target || 1)));
    const qualification = ratios.length ? ratios.reduce((sum, item) => sum + item, 0) / ratios.length : 0.75;
    const development = opportunity.developmentSignals ?? {};
    const unmet = Object.entries(development).filter(([signal, target]) => Number(student.signals[signal] ?? 0) < Number(target || 1)).length;
    const developmentValue = Math.min(1, unmet / Math.max(1, Object.keys(development).length));
    const score = Math.round((qualification * 0.5 + developmentValue * 0.2 + urgency.score * 0.15 + sourceScore * 0.15) * 100);
    const classification: RankedAdvisorOpportunity["classification"] = qualification >= 0.8 ? "target" : qualification >= 0.6 ? "stretch" : "developmental";
    return [{ opportunityId: opportunity.opportunityId, title: opportunity.title, score, classification, eligibility, deadlineUrgency: urgency, sourceConfidence: opportunity.sourceConfidence, explanation: [`Qualification fit: ${Math.round(qualification * 100)}%.`, `Development value: ${Math.round(developmentValue * 100)}%.`, urgency.reason, `Source confidence: ${opportunity.sourceConfidence}.`] }];
  }).sort((a, b) => b.score - a.score);
}

export function summarizeFeedback(records: AdvisorFeedbackRecord[]) {
  const summary: Record<string, { positive: number; negative: number; completed: number; reasons: string[] }> = {};
  const negative = new Set(["not-helpful", "not-relevant", "too-expensive", "too-time-consuming", "dismissed"]);
  const positive = new Set(["helpful", "completed", "already-completed"]);
  for (const record of records) {
    const current = summary[record.actionId] ?? { positive: 0, negative: 0, completed: 0, reasons: [] };
    if (positive.has(record.feedbackType)) current.positive += 1;
    if (negative.has(record.feedbackType)) current.negative += 1;
    if (record.feedbackType === "completed" || record.feedbackType === "already-completed") current.completed += 1;
    if (record.reason) current.reasons.push(record.reason);
    summary[record.actionId] = current;
  }
  return summary;
}

export function adaptActionScores(actions: AdvisorAction[], feedbackSummary: ReturnType<typeof summarizeFeedback>) {
  return actions.map((action) => {
    const item = { ...action };
    const stats = feedbackSummary[item.actionId];
    const adjustment = Math.min(8, (stats?.positive ?? 0) * 2) - Math.min(12, (stats?.negative ?? 0) * 3);
    if ((stats?.completed ?? 0) > 0 || Boolean(stats?.positive && stats.reasons.some((reason) => /already|completed/i.test(reason)))) {
      item.suppressed = true;
      item.adaptationReason = "The action was already completed.";
    } else {
      item.suppressed = false;
      item.adaptationReason = `Feedback adjustment: ${adjustment >= 0 ? "+" : ""}${adjustment} priority points.`;
    }
    item.priorityScore = Math.round(Math.max(0, item.priorityScore + adjustment) * 10) / 10;
    return item;
  }).filter((item) => !item.suppressed).sort((a, b) => b.priorityScore - a.priorityScore);
}

export function buildPreferenceConstraints(records: AdvisorFeedbackRecord[]) {
  return {
    avoidHighCostActions: records.some((record) => record.feedbackType === "too-expensive"),
    avoidHighTimeActions: records.some((record) => record.feedbackType === "too-time-consuming"),
    dismissedSignals: [...new Set(records.filter((record) => record.feedbackType === "not-relevant" || record.feedbackType === "dismissed").map((record) => record.signal).filter((item): item is string => Boolean(item)))].sort(),
  };
}

export function recommendedDependencySequence(targetNodeId: string, completedNodes: Set<string>) {
  const incoming = dependencyGraph.edges.reduce<Record<string, typeof dependencyGraph.edges>>((map, edge) => {
    map[edge.to] = [...(map[edge.to] ?? []), edge];
    return map;
  }, {});
  const visited = new Set<string>();
  const order: string[] = [];
  const visit = (nodeId: string) => {
    if (visited.has(nodeId) || completedNodes.has(nodeId)) return;
    visited.add(nodeId);
    for (const edge of [...(incoming[nodeId] ?? [])].filter((edge) => ["prerequisite", "supports", "contributes"].includes(edge.relationship)).sort((a, b) => b.weight - a.weight)) visit(edge.from);
    order.push(nodeId);
  };
  visit(targetNodeId);
  return order;
}

export function stableHash(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload, Object.keys(payload as object).sort())).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function deterministicHash(payload: unknown) {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function createAuditRecord(student: NormalizedAdvisorProfile, careerId: AdvisorCareerId, output: Omit<AdvisorOutput, "auditRecord" | "recommendationId">, generatedAt: string): RecommendationAuditRecord {
  const inputHash = deterministicHash(student);
  const outputHash = deterministicHash(output);
  const recommendationId = crypto.createHash("sha256").update(`${student.studentId}|${careerId}|${generatedAt}|${outputHash}`).digest("hex").slice(0, 20);
  return { recommendationId, studentId: student.studentId, careerId, engineVersion: advisorEngineVersion, generatedAt, inputHash, outputHash, confidence: output.confidence, topActionIds: output.highestRoiActions.slice(0, 3).map((action) => action.actionId), sourceSnapshotVersion: advisorSourceSnapshotVersion };
}

export function adaptUnlockEdOpportunities(source: readonly Opportunity[] = opportunities): AdvisorOpportunity[] {
  return source.filter((item) => item.verification_status !== "expired").map((item) => {
    const text = `${item.title} ${item.category} ${item.description} ${item.tags.join(" ")} ${item.majors.join(" ")}`.toLowerCase();
    const careerIds: AdvisorCareerId[] = [];
    if (/quant|finance|trading|statistics|math|economic/.test(text)) careerIds.push("career.quantitative-trader");
    if (/software|computer|coding|developer|engineering|data|ai|technical/.test(text)) careerIds.push("career.software-engineer");
    if (/medicine|medical|clinical|health|biology|pre-med/.test(text)) careerIds.push("career.physician");
    const verified = item.verification_status === "verified";
    const requiredSignals: Record<string, number> = item.difficulty === "Highly Competitive" ? { resume_ready: 1, relevant_experience: 1 } : item.difficulty === "Competitive" ? { resume_ready: 1 } : {};
    const developmentSignals: Record<string, number> = item.type === "Research" ? { research_or_inquiry: 1 } : item.type === "Career" ? { relevant_experience: 1, resume_ready: 1 } : item.type === "Scholarship" ? { application_timeline_ready: 1 } : {};
    return {
      opportunityId: item.id,
      title: item.title,
      opportunityType: item.category,
      careerIds: careerIds.length ? careerIds : ["career.software-engineer"],
      eligibility: {
        academicStages: item.academic_years.includes("Any Year") ? undefined : item.academic_years.map((year) => stageMap[clean(year)]).filter((stage): stage is NormalizedAdvisorProfile["academicStage"] => Boolean(stage)),
        majorIds: item.majors.includes("Any Major") ? undefined : item.majors.map((major) => majorAliases[clean(major)]).filter(Boolean),
        hardRequirements: [],
      },
      requiredSignals,
      developmentSignals,
      deadline: verified ? item.application_deadline : null,
      sourceConfidence: verified ? "high" : item.verification_status === "needs_review" ? "medium" : "low",
      verifiedAt: verified ? item.last_verified : null,
      sourceOpportunity: item,
    };
  });
}

export function generateAdvisorOutput(student: NormalizedAdvisorProfile, careerId: AdvisorCareerId, feedbackRecords: AdvisorFeedbackRecord[] = [], advisorOpportunities: AdvisorOpportunity[] = adaptUnlockEdOpportunities()): AdvisorOutput {
  const readiness = scoreReadiness(student, careerId);
  const baseActions = rankActions(readiness, student, 8);
  const highestRoiActions = adaptActionScores(baseActions, summarizeFeedback(feedbackRecords)).slice(0, 5);
  const semesterPlan = buildSemesterPlan(student, highestRoiActions, 5);
  const matchedOpportunities = rankVerifiedOpportunities(student, careerId, advisorOpportunities).slice(0, 5);
  const urgencyScore = { critical: 1, high: 0.8, medium: 0.55, low: 0.3 };
  const careerCalendar = [...(recruitingCalendars[careerId]?.[student.academicStage] ?? [])].map((item) => ({ ...item, urgencyScore: urgencyScore[item.urgency] })).sort((a, b) => b.urgencyScore - a.urgencyScore);
  const target = { "career.quantitative-trader": "milestone.quant-internship-ready", "career.software-engineer": "milestone.swe-internship-ready", "career.physician": "milestone.medical-application-ready" }[careerId];
  const dependencySequence = recommendedDependencySequence(target, new Set(student.completedDependencyNodes ?? []));
  const generatedAt = new Date().toISOString();
  const partial = {
    careerId,
    overallReadiness: readiness.overallScore,
    dimensionScores: readiness.dimensionScores,
    highestRoiActions,
    semesterPlan,
    matchedOpportunities,
    confidence: readiness.confidence,
    advisorExplanation: [
      `Overall readiness is ${readiness.overallScore}/100.`,
      readiness.gaps[0] ? `The highest-impact gap is ${readiness.gaps[0].signal.replaceAll("_", " ")}.` : "No major readiness gaps were detected in the available profile.",
      "Confidence reflects how much of the required profile data is available; it is not a probability of admission or employment.",
      "Recommendations were adapted using prior user feedback, career timing, and prerequisite dependencies.",
    ],
    careerCalendar,
    dependencySequence,
    feedbackPreferences: buildPreferenceConstraints(feedbackRecords),
    engineVersion: advisorEngineVersion,
    sourceSnapshotVersion: advisorSourceSnapshotVersion,
  };
  const auditRecord = createAuditRecord(student, careerId, partial, generatedAt);
  return { ...partial, recommendationId: auditRecord.recommendationId, auditRecord };
}

export function chooseCareerId(profile: NormalizedAdvisorProfile): AdvisorCareerId {
  return (profile.careerGoals.find((goal): goal is AdvisorCareerId => goal in careerReadinessFrameworks) ?? (profile.majorIds.includes("major.biology") ? "career.physician" : profile.majorIds.includes("major.computer-science") ? "career.software-engineer" : "career.quantitative-trader"));
}
