import type { AccountData } from "@/lib/account-types";
import type { JourneyProgressTransition } from "./student-activity";

export const milestoneCelebrationLevels = ["meaningful", "major", "signature"] as const;
export type MilestoneCelebrationLevel = (typeof milestoneCelebrationLevels)[number];

export const milestoneCelebrationKinds = [
  "program_started",
  "application_submitted",
  "interview",
  "offer",
  "acceptance",
  "scholarship_awarded",
  "competition_result",
  "experience_completed",
] as const;
export type MilestoneCelebrationKind = (typeof milestoneCelebrationKinds)[number];

export type MilestoneCelebration = {
  eventId: string;
  kind: MilestoneCelebrationKind;
  level: MilestoneCelebrationLevel;
  first: boolean;
  particleAccent: boolean;
};

type CelebrationInput = {
  account: AccountData;
  eventId: string;
  transition: JourneyProgressTransition;
  professionalStage?: { id: string; label: string; major: boolean };
  duplicate: boolean;
  correction?: boolean;
};

function allHistory(account: AccountData) {
  const records = {
    ...(account.activity?.tracked ?? {}),
    ...(account.tracker ?? {}),
  };
  return Object.values(records).flatMap((record) => record.history ?? []);
}

function celebrationKind(
  transition: JourneyProgressTransition,
  stage: CelebrationInput["professionalStage"],
): MilestoneCelebrationKind | null {
  const stageText = `${stage?.id ?? ""} ${stage?.label ?? ""}`.toLowerCase();
  if (["start", "submit", "accept"].includes(transition) && /research[_ ]active|program[_ ]start|activated|participated/.test(stageText)) return "program_started";
  if (transition === "submit") return "application_submitted";
  if (transition === "interview") return "interview";
  if (transition === "accept" && /scholarship|award|funds/.test(stageText)) return "scholarship_awarded";
  if (transition === "accept" && /winner|competition/.test(stageText)) return "competition_result";
  if (transition === "accept" && /offer/.test(stageText)) return "offer";
  if (transition === "accept") return "acceptance";
  if (transition === "complete") return "experience_completed";
  return null;
}

function historyMatches(kind: MilestoneCelebrationKind, transition: JourneyProgressTransition, professionalStageId = "") {
  const stageText = professionalStageId.toLowerCase();
  if (kind === "program_started") return ["start", "submit", "accept"].includes(transition) && /research[_ ]active|program[_ ]start|activated|participated/.test(stageText);
  if (kind === "application_submitted") return transition === "submit";
  if (kind === "interview") return transition === "interview";
  if (kind === "scholarship_awarded") return transition === "accept" && /award|funds/.test(stageText);
  if (kind === "competition_result") return transition === "accept" && /winner|competition/.test(stageText);
  if (kind === "offer") return transition === "accept" && /offer/.test(stageText);
  if (kind === "acceptance") return transition === "accept" && !/offer|award|funds|winner|competition/.test(stageText);
  return transition === "complete";
}

export function resolveMilestoneCelebration(input: CelebrationInput): MilestoneCelebration | null {
  if (input.duplicate || input.correction || !input.eventId) return null;
  const kind = celebrationKind(input.transition, input.professionalStage);
  if (!kind) return null;
  const first = !allHistory(input.account).some((record) => historyMatches(kind, record.transition, record.professionalStageId));
  const signatureEligible = new Set<MilestoneCelebrationKind>([
    "offer",
    "acceptance",
    "scholarship_awarded",
    "competition_result",
    "experience_completed",
  ]);
  const major = signatureEligible.has(kind);
  const level: MilestoneCelebrationLevel = major ? (first ? "signature" : "major") : "meaningful";
  return {
    eventId: input.eventId,
    kind,
    level,
    first,
    particleAccent: level === "major" || level === "signature",
  };
}
