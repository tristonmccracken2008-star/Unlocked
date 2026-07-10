import "server-only";
import fixtures from "@/data/advisor-test-profiles.json";
import { buildPreferenceConstraints, chooseCareerId, generateAdvisorOutput, normalizeOnboardingProfile, rankActions, scoreReadiness, summarizeFeedback } from "./engine";
import type { AdvisorAction, AdvisorFeedbackRecord, FeedbackType, RawAdvisorProfile } from "./types";

type AdvisorFixture = {
  id: string;
  label: string;
  rawProfile: RawAdvisorProfile;
  completedFeedback: {
    actionId: string;
    signal?: string;
    feedbackType: FeedbackType;
    reason?: string;
  }[];
};

function feedbackRecordsForFixture(fixture: AdvisorFixture): AdvisorFeedbackRecord[] {
  return fixture.completedFeedback.map((record, index) => ({
    recommendationId: `${fixture.id}-fixture-${index}`,
    studentId: String(fixture.rawProfile.studentId ?? fixture.id),
    actionId: record.actionId,
    signal: record.signal,
    feedbackType: record.feedbackType,
    reason: record.reason,
    createdAt: "2026-07-10T00:00:00.000Z",
    outcomeEvidence: null,
  }));
}

function actionSourceIds(action: AdvisorAction) {
  return action.coaching.supportingKnowledgeSourceIds;
}

export function getAdvisorReviewCases() {
  return (fixtures as AdvisorFixture[]).map((fixture) => {
    const normalizedProfile = normalizeOnboardingProfile(fixture.rawProfile);
    const careerId = chooseCareerId(normalizedProfile);
    const feedbackRecords = feedbackRecordsForFixture(fixture);
    const readiness = scoreReadiness(normalizedProfile, careerId);
    const recommendationCandidates = rankActions(readiness, normalizedProfile, 8);
    const output = generateAdvisorOutput(normalizedProfile, careerId, feedbackRecords);
    const finalActionIds = new Set(output.highestRoiActions.map((action) => action.actionId));
    const suppressedRecommendations = recommendationCandidates.filter((action) => !finalActionIds.has(action.actionId));
    return {
      id: fixture.id,
      label: fixture.label,
      rawProfile: fixture.rawProfile,
      normalizedProfile,
      careerId,
      rulesFired: readiness.gaps.map((gap) => ({
        signal: gap.signal,
        dimension: gap.dimension,
        current: gap.current,
        target: gap.target,
        impactLabel: gap.estimatedReadinessGain >= 18 ? "High impact" : gap.estimatedReadinessGain >= 10 ? "Foundational" : "Helpful",
      })),
      recommendationCandidates: recommendationCandidates.map((action) => ({
        actionId: action.actionId,
        title: action.coaching.title,
        signal: action.signal,
        priorityScore: action.priorityScore,
        sourceIds: actionSourceIds(action),
      })),
      finalRecommendation: output.highestRoiActions[0] ?? null,
      alternatives: output.highestRoiActions[0]?.coaching.alternatives ?? [],
      sourceIds: output.highestRoiActions[0]?.coaching.supportingKnowledgeSourceIds ?? [],
      confidence: output.confidence,
      confidenceExplanation: output.advisorExplanation.find((item) => item.includes("Confidence")) ?? "Confidence reflects available profile evidence, not outcome probability.",
      suppressedRecommendations: suppressedRecommendations.map((action) => ({
        actionId: action.actionId,
        signal: action.signal,
        reason: summarizeFeedback(feedbackRecords)[action.actionId]?.completed ? "Completed by fixture feedback." : "Ranked below final recommendations or suppressed by feedback.",
      })),
      opportunityMatches: output.matchedOpportunities.map((opportunity) => ({
        opportunityId: opportunity.opportunityId,
        title: opportunity.title,
        classification: opportunity.classification,
        confidence: opportunity.sourceConfidence,
        explanation: opportunity.explanation,
        deadline: opportunity.deadlineUrgency,
      })),
      feedbackEffects: buildPreferenceConstraints(feedbackRecords),
      recommendationChain: output.dependencySequence,
      output,
    };
  });
}
