import "server-only";

import type { AccountData, AuthUser } from "./account-types";
import { mergeAccountData, readAccountData, withSecurityLock } from "./auth-store";
import { listPublishedOpportunitiesByIds } from "./content-store";
import { buildJourneyEditorialProjection } from "./journey-editorial";
import { applyJourneyProfessionalUpdate, applyJourneyTransition, JourneyTransitionError, type JourneyTransitionRequest } from "@/data/journey-transformations";
import { getJourneyProfessionalWorkflow, professionalStageById, resolveJourneyProfessionalStage } from "@/data/journey-professional";
import { createOpenLineMotionPlan, type OpenLineMotionPlan } from "@/data/open-line";
import type { JourneyMilestoneDetails, JourneyProgressTransition, OpportunityTrackerStatus, TrackedOpportunity } from "@/data/student-activity";
import { buildJourneyTimelineModel } from "./journey-timeline";

export type JourneyTransitionMutation = {
  opportunityId: string;
  transition?: JourneyProgressTransition;
  professionalStageId?: string;
  details?: JourneyMilestoneDetails;
  expectedStatus: OpportunityTrackerStatus;
  expectedVersion: number;
  idempotencyKey: string;
};

export type JourneyTransformationResponse = {
  ok: true;
  duplicate: boolean;
  transition: JourneyProgressTransition;
  professionalStage?: { id: string; label: string; major: boolean };
  stageChange?: { before: string; after: string };
  record: TrackedOpportunity;
  pathEventCreated: string | null;
  narrative: {
    title: string;
    accomplishment: string;
    whatChanged: string;
    storyType: string;
  };
  motionPlan: OpenLineMotionPlan;
  geometries: ReturnType<typeof buildJourneyEditorialProjection>["model"]["geometries"];
  horizonGeometries: ReturnType<typeof buildJourneyEditorialProjection>["model"]["horizon"]["geometries"];
  waypoint: {
    before: string | null;
    after: string | null;
  };
  horizon: {
    added: string[];
    removed: string[];
    preserved: string[];
  };
  summaryChanges: Array<{ id: string; label: string; before: number; after: number }>;
};

function trackedRecord(account: AccountData, opportunityId: string) {
  return account.tracker?.[opportunityId] ?? account.activity?.tracked?.[opportunityId];
}

function nextOccurredAt(previous: string) {
  const now = Date.now();
  const prior = Date.parse(previous);
  return new Date(Number.isFinite(prior) ? Math.max(now, prior + 1) : now).toISOString();
}

function trackedIds(account: AccountData) {
  return [...new Set([
    ...Object.keys(account.tracker ?? {}),
    ...Object.keys(account.activity?.tracked ?? {}),
    ...(account.activity?.saved ?? []),
    ...(account.savedOpportunities ?? []).map((record) => record.opportunityId),
  ])];
}

function historyMoments(model: ReturnType<typeof buildJourneyEditorialProjection>["model"]) {
  return [...model.history.earlierChapters, ...model.history.recentChapters].flatMap((chapter) => chapter.moments);
}

function horizonDelta(before: ReturnType<typeof buildJourneyEditorialProjection>["model"], after: ReturnType<typeof buildJourneyEditorialProjection>["model"]) {
  const previous = new Set(before.horizon.items.map((item) => item.id));
  const current = new Set(after.horizon.items.map((item) => item.id));
  return {
    added: [...current].filter((id) => !previous.has(id)),
    removed: [...previous].filter((id) => !current.has(id)),
    preserved: [...current].filter((id) => previous.has(id)),
  };
}

export async function transformJourneyProgress(user: Pick<AuthUser, "id" | "name">, mutation: JourneyTransitionMutation): Promise<JourneyTransformationResponse> {
  const startedAt = performance.now();
  return await withSecurityLock("journey-transition", user.id, async () => {
    const previousAccount = await readAccountData(user.id);
    const previousRecord = trackedRecord(previousAccount, mutation.opportunityId);
    if (!previousRecord) throw new JourneyTransitionError("This opportunity is not part of your Journey.", "invalid_request");
    const ids = trackedIds(previousAccount);
    const opportunities = await listPublishedOpportunitiesByIds(ids);
    const opportunity = opportunities.find((item) => item.id === mutation.opportunityId);
    if (!opportunity) throw new JourneyTransitionError("This opportunity is no longer available.", "invalid_request");
    const occurredAt = nextOccurredAt(previousRecord.updatedAt);
    const workflow = getJourneyProfessionalWorkflow(opportunity);
    const applied = mutation.professionalStageId
      ? applyJourneyProfessionalUpdate(previousRecord, workflow, {
        targetStageId: mutation.professionalStageId,
        expectedStatus: mutation.expectedStatus,
        expectedVersion: mutation.expectedVersion,
        idempotencyKey: mutation.idempotencyKey,
        occurredAt,
        details: mutation.details ?? { source: "student_reported" },
      })
      : applyJourneyTransition(previousRecord, {
        transition: mutation.transition!,
        expectedStatus: mutation.expectedStatus,
        expectedVersion: mutation.expectedVersion,
        idempotencyKey: mutation.idempotencyKey,
        occurredAt,
      } satisfies JourneyTransitionRequest);
    const resolvedTransition = applied.historyRecord.transition;
    const professionalStage = mutation.professionalStageId ? professionalStageById(workflow, mutation.professionalStageId) : undefined;
    const previousProfessionalStage = resolveJourneyProfessionalStage(previousRecord, workflow);
    const resultingStageLabel = mutation.professionalStageId === "paused"
      ? "Paused"
      : mutation.professionalStageId === "resume"
        ? resolveJourneyProfessionalStage(applied.record, workflow).label
        : professionalStage?.label;
    const previousProjection = buildJourneyEditorialProjection({ user, account: previousAccount, opportunities });
    const previousTimeline = buildJourneyTimelineModel({ user, account: previousAccount, opportunities });

    let persistedAccount = previousAccount;
    if (!applied.duplicate) {
      const tracked = { ...(previousAccount.activity?.tracked ?? {}), ...(previousAccount.tracker ?? {}), [mutation.opportunityId]: applied.record };
      const activity = {
        viewed: previousAccount.activity?.viewed ?? [],
        saved: [...new Set([...(previousAccount.activity?.saved ?? []), mutation.opportunityId])],
        claimed: previousAccount.activity?.claimed ?? [],
        tracked,
      };
      persistedAccount = await mergeAccountData(user.id, { tracker: tracked, activity });
    }
    const persistedRecord = trackedRecord(persistedAccount, mutation.opportunityId);
    if (!persistedRecord || persistedRecord.version !== applied.record.version || persistedRecord.status !== applied.record.status) {
      throw new JourneyTransitionError("The Journey changed before this update was saved.", "stale_state");
    }
    const currentProjection = buildJourneyEditorialProjection({ user, account: persistedAccount, opportunities });
    const currentTimeline = buildJourneyTimelineModel({ user, account: persistedAccount, opportunities });
    const previousEventIds = new Set(previousProjection.pathprint.events.map((event) => event.id));
    const pathEvent = currentProjection.pathprint.events.find((event) => !previousEventIds.has(event.id) && event.opportunityId === mutation.opportunityId) ?? null;
    const previousMomentIds = new Set(historyMoments(previousProjection.model).map((moment) => moment.id));
    const currentMoments = historyMoments(currentProjection.model);
    const freshMoment = currentMoments.find((item) => !previousMomentIds.has(item.id));
    const moment = freshMoment ?? (pathEvent ? undefined : currentMoments.at(-1));
    if (!moment && !pathEvent) throw new Error("The canonical narrative did not resolve a transition event.");
    const motionPlan = createOpenLineMotionPlan(
      previousProjection.model.geometries.desktop.geometry,
      currentProjection.model.geometries.desktop.geometry,
      { cause: "meaningful_update", preference: "full" },
    );
    const result: JourneyTransformationResponse = {
      ok: true,
      duplicate: applied.duplicate,
      transition: resolvedTransition,
      professionalStage: professionalStage ? { id: professionalStage.id, label: professionalStage.label, major: professionalStage.major } : undefined,
      stageChange: resultingStageLabel ? { before: previousRecord.status === "Paused" ? "Paused" : previousProfessionalStage.label, after: resultingStageLabel } : undefined,
      record: persistedRecord,
      pathEventCreated: pathEvent?.id ?? null,
      narrative: {
        title: professionalStage?.milestoneTitle ?? moment?.title ?? pathEvent!.title,
        accomplishment: professionalStage?.description ?? moment?.body ?? pathEvent!.narrative,
        whatChanged: professionalStage?.description ?? pathEvent?.whatChanged ?? moment!.detail.whyItMattered,
        storyType: moment?.storyType ?? pathEvent!.kind,
      },
      motionPlan,
      geometries: currentProjection.model.geometries,
      horizonGeometries: currentProjection.model.horizon.geometries,
      waypoint: {
        before: previousProjection.model.waypoint?.title ?? null,
        after: currentProjection.model.waypoint?.title ?? null,
      },
      horizon: horizonDelta(previousProjection.model, currentProjection.model),
      summaryChanges: [...new Set([...previousTimeline.summary.map((item) => item.id), ...currentTimeline.summary.map((item) => item.id)])].flatMap((id) => {
        const previous = previousTimeline.summary.find((item) => item.id === id);
        const current = currentTimeline.summary.find((item) => item.id === id);
        const before = previous?.value ?? 0;
        const after = current?.value ?? 0;
        return after !== before ? [{ id, label: current?.label ?? previous!.label, before, after }] : [];
      }),
    };
    if (process.env.NODE_ENV !== "production" && process.env.OPEN_LINE_TRANSITION_DIAGNOSTICS === "1") {
      console.info("[UnlockED Journey transition]", {
        transition: resolvedTransition,
        priorStatus: previousRecord.status,
        resultingStatus: persistedRecord.status,
        serverResult: "accepted",
        pathEventCreated: Boolean(result.pathEventCreated),
        motionPlan: result.motionPlan.transitionKind,
        waypointChanged: result.waypoint.before !== result.waypoint.after,
        horizonAdded: result.horizon.added.length,
        horizonRemoved: result.horizon.removed.length,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
    return result;
  });
}
