import type { AccountData } from "./account-types";

export const guidanceIds = [
  "journey_intro",
  "journey_calendar",
  "journey_application_workspace",
  "journey_card",
  "journey_changelog",
  "notifications_intro",
] as const;

export type GuidanceId = (typeof guidanceIds)[number];
export type GuidanceStatus = "completed" | "dismissed";

export type GuidanceRecord = {
  status: GuidanceStatus;
  guideVersion: number;
  updatedAt: string;
};

export type GuidanceState = Partial<Record<GuidanceId, GuidanceRecord>>;

export const guidanceVersions: Record<GuidanceId, number> = {
  journey_intro: 1,
  journey_calendar: 1,
  journey_application_workspace: 1,
  journey_card: 1,
  journey_changelog: 1,
  notifications_intro: 1,
};

export function isGuidanceId(value: unknown): value is GuidanceId {
  return typeof value === "string" && guidanceIds.includes(value as GuidanceId);
}

export function normalizeGuidanceState(value: GuidanceState | null | undefined): GuidanceState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const state: GuidanceState = {};
  for (const id of guidanceIds) {
    const record = value[id];
    if (!record || !["completed", "dismissed"].includes(record.status)) continue;
    state[id] = {
      status: record.status,
      guideVersion: Number.isInteger(record.guideVersion) && record.guideVersion > 0 ? record.guideVersion : 1,
      updatedAt: Number.isFinite(Date.parse(record.updatedAt)) ? record.updatedAt : new Date(0).toISOString(),
    };
  }
  return state;
}

export function guidanceHasBeenSeen(state: GuidanceState | null | undefined, id: GuidanceId) {
  const record = state?.[id];
  return Boolean(record && record.guideVersion >= guidanceVersions[id]);
}

export function journeyGuidanceEligibility(account: AccountData, options: {
  hasRecords: boolean;
  hasCalendarContent: boolean;
  hasApplicationWorkspace: boolean;
  hasJourneyCard: boolean;
  hasOpportunityChange: boolean;
}) {
  return {
    journey_intro: Boolean(account.onboardingComplete),
    journey_calendar: options.hasCalendarContent,
    journey_application_workspace: options.hasApplicationWorkspace,
    journey_card: options.hasJourneyCard,
    journey_changelog: options.hasOpportunityChange,
    hasRecords: options.hasRecords,
  } as const;
}
