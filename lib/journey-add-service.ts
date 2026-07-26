import "server-only";

import { addOpportunityToJourney } from "@/data/journey-add";
import type { AuthUser } from "./account-types";
import { accountHasCompletedOnboarding, mergeAccountData, readAccountData, withSecurityLock } from "./auth-store";
import { listPublishedOpportunitiesByIds } from "./content-store";

export type JourneyAddMutation = {
  opportunityId: string;
  idempotencyKey: string;
  source: "discover" | "for_you" | "opportunity";
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
    if (!published.some((opportunity) => opportunity.id === mutation.opportunityId)) {
      const error = new Error("This opportunity is no longer available.");
      error.name = "OpportunityUnavailableError";
      throw error;
    }
    const addition = addOpportunityToJourney(account, mutation.opportunityId, new Date().toISOString());
    const persisted = await mergeAccountData(user.id, {
      activity: addition.activity,
      tracker: addition.tracker,
      savedOpportunities: [{
        opportunityId: mutation.opportunityId,
        savedAt: addition.record.savedAt,
      }],
    });
    const record = persisted.tracker?.[mutation.opportunityId] ?? persisted.activity?.tracked?.[mutation.opportunityId];
    if (!record) throw new Error("The opportunity was not present after the Journey update.");
    return {
      ok: true as const,
      duplicate: addition.duplicate,
      firstSave: addition.firstSave,
      record,
      savedCount: persisted.savedOpportunities.length,
      source: mutation.source,
    };
  });
}
