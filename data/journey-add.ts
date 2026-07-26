import type { AccountData } from "@/lib/account-types";
import type { StudentActivity, TrackedOpportunity } from "./student-activity";

export type JourneyAddResult = {
  duplicate: boolean;
  firstSave: boolean;
  record: TrackedOpportunity;
  activity: StudentActivity;
  tracker: Record<string, TrackedOpportunity>;
};

function existingIds(account: AccountData) {
  return new Set([
    ...(account.activity?.saved ?? []),
    ...Object.keys(account.activity?.tracked ?? {}),
    ...Object.keys(account.tracker ?? {}),
    ...(account.savedOpportunities ?? []).map((item) => item.opportunityId),
  ]);
}

export function addOpportunityToJourney(account: AccountData, opportunityId: string, occurredAt: string): JourneyAddResult {
  const ids = existingIds(account);
  const duplicate = ids.has(opportunityId);
  const existing = account.tracker?.[opportunityId] ?? account.activity?.tracked?.[opportunityId];
  const record: TrackedOpportunity = existing ?? {
    id: opportunityId,
    status: "Saved",
    savedAt: occurredAt,
    updatedAt: occurredAt,
    version: 0,
    history: [],
  };
  const tracker = {
    ...(account.activity?.tracked ?? {}),
    ...(account.tracker ?? {}),
    [opportunityId]: record,
  };
  const activity: StudentActivity = {
    viewed: account.activity?.viewed ?? [],
    saved: [...new Set([...(account.activity?.saved ?? []), opportunityId])],
    claimed: account.activity?.claimed ?? [],
    tracked: tracker,
  };
  return {
    duplicate,
    firstSave: !duplicate && ids.size === 0,
    record,
    activity,
    tracker,
  };
}
