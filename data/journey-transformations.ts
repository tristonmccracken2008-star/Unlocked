import type {
  JourneyProgressTransition,
  JourneyTransitionHistoryRecord,
  OpportunityTrackerStatus,
  TrackedOpportunity,
} from "./student-activity";

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

export function accountSyncPreservesJourneyState(current: TrackedOpportunity | undefined, incoming: TrackedOpportunity) {
  if (!current) return incoming.status === "Saved" && (incoming.version ?? 0) === 0 && (incoming.history?.length ?? 0) === 0;
  return incoming.status === current.status
    && (incoming.version ?? 0) === (current.version ?? 0)
    && incoming.pausedFrom === current.pausedFrom
    && JSON.stringify(incoming.history ?? []) === JSON.stringify(current.history ?? []);
}
