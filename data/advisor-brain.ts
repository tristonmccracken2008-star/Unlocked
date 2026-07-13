import type { AdvisorProfile } from "./advisor-engine";
import { buildEvidenceInventory, evidenceDimensions, type EvidenceDimension, type EvidenceInventory } from "./evidence-inventory";
import { getOpportunityIntelligence, scoreOpportunityIntelligence, type OpportunityStudentContext } from "./opportunity-intelligence";
import type { Opportunity } from "./opportunities";
import { runInterviewIntelligence, type InterviewIntelligenceResult } from "./interview-intelligence";
import { runRecommendationEngineV1, type RecommendationV1 } from "./recommendation-engine";
import { buildStudentDigitalTwin, type StudentDigitalTwin } from "./student-digital-twin";
import type { StudentProgress } from "./student-progress";

export type AdvisorBrainReadinessCategory = "Technical" | "Leadership" | "Communication" | "Experience" | "Networking" | "Interview";

export type AdvisorBrainExplanation = {
  whyRecommended: string[];
  evidenceUsed: string[];
  confidence: number;
  expectedImpact: string;
  tradeoffs: string[];
  estimatedCompletionTime: string;
};

export type AdvisorBrainAction = AdvisorBrainExplanation & {
  title: string;
  nextAction: string;
  priority: RecommendationV1["priority"];
  estimatedValue: string;
  recommendationId: string;
};

export type AdvisorBrainGap = AdvisorBrainExplanation & {
  title: string;
  competency: EvidenceDimension;
  whyItMatters: string;
  howToClose: string;
};

export type AdvisorBrainReadinessScore = {
  category: AdvisorBrainReadinessCategory;
  score: number;
  explanation: string;
  factors: string[];
  confidence: EvidenceInventory["summary"][EvidenceDimension]["confidence"];
};

export type AdvisorBrainDashboard = {
  generatedAt: string;
  highestImpactAction: AdvisorBrainAction | null;
  biggestCareerGap: AdvisorBrainGap;
  readinessScores: AdvisorBrainReadinessScore[];
  twin: StudentDigitalTwin;
  evidenceInventory: EvidenceInventory;
  interview: InterviewIntelligenceResult;
  recommendations: RecommendationV1[];
  opportunityRecommendations: RecommendationV1[];
};

export type OpportunityAdvisorExplanation = AdvisorBrainExplanation & {
  title: string;
  skillsGained: string[];
  competenciesStrengthened: string[];
  evidenceGenerated: string[];
  resumeImpact: string;
  interviewValue: string;
  estimatedRoi: string;
  knowledgeReferences: string[];
};

const dimensionLabels: Record<EvidenceDimension, string> = {
  "technical-depth": "Technical depth",
  "research-reasoning": "Research reasoning",
  "external-validation": "External validation",
  teamwork: "Teamwork",
  communication: "Communication",
  leadership: "Leadership",
  "professional-reliability": "Professional reliability",
  "user-or-stakeholder-exposure": "User or stakeholder exposure",
  "career-fit-evidence": "Career fit evidence",
  "interview-story-quality": "Interview story quality",
};

const dimensionCloseActions: Record<EvidenceDimension, string> = {
  "technical-depth": "Complete one project, research task, or technical deliverable that can be shown or explained.",
  "research-reasoning": "Join a research-style project and document the question, method, and result.",
  "external-validation": "Apply for one verified program, role, award, or public opportunity that can validate your work.",
  teamwork: "Choose a project, club, job, or lab where another person depends on your contribution.",
  communication: "Create a concise resume bullet, project summary, or application answer with a concrete result.",
  leadership: "Take responsibility for one small outcome in a group, event, project, or campus role.",
  "professional-reliability": "Finish one visible milestone before starting another application.",
  "user-or-stakeholder-exposure": "Find one opportunity that puts your work in front of users, mentors, clients, or reviewers.",
  "career-fit-evidence": "Pick one opportunity that directly tests the career direction in your profile.",
  "interview-story-quality": "Write a short STAR outline for one real activity and attach the evidence it produced.",
};

const readinessMap: Record<AdvisorBrainReadinessCategory, EvidenceDimension[]> = {
  Technical: ["technical-depth", "research-reasoning"],
  Leadership: ["leadership", "teamwork"],
  Communication: ["communication", "interview-story-quality"],
  Experience: ["external-validation", "professional-reliability", "career-fit-evidence"],
  Networking: ["user-or-stakeholder-exposure", "communication"],
  Interview: ["interview-story-quality", "communication", "external-validation"],
};

const priorityImpact: Record<RecommendationV1["priority"], string> = {
  Critical: "High immediate impact because timing or eligibility makes this hard to recover later.",
  High: "Strong near-term impact because it matches your current stage and improves your evidence.",
  Recommended: "Useful impact because it strengthens a relevant area without adding unnecessary pressure.",
  Optional: "Good exploratory value, but it should come after higher-fit work.",
};
const brainCache = new Map<string, AdvisorBrainDashboard>();
const maxBrainCacheEntries = 20;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function knowledgeIds(recommendation: RecommendationV1) {
  return unique([
    ...recommendation.knowledgeReferences.advisorRules,
    ...recommendation.knowledgeReferences.majors,
    ...recommendation.knowledgeReferences.careers,
    ...recommendation.knowledgeReferences.skills,
    ...recommendation.knowledgeReferences.opportunityTypes,
  ]);
}

function evidenceUsed(inventory: EvidenceInventory, dimensions: EvidenceDimension[]) {
  const ids = unique(dimensions.flatMap((dimension) => inventory.summary[dimension].sourceItemIds)).slice(0, 4);
  const labels = ids
    .map((id) => inventory.items.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => item.title);
  return labels.length ? labels : ["Saved profile, roadmap stage, and structured opportunity matching."];
}

function recommendationTime(recommendation: RecommendationV1) {
  if (recommendation.kind === "Milestone") return "1-3 focused sessions";
  if (/deadline|apply|application/i.test(recommendation.nextAction)) return "30-90 minutes to review and start";
  if (/official source|claim|account/i.test(recommendation.nextAction)) return "15-30 minutes";
  return "About 30 minutes to decide the next step";
}

function recommendationTradeoffs(recommendation: RecommendationV1) {
  return unique([
    recommendation.priority === "Critical" ? "May require acting before you have a perfect application." : "",
    recommendation.kind === "Opportunity" ? "You still need to confirm eligibility and deadlines on the official source." : "This improves readiness but may not produce an immediate application outcome.",
    recommendation.estimatedValue === null ? "The dollar value is unknown or not the main reason to do this." : "",
  ]);
}

function toAction(recommendation: RecommendationV1, inventory: EvidenceInventory): AdvisorBrainAction {
  const evidenceDims: EvidenceDimension[] = recommendation.kind === "Milestone"
    ? ["professional-reliability", "career-fit-evidence", "interview-story-quality"]
    : ["external-validation", "career-fit-evidence", "professional-reliability"];
  return {
    title: recommendation.title,
    nextAction: recommendation.nextAction,
    priority: recommendation.priority,
    estimatedValue: recommendation.estimatedValueLabel,
    recommendationId: recommendation.id,
    whyRecommended: recommendation.reasons,
    evidenceUsed: unique([...evidenceUsed(inventory, evidenceDims), ...knowledgeIds(recommendation).slice(0, 3)]),
    confidence: recommendation.confidence,
    expectedImpact: priorityImpact[recommendation.priority],
    tradeoffs: recommendationTradeoffs(recommendation),
    estimatedCompletionTime: recommendationTime(recommendation),
  };
}

function biggestGap(inventory: EvidenceInventory, recommendations: RecommendationV1[]): AdvisorBrainGap {
  const sorted = [...evidenceDimensions].sort((a, b) => inventory.summary[a].level - inventory.summary[b].level);
  const competency = sorted[0] ?? "career-fit-evidence";
  const label = dimensionLabels[competency];
  const recommendation = recommendations.find((item) => item.reasons.some((reason) => reason.toLowerCase().includes(competency.split("-")[0]))) ?? recommendations[0];
  return {
    title: label,
    competency,
    whyItMatters: `${label} is the weakest supported area in your current evidence inventory, so strong opportunities may be harder to turn into applications or interview stories.`,
    howToClose: recommendation?.nextAction ?? dimensionCloseActions[competency],
    whyRecommended: [
      `${label} has a current evidence level of ${inventory.summary[competency].level}/4.`,
      inventory.summary[competency].supportCount ? `${inventory.summary[competency].supportCount} evidence item(s) support this area.` : "UnlockED has not found enough saved activity, applications, or completed milestones for this area yet.",
    ],
    evidenceUsed: evidenceUsed(inventory, [competency]),
    confidence: inventory.summary[competency].confidence === "high" ? 88 : inventory.summary[competency].confidence === "medium" ? 72 : 58,
    expectedImpact: "Closing this gap should make recommendations, applications, and interview preparation more specific.",
    tradeoffs: ["This is based on saved UnlockED evidence only; offline accomplishments should be added through profile updates or future progress tools."],
    estimatedCompletionTime: "1-2 weeks of focused evidence-building",
  };
}

function readinessScores(twin: StudentDigitalTwin, inventory: EvidenceInventory): AdvisorBrainReadinessScore[] {
  return (Object.keys(readinessMap) as AdvisorBrainReadinessCategory[]).map((category) => {
    const dimensions = readinessMap[category];
    const evidenceScore = dimensions.reduce((sum, dimension) => sum + inventory.summary[dimension].level * 25, 0) / dimensions.length;
    const twinScore = category === "Technical" ? twin.dimensions.technical
      : category === "Communication" ? twin.dimensions.communication
      : category === "Experience" ? twin.dimensions.evidence
      : category === "Networking" ? twin.dimensions.network
      : category === "Interview" ? twin.dimensions.interview
      : evidenceScore;
    const confidence = dimensions
      .map((dimension) => inventory.summary[dimension].confidence)
      .sort((a, b) => ({ low: 0, medium: 1, high: 2 }[b] - { low: 0, medium: 1, high: 2 }[a]))[0];
    return {
      category,
      score: clamp((evidenceScore + twinScore) / 2),
      confidence,
      explanation: `${category} is scored from your Student Digital Twin plus evidence coverage for ${dimensions.map((dimension) => dimensionLabels[dimension].toLowerCase()).join(" and ")}.`,
      factors: dimensions.map((dimension) => `${dimensionLabels[dimension]}: ${inventory.summary[dimension].level}/4`),
    };
  });
}

export function buildAdvisorBrain(input: {
  advisorProfile: AdvisorProfile;
  progress?: StudentProgress;
  opportunities?: readonly Opportunity[];
}): AdvisorBrainDashboard {
  const cacheKey = JSON.stringify({
    profile: input.advisorProfile,
    progress: input.progress ?? null,
    opportunityCount: input.opportunities?.length ?? 0,
    opportunityVersion: input.opportunities?.slice(0, 3).map((item) => `${item.id}:${item.last_verified}`).join("|") ?? "default",
  });
  const cached = brainCache.get(cacheKey);
  if (cached) return cached;
  const recommendationResult = runRecommendationEngineV1({
    advisorProfile: input.advisorProfile,
    progress: input.progress,
    opportunities: input.opportunities,
    limit: 8,
  });
  const recommendations = recommendationResult.recommendations;
  const evidenceInventory = buildEvidenceInventory({ advisorProfile: input.advisorProfile, progress: input.progress, recommendations });
  const twin = buildStudentDigitalTwin({ advisorProfile: input.advisorProfile, progress: input.progress, recommendations });
  const interview = runInterviewIntelligence({ advisorProfile: input.advisorProfile, progress: input.progress, recommendations });
  const result = {
    generatedAt: new Date().toISOString(),
    highestImpactAction: recommendations[0] ? toAction(recommendations[0], evidenceInventory) : null,
    biggestCareerGap: biggestGap(evidenceInventory, recommendations),
    readinessScores: readinessScores(twin, evidenceInventory),
    twin,
    evidenceInventory,
    interview,
    recommendations,
    opportunityRecommendations: recommendationResult.opportunityRecommendations,
  };
  brainCache.set(cacheKey, result);
  if (brainCache.size > maxBrainCacheEntries) brainCache.delete(brainCache.keys().next().value);
  return result;
}

function studentContext(profile: AdvisorProfile): OpportunityStudentContext {
  return {
    schoolSlug: profile.school.slug,
    schoolName: profile.school.name,
    major: profile.academics.major,
    academicYear: profile.academics.academicYear,
    careerGoals: [profile.goals.careerGoal, ...profile.goals.primaryGoals].filter(Boolean).join(", "),
    interests: unique([...profile.goals.interests, ...profile.goals.topics]),
    savedOpportunityIds: profile.experience.savedOpportunityIds,
    viewedOpportunityIds: profile.experience.viewedOpportunityIds,
  };
}

function opportunityEvidence(item: Opportunity) {
  const intelligence = getOpportunityIntelligence(item);
  const base = [
    item.type === "Research" ? "A research or mentor-guided work sample." : "",
    item.type === "Career" ? "A career-facing application, role, or professional signal." : "",
    item.type === "Scholarship" ? "External validation from a scholarship application or award." : "",
    item.type === "AI" ? "Workflow evidence if you use the tool in a project or class deliverable." : "",
    intelligence.payStatus === "Paid" ? "Paid experience or funding evidence." : "",
  ];
  return unique([...base, `${intelligence.organization} official-source context.`]).slice(0, 4);
}

function opportunityCompetencies(item: Opportunity) {
  const intelligence = getOpportunityIntelligence(item);
  return unique([
    ...intelligence.requiredSkills,
    ...intelligence.preferredSkills.slice(0, 3),
    intelligence.opportunityType === "Research" ? "Research reasoning" : "",
    intelligence.opportunityType === "Career" ? "Professional reliability" : "",
    intelligence.opportunityType === "Scholarship" ? "External validation" : "",
  ]).slice(0, 6);
}

export function explainOpportunityWithAdvisorBrain(input: {
  advisorProfile: AdvisorProfile;
  opportunity: Opportunity;
  progress?: StudentProgress;
  recommendations?: readonly RecommendationV1[];
}): OpportunityAdvisorExplanation {
  const intelligence = getOpportunityIntelligence(input.opportunity);
  const score = scoreOpportunityIntelligence(input.opportunity, studentContext(input.advisorProfile));
  const recommendations = input.recommendations ?? runRecommendationEngineV1({ advisorProfile: input.advisorProfile, progress: input.progress, opportunities: [input.opportunity], limit: 3 }).recommendations;
  const matching = recommendations.find((recommendation) => recommendation.relatedOpportunityId === input.opportunity.id);
  const evidenceInventory = buildEvidenceInventory({ advisorProfile: input.advisorProfile, progress: input.progress, recommendations });
  const skills = unique([...intelligence.requiredSkills, ...intelligence.preferredSkills]).slice(0, 6);
  const competencies = opportunityCompetencies(input.opportunity);
  const value = input.opportunity.estimated_value ? `$${input.opportunity.estimated_value.toLocaleString()}` : input.opportunity.metadata.valueLabel ?? input.opportunity.metadata.awardAmountLabel ?? "Unknown";
  return {
    title: input.opportunity.title,
    whyRecommended: unique([
      ...(matching?.reasons ?? []),
      ...score.reasons,
    ]).slice(0, 6),
    skillsGained: skills.length ? skills : [intelligence.category, intelligence.subcategory],
    competenciesStrengthened: competencies.length ? competencies : [intelligence.category],
    evidenceGenerated: opportunityEvidence(input.opportunity),
    resumeImpact: `${input.opportunity.organization} can become a resume signal if you complete the application, earn selection, or produce a concrete project, award, or role outcome.`,
    interviewValue: `This can support interview stories about ${competencies.slice(0, 2).join(" and ") || intelligence.category.toLowerCase()} if you can describe your actions and results.`,
    estimatedRoi: `${value} value; ${intelligence.estimatedApplicationTime} estimated application time; ${score.priority.toLowerCase()} advisor priority.`,
    evidenceUsed: unique([
      ...evidenceUsed(evidenceInventory, ["career-fit-evidence", "external-validation", "professional-reliability"]),
      `Opportunity intelligence score: ${score.score}/100`,
      `Verification status: ${intelligence.verificationStatus}`,
    ]),
    confidence: score.confidence,
    expectedImpact: matching ? priorityImpact[matching.priority] : priorityImpact[score.priority],
    tradeoffs: unique([
      intelligence.competitiveness === "Highly Competitive" ? "Selection may be difficult, so this should not be your only path." : "",
      score.breakdown.schoolEligible ? "" : "School eligibility may not match your profile; confirm the official source before investing time.",
      score.breakdown.deadlineDays !== null && score.breakdown.deadlineDays < 0 ? "The stored deadline appears passed; verify whether a new cycle opened." : "",
      "UnlockED does not administer this opportunity or guarantee selection.",
    ]),
    estimatedCompletionTime: intelligence.estimatedApplicationTime,
    knowledgeReferences: unique([
      ...(matching ? knowledgeIds(matching) : []),
      `opportunity:${input.opportunity.id}`,
      `opportunity-type:${intelligence.opportunityType}`,
    ]),
  };
}
