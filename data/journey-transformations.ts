import type {
  JourneyMilestoneDetails,
  JourneyProgressTransition,
  JourneyTransitionHistoryRecord,
  OpportunityTrackerStatus,
  TrackedOpportunity,
} from "./student-activity";
import { getJourneyProfessionalActions, resolveJourneyProfessionalStage, type JourneyProfessionalWorkflow } from "./journey-professional";

export type JourneyTransitionAction = {
  transition: JourneyProgressTransition;
  label: string;
  resultingStatus: OpportunityTrackerStatus;
  primary: boolean;
  destructive?: boolean;
};

export type JourneyTransitionRequest = {
  transition: JourneyProgressTransition;
  expectedStatus: OpportunityTrackerStatus;
  expectedVersion: number;
  idempotencyKey: string;
  occurredAt: string;
};

export type JourneyTransitionResult = {
  record: TrackedOpportunity;
  historyRecord: JourneyTransitionHistoryRecord;
  duplicate: boolean;
};

export type JourneyUndoRequest = {
  eventId: string;
  expectedStatus: OpportunityTrackerStatus;
  expectedVersion: number;
  idempotencyKey: string;
  occurredAt: string;
};

export type JourneyProfessionalUpdateRequest = {
  targetStageId: string;
  expectedStatus: OpportunityTrackerStatus;
  expectedVersion: number;
  idempotencyKey: string;
  occurredAt: string;
  details?: JourneyMilestoneDetails;
};

export class JourneyTransitionError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_transition" | "stale_state" | "invalid_request",
  ) {
    super(message);
    this.name = "JourneyTransitionError";
  }
}

const forwardActions: Partial<Record<OpportunityTrackerStatus, JourneyTransitionAction>> = {
  Saved: { transition: "choose", label: "Choose this opportunity", resultingStatus: "Interested", primary: true },
  Interested: { transition: "start", label: "Start this application", resultingStatus: "Applying", primary: true },
  Applying: { transition: "submit", label: "Mark as submitted", resultingStatus: "Submitted", primary: true },
  Submitted: { transition: "interview", label: "Record an interview", resultingStatus: "Interview", primary: true },
  Interview: { transition: "accept", label: "Record acceptance", resultingStatus: "Accepted", primary: true },
  Accepted: { transition: "complete", label: "Complete this experience", resultingStatus: "Completed", primary: true },
};

const pausable = new Set<OpportunityTrackerStatus>(["Interested", "Applying", "Submitted", "Interview"]);
const closable = new Set<OpportunityTrackerStatus>(["Saved", "Interested", "Applying", "Submitted", "Interview", "Paused"]);

export function getJourneyTransitionActions(record: TrackedOpportunity): JourneyTransitionAction[] {
  const actions: JourneyTransitionAction[] = [];
  const forward = forwardActions[record.status];
  if (forward) actions.push(forward);
  if (record.status === "Paused" && record.pausedFrom && record.pausedFrom !== "Paused") {
    actions.push({ transition: "resume", label: "Resume this direction", resultingStatus: record.pausedFrom, primary: true });
  }
  if (pausable.has(record.status)) actions.push({ transition: "pause", label: "Pause this direction", resultingStatus: "Paused", primary: false });
  if (closable.has(record.status)) actions.push({ transition: "close", label: "Close this opportunity", resultingStatus: "Rejected", primary: false, destructive: true });
  return actions;
}

export function getPrimaryJourneyTransition(record: TrackedOpportunity) {
  return getJourneyTransitionActions(record).find((action) => action.primary);
}

export function transitionForTargetStatus(record: TrackedOpportunity, status: OpportunityTrackerStatus) {
  return getJourneyTransitionActions(record).find((action) => action.resultingStatus === status)?.transition;
}

function validIdempotencyKey(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value);
}

export function applyJourneyTransition(record: TrackedOpportunity, request: JourneyTransitionRequest): JourneyTransitionResult {
  if (!validIdempotencyKey(request.idempotencyKey) || !Number.isInteger(request.expectedVersion) || request.expectedVersion < 0 || Number.isNaN(Date.parse(request.occurredAt))) {
    throw new JourneyTransitionError("The transition request is malformed.", "invalid_request");
  }
  const history = record.history ?? [];
  const existing = history.find((item) => item.id === request.idempotencyKey);
  if (existing) return { record, historyRecord: existing, duplicate: true };
  const currentVersion = record.version ?? 0;
  if (record.status !== request.expectedStatus || currentVersion !== request.expectedVersion) {
    throw new JourneyTransitionError("The Journey changed before this update was saved.", "stale_state");
  }
  const action = getJourneyTransitionActions(record).find((item) => item.transition === request.transition);
  if (!action) throw new JourneyTransitionError(`The ${request.transition} transition is not valid from ${record.status}.`, "invalid_transition");
  const historyRecord: JourneyTransitionHistoryRecord = {
    id: request.idempotencyKey,
    transition: request.transition,
    priorStatus: record.status,
    resultingStatus: action.resultingStatus,
    occurredAt: request.occurredAt,
  };
  const next: TrackedOpportunity = {
    ...record,
    status: action.resultingStatus,
    updatedAt: request.occurredAt,
    version: currentVersion + 1,
    pausedFrom: request.transition === "pause" ? record.status : request.transition === "resume" ? undefined : record.pausedFrom,
    history: [...history, historyRecord].slice(-100),
  };
  return { record: next, historyRecord, duplicate: false };
}

export function applyJourneyProfessionalUpdate(
  record: TrackedOpportunity,
  workflow: JourneyProfessionalWorkflow,
  request: JourneyProfessionalUpdateRequest,
): JourneyTransitionResult {
  if (!validIdempotencyKey(request.idempotencyKey) || !Number.isInteger(request.expectedVersion) || request.expectedVersion < 0 || Number.isNaN(Date.parse(request.occurredAt))) {
    throw new JourneyTransitionError("The Journey update is malformed.", "invalid_request");
  }
  const history = record.history ?? [];
  const existing = history.find((item) => item.id === request.idempotencyKey);
  if (existing) return { record, historyRecord: existing, duplicate: true };
  const currentVersion = record.version ?? 0;
  if (record.status !== request.expectedStatus || currentVersion !== request.expectedVersion) {
    throw new JourneyTransitionError("The Journey changed before this update was saved.", "stale_state");
  }
  const action = getJourneyProfessionalActions(record, workflow).find((item) => item.id === request.targetStageId);
  if (!action) throw new JourneyTransitionError("That Journey stage is not available from the current stage.", "invalid_transition");
  const currentStage = resolveJourneyProfessionalStage(record, workflow);
  const targetStageId = action.id === "paused" ? "paused" : action.stage?.id ?? currentStage.id;
  const historyRecord: JourneyTransitionHistoryRecord = {
    id: request.idempotencyKey,
    transition: action.transition,
    priorStatus: record.status,
    resultingStatus: action.resultingStatus,
    occurredAt: request.occurredAt,
    professionalStageId: targetStageId,
    details: request.details,
  };
  const next: TrackedOpportunity = {
    ...record,
    status: action.resultingStatus,
    updatedAt: request.occurredAt,
    version: currentVersion + 1,
    professionalStageId: action.id === "paused" ? currentStage.id : action.stage?.id ?? currentStage.id,
    pausedFrom: action.transition === "pause" ? record.status : action.transition === "resume" ? undefined : record.pausedFrom,
    pausedFromProfessionalStageId: action.transition === "pause" ? currentStage.id : action.transition === "resume" ? undefined : record.pausedFromProfessionalStageId,
    history: [...history, historyRecord].slice(-100),
  };
  return { record: next, historyRecord, duplicate: false };
}

export function applyJourneyUndo(record: TrackedOpportunity, request: JourneyUndoRequest) {
  if (!validIdempotencyKey(request.idempotencyKey) || !validIdempotencyKey(request.eventId) || !Number.isInteger(request.expectedVersion) || request.expectedVersion < 0 || Number.isNaN(Date.parse(request.occurredAt))) {
    throw new JourneyTransitionError("The Journey recovery request is malformed.", "invalid_request");
  }
  if ((record.undoneTransitionIds ?? []).includes(request.idempotencyKey)) return { record, duplicate: true };
  if (record.status !== request.expectedStatus || (record.version ?? 0) !== request.expectedVersion) throw new JourneyTransitionError("The Journey changed before Undo could be applied.", "stale_state");
  const history = [...(record.history ?? [])];
  const latest = history.at(-1);
  if (!latest || latest.id !== request.eventId) throw new JourneyTransitionError("Only the latest Journey update can be undone.", "stale_state");
  history.pop();
  const remainingProfessional = [...history].reverse().find((item) => item.professionalStageId && item.professionalStageId !== "paused");
  return {
    duplicate: false,
    record: {
      ...record,
      status: latest.priorStatus,
      updatedAt: request.occurredAt,
      version: (record.version ?? 0) + 1,
      history,
      professionalStageId: latest.professionalStageId && latest.professionalStageId !== "paused" ? remainingProfessional?.professionalStageId : record.professionalStageId,
      pausedFrom: latest.priorStatus === "Paused" ? record.pausedFrom : undefined,
      pausedFromProfessionalStageId: latest.priorStatus === "Paused" ? record.pausedFromProfessionalStageId : undefined,
      undoneTransitionIds: [...new Set([...(record.undoneTransitionIds ?? []), request.idempotencyKey])].slice(-20),
    } satisfies TrackedOpportunity,
  };
}

export function accountSyncPreservesJourneyState(current: TrackedOpportunity | undefined, incoming: TrackedOpportunity) {
  if (!current) return incoming.status === "Saved" && (incoming.version ?? 0) === 0 && (incoming.history?.length ?? 0) === 0;
  return incoming.status === current.status
    && (incoming.version ?? 0) === (current.version ?? 0)
    && incoming.pausedFrom === current.pausedFrom
    && incoming.professionalStageId === current.professionalStageId
    && incoming.pausedFromProfessionalStageId === current.pausedFromProfessionalStageId
    && JSON.stringify(incoming.undoneTransitionIds ?? []) === JSON.stringify(current.undoneTransitionIds ?? [])
    && JSON.stringify(incoming.history ?? []) === JSON.stringify(current.history ?? []);
}
