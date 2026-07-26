import type { AdvisorFeedbackRecord } from "./types";

function feedbackKey(record: Pick<AdvisorFeedbackRecord, "recommendationId" | "actionId">) {
  return `${record.recommendationId}\u0000${record.actionId}`;
}

/**
 * Feedback is append-only for auditability. An undo record removes the most
 * recent effective preference for the same recommendation without deleting
 * history or affecting another account.
 */
export function activeRecommendationFeedback(records: readonly AdvisorFeedbackRecord[]) {
  const stacks = new Map<string, AdvisorFeedbackRecord[]>();
  records.forEach((record) => {
    const key = feedbackKey(record);
    const stack = stacks.get(key) ?? [];
    if (record.feedbackType === "undo") stack.pop();
    else stack.push(record);
    stacks.set(key, stack);
  });
  return [...stacks.values()].flatMap((stack) => stack.at(-1) ?? []);
}

export function findFeedbackRequest(
  records: readonly AdvisorFeedbackRecord[],
  requestId: string | undefined,
) {
  if (!requestId) return null;
  return records.find((record) => record.requestId === requestId) ?? null;
}

export function canUndoRecommendationFeedback(
  records: readonly AdvisorFeedbackRecord[],
  record: Pick<AdvisorFeedbackRecord, "recommendationId" | "actionId">,
) {
  return activeRecommendationFeedback(records).some((candidate) => feedbackKey(candidate) === feedbackKey(record));
}
