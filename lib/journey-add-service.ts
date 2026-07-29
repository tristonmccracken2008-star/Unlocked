import "server-only";

import { addOpportunityToJourney } from "@/data/journey-add";
import { applyJourneyProfessionalUpdate } from "@/data/journey-transformations";
import { getJourneyProfessionalWorkflow } from "@/data/journey-professional";
import type { JourneyMilestoneDetails, TrackedOpportunity } from "@/data/student-activity";
import type { AuthUser } from "./account-types";
import { accountHasCompletedOnboarding, mergeAccountData, readAccountData, withSecurityLock } from "./auth-store";
import { listPublishedOpportunitiesByIds } from "./content-store";

export type JourneyAddMutation = {
  opportunityId: string;
  idempotencyKey: string;
  source: "discover" | "for_you" | "opportunity" | "journey";
  initialStage: "saved" | "preparing" | "applied";
  details?: JourneyMilestoneDetails;
};

export async function addJourneyOpportunity(user: Pick<AuthUser, "id">, mutation: JourneyAddMutation) {
  return await withSecurityLock("journey-add", user.id, async () => {
    const account = await readAccountData(user.id);
    if (!accountHasCompletedOnboarding(account)) {
      const error = new Error("Complete onboarding before adding an opportunity.");
      error.name = "OnboardingRequiredError";
      throw error;
    }
    const published = await listPublishedOpportunitiesByIds([mutation.opportunityId]);
    const opportunity = published.find((item) => item.id === mutation.opportunityId);
    if (!opportunity) {
      const error = new Error("This opportunity is no longer available.");
      error.name = "OpportunityUnavailableError";
      throw error;
    }
    const addition = addOpportunityToJourney(account, mutation.opportunityId, new Date().toISOString());
    let record = addition.record;
    if (!addition.duplicate) {
      const workflow = getJourneyProfessionalWorkflow(opportunity);
      const requestedStage = mutation.initialStage === "preparing"
        ? workflow.stages.find((stage) => stage.status === "Applying")
        : mutation.initialStage === "applied"
          ? workflow.stages.find((stage) => stage.status === "Submitted")
          : undefined;
      if (mutation.initialStage !== "saved" && !requestedStage) {
        const error = new Error("That starting stage is not available for this opportunity.");
        error.name = "InvalidInitialJourneyStageError";
        throw error;
      }
      if (requestedStage) {
        record = applyJourneyProfessionalUpdate(record, workflow, {
          targetStageId: requestedStage.id,
          expectedStatus: "Saved",
          expectedVersion: 0,
          idempotencyKey: mutation.idempotencyKey,
          occurredAt: record.updatedAt,
          details: mutation.details ?? { source: "student_reported" },
        }).record;
      } else if (mutation.details) {
        record = {
          ...record,
          version: 1,
          history: [{
            id: mutation.idempotencyKey,
            transition: "choose",
            priorStatus: "Saved",
            resultingStatus: "Saved",
            occurredAt: record.updatedAt,
            professionalStageId: "saved",
            details: mutation.details,
          }],
        } satisfies TrackedOpportunity;
      }
      addition.tracker[mutation.opportunityId] = record;
      addition.activity.tracked = addition.tracker;
    }
    const persisted = await mergeAccountData(user.id, {
      activity: addition.activity,
      tracker: addition.tracker,
      savedOpportunities: [{
        opportunityId: mutation.opportunityId,
        savedAt: record.savedAt,
      }],
    });
    const persistedRecord = persisted.tracker?.[mutation.opportunityId] ?? persisted.activity?.tracked?.[mutation.opportunityId];
    if (!persistedRecord) throw new Error("The opportunity was not present after the Journey update.");
    return {
      ok: true as const,
      duplicate: addition.duplicate,
      firstSave: addition.firstSave,
      record: persistedRecord,
      savedCount: persisted.savedOpportunities.length,
      source: mutation.source,
    };
  });
}
