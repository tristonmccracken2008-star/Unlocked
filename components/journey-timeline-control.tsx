"use client";

import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent } from "@/data/account-sync";
import { readStudentActivity, replaceStudentActivity, type JourneyMilestoneDocumentReference, type JourneyProgressTransition, type TrackedOpportunity } from "@/data/student-activity";
import type { MilestoneCelebration } from "@/data/milestone-celebrations";
import type { JourneyProfessionalAction } from "@/data/journey-professional";
import type { JourneyTimelineControl } from "@/lib/journey-timeline";
import { CheckCircleIcon, CloseIcon } from "@/components/icons";
import { ResolvedOrganizationMark } from "@/components/organization-logo";
import styles from "./journey-timeline.module.css";
import { DelayedPendingLabel } from "./delayed-pending-label";
import { useUndoRecovery } from "./undo-recovery";

const MilestoneCelebrationEffect = lazy(() => import("./milestone-celebration-effect"));
const celebrationStorageKey = "unlocked-shown-milestone-celebrations";

type TransitionResponse = {
  ok: true;
  duplicate: boolean;
  transition: JourneyProgressTransition;
  record: TrackedOpportunity;
  milestoneEventId: string;
  celebration: MilestoneCelebration | null;
  professionalStage?: { id: string; label: string; major: boolean };
  stageChange?: { before: string; after: string };
  narrative: { title: string; accomplishment: string; whatChanged: string; storyType: string };
  summaryChanges: Array<{ id: string; label: string; before: number; after: number }>;
};

class CelebrationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function claimCelebration(eventId: string) {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(celebrationStorageKey) ?? "[]");
    const shown = new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    if (shown.has(eventId)) return false;
    shown.add(eventId);
    localStorage.setItem(celebrationStorageKey, JSON.stringify([...shown].slice(-100)));
    return true;
  } catch {
    try {
      localStorage.setItem(celebrationStorageKey, JSON.stringify([eventId]));
    } catch {
      // Storage can be unavailable in strict privacy modes; the confirmed update still succeeds.
    }
    return true;
  }
}

function messageForStatus(status: number, fallback?: string) {
  if (status === 401) return "Your session ended. Sign in again before updating your Journey.";
  if (status === 403) return "This request could not be verified. Refresh and try again.";
  if (status === 409) return "Your Journey changed in another tab. Refreshing the latest version.";
  if (status === 423) return "Another Journey update is still saving. Try again in a moment.";
  if (status === 422) return fallback || "That milestone is not available from the current stage.";
  return fallback || "We couldn’t save this milestone. Your previous stage is unchanged.";
}

function documentsFrom(files: FileList | null): JourneyMilestoneDocumentReference[] {
  return [...(files ? Array.from(files) : [])].slice(0, 3).map((file) => ({
    id: `document:${crypto.randomUUID()}`,
    name: file.name.slice(0, 120),
    mimeType: file.type.slice(0, 100) || undefined,
    size: Math.min(file.size, 25_000_000),
    stored: false,
  }));
}

function studentActionLabel(action: JourneyProfessionalAction) {
  if (action.correction || action.id === "resume" || action.id === "paused" || action.id === "archived") return action.label;
  const stage = action.stage?.label.toLowerCase() ?? "";
  if (stage.includes("application submitted")) return "I submitted my application";
  if (stage.includes("interview")) return stage.includes("final") ? "I reached the final interview" : "I got an interview";
  if (stage.includes("offer received")) return "I received an offer";
  if (stage.includes("offer accepted")) return "I accepted the offer";
  if (stage.includes("position accepted") || stage === "accepted") return "I accepted the opportunity";
  if (stage.includes("finalist")) return "I became a finalist";
  if (stage.includes("awarded")) return "I received the scholarship";
  if (stage.includes("completed") || stage.includes("funds received")) return "I completed this step";
  if (action.transition === "start") return "I started working on this";
  if (action.transition === "submit") return "I submitted this";
  return action.label;
}

export function JourneyTimelineControl({ control, compactLabel = "Update Journey", showFollowUp = true }: { control: JourneyTimelineControl; compactLabel?: string; showFollowUp?: boolean }) {
  const router = useRouter();
  const { offerUndo } = useUndoRecovery();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const alternateStagesRef = useRef<HTMLDetailsElement>(null);
  const milestoneDetailsRef = useRef<HTMLDetailsElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const rowHighlightTimerRef = useRef<number | null>(null);
  const [selectedId, setSelectedId] = useState(control.actions[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState(control.details?.notes ?? "");
  const [milestoneDate, setMilestoneDate] = useState(control.details?.milestoneDate ?? "");
  const [reminderAt, setReminderAt] = useState(control.details?.reminderAt ? control.details.reminderAt.slice(0, 16) : "");
  const [reminderText, setReminderText] = useState(control.details?.reminderText ?? "");
  const [documents, setDocuments] = useState<JourneyMilestoneDocumentReference[]>(control.details?.documents ?? []);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TransitionResponse | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [followUpDismissed, setFollowUpDismissed] = useState(false);
  const currentIndex = control.workflow.stages.findIndex((stage) => stage.id === control.currentStageId);
  const selected = useMemo(() => control.actions.find((action) => action.id === selectedId) ?? control.actions[0], [control.actions, selectedId]);
  const alternateActions = control.actions.slice(1);
  const selectedStageText = `${selected?.id ?? ""} ${selected?.stage?.label ?? ""}`;
  const dateLabel = /interview/i.test(selectedStageText) ? "Interview date"
    : /offer|award|winner/i.test(selectedStageText) ? "Offer or award date"
      : /accept/i.test(selectedStageText) ? "Acceptance date"
        : /complete|funds|participated/i.test(selectedStageText) ? "Completion date"
          : /submit|application/i.test(selectedStageText) ? "Application date"
            : "Relevant date";
  const supportsDocuments = /prepar|submit|application|interview/i.test(selectedStageText);
  const initialActionId = control.actions[0]?.id ?? "";
  const substantialDraftDirty = notes !== (control.details?.notes ?? "")
    || JSON.stringify(documents) !== JSON.stringify(control.details?.documents ?? []);

  function resetDraft() {
    setSelectedId(initialActionId);
    setNotes(control.details?.notes ?? "");
    setMilestoneDate(control.details?.milestoneDate ?? "");
    setReminderAt(control.details?.reminderAt ? control.details.reminderAt.slice(0, 16) : "");
    setReminderText(control.details?.reminderText ?? "");
    setDocuments(control.details?.documents ?? []);
    setError("");
    setResult(null);
    setCelebrationVisible(false);
    if (alternateStagesRef.current) alternateStagesRef.current.open = false;
    if (milestoneDetailsRef.current) milestoneDetailsRef.current.open = false;
  }

  useEffect(() => {
    const accountChanged = () => {
      controllerRef.current?.abort("account-changed");
      dialogRef.current?.close();
      setPending(false);
      resetDraft();
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => {
      controllerRef.current?.abort("journey-control-unmounted");
      if (rowHighlightTimerRef.current) window.clearTimeout(rowHighlightTimerRef.current);
      window.removeEventListener(accountSessionEvent, accountChanged);
    };
  }, []);

  function open(actionId = control.actions[0]?.id) {
    resetDraft();
    if (actionId) setSelectedId(actionId);
    dialogRef.current?.showModal();
  }

  function close(force = false) {
    if (pending) return;
    if (!force && !result && substantialDraftDirty && !window.confirm("Close without saving these Journey changes?")) return;
    const refresh = Boolean(result);
    dialogRef.current?.close();
    resetDraft();
    triggerRef.current?.focus();
    if (refresh) router.refresh();
  }

  async function update(action: JourneyProfessionalAction) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 8_000);
    try {
      const response = await authenticatedFetch("/api/journey/transition", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          opportunityId: control.opportunityId,
          professionalStageId: action.id,
          expectedStatus: control.status,
          expectedVersion: control.version,
          idempotencyKey: `journey:${crypto.randomUUID()}`,
          details: {
            notes: notes.trim() || undefined,
            milestoneDate: milestoneDate || undefined,
            reminderAt: reminderAt ? new Date(reminderAt).toISOString() : undefined,
            reminderText: reminderAt ? reminderText.trim() || undefined : undefined,
            documents,
          },
        }),
      });
      const body = await response.json().catch(() => null) as (TransitionResponse & { error?: string }) | null;
      if (!response.ok || !body?.ok || !body.record) {
        setError(messageForStatus(response.status, body?.error));
        if (response.status === 409) window.setTimeout(() => router.refresh(), 600);
        return;
      }
      setResult(body);
      const undoRequestId = `journey-undo:${crypto.randomUUID()}`;
      if (!body.duplicate) offerUndo({
        message: body.stageChange ? `Marked as ${body.stageChange.after}.` : "Journey updated.",
        restoredMessage: body.stageChange ? `Restored to ${body.stageChange.before}.` : "Journey update restored.",
        undo: async () => {
          const undoResponse = await authenticatedFetch("/api/journey/transition", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "undo", opportunityId: control.opportunityId, eventId: body.milestoneEventId, expectedStatus: body.record.status, expectedVersion: body.record.version ?? 0, idempotencyKey: undoRequestId }),
          });
          const undone = await undoResponse.json().catch(() => null) as { ok?: boolean; record?: TrackedOpportunity } | null;
          if (!undoResponse.ok || !undone?.ok || !undone.record) throw new Error("Journey recovery failed");
          const activity = readStudentActivity();
          activity.tracked = { ...(activity.tracked ?? {}), [undone.record.id]: undone.record };
          replaceStudentActivity(activity);
          close(true);
          router.refresh();
        },
      });
      const row = dialogRef.current?.closest<HTMLElement>("[data-journey-record]");
      if (row) {
        row.dataset.recentlyUpdated = "true";
        if (rowHighlightTimerRef.current) window.clearTimeout(rowHighlightTimerRef.current);
        rowHighlightTimerRef.current = window.setTimeout(() => delete row.dataset.recentlyUpdated, 1_900);
      }
      const reducedMotion = document.documentElement.dataset.motion === "reduce"
        || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setCelebrationVisible(Boolean(body.celebration?.particleAccent && claimCelebration(body.milestoneEventId) && !reducedMotion));
    } catch {
      if (controller.signal.reason === "account-changed" || controller.signal.reason === "journey-control-unmounted") return;
      setError(controller.signal.aborted ? "We couldn’t confirm this update in time. Your previous stage is unchanged." : "We couldn’t reach UnlockED. Your previous stage is unchanged.");
    } finally {
      window.clearTimeout(timeout);
      controllerRef.current = null;
      pendingRef.current = false;
      setPending(false);
    }
  }

  return <div className={styles.statusControl} data-journey-update-control="" data-opportunity-id={control.opportunityId}>
    {showFollowUp && control.inactiveDays && !followUpDismissed ? <aside className={styles.followUp} aria-label="Journey update reminder">
      <p>You marked this as <strong>{control.workflow.stages[currentIndex]?.label ?? "active"}</strong> {control.inactiveDays} days ago.</p>
      <div><button ref={triggerRef} type="button" onClick={() => open()}>Update Journey</button><button type="button" onClick={() => setFollowUpDismissed(true)}>Keep current stage</button><button type="button" onClick={() => open("archived")}>Archive</button></div>
    </aside> : <button ref={triggerRef} type="button" className={styles.updateJourneyButton} onClick={() => open()}>{compactLabel}</button>}

    <dialog ref={dialogRef} className={styles.updateDialog} data-journey-update-dialog="" onCancel={(event) => { event.preventDefault(); if (!pending) close(); }} aria-labelledby={`journey-update-title-${control.opportunityId}`}>
      <div className={styles.updateDialogShell}>
        <header className={styles.updateDialogHeader}>
          <div className={styles.updateIdentity}>
            <ResolvedOrganizationMark logo={control.branding} size="md" />
            <div><p>{control.organization}</p><h2 id={`journey-update-title-${control.opportunityId}`}>{control.opportunityTitle}</h2></div>
          </div>
          <button type="button" className={styles.updateClose} onClick={() => close()} disabled={pending} aria-label="Close Update Journey"><CloseIcon /></button>
        </header>

        {result ? <section className={styles.updateConfirmation} aria-live="polite" data-journey-update-confirmation="" data-celebration-level={result.celebration?.level ?? "routine"}>
          {celebrationVisible && result.celebration ? <CelebrationBoundary><Suspense fallback={null}><MilestoneCelebrationEffect level={result.celebration.level} /></Suspense></CelebrationBoundary> : null}
          <span className={styles.confirmationIcon} aria-hidden="true"><CheckCircleIcon /></span>
          <p>{result.celebration?.level === "signature" ? "A defining milestone" : result.celebration?.level === "major" ? "Milestone recorded" : result.celebration ? "Progress recorded" : "Journey updated"}</p>
          <h3>{result.narrative.title}</h3>
          <span>{result.narrative.accomplishment}</span>
          <div className={styles.attribution}><span>Updated by you</span><span>Private by default</span></div>
          {result.stageChange ? <dl className={styles.stageChange}>
            <div><dt>Journey stage</dt><dd><span>{result.stageChange.before}</span><b aria-hidden="true">→</b><strong>{result.stageChange.after}</strong></dd></div>
          </dl> : null}
          {result.summaryChanges.length ? <dl className={styles.summaryChanges}>
            {result.summaryChanges.map((change) => <div key={change.id}><dt>{change.label}</dt><dd><span>{change.before}</span><b aria-hidden="true">→</b><strong>{change.after}</strong></dd></div>)}
          </dl> : null}
          <section className={styles.whatChanged}><p>What changed</p><span>{result.narrative.whatChanged}</span></section>
          <div className={styles.confirmationActions}>
            <button type="button" className={styles.updatePrimary} onClick={() => close()}>Return to Journey</button>
            {result.celebration?.particleAccent ? <a href="#journey-cards" onClick={() => close()}>Create Journey Card</a> : null}
          </div>
        </section> : <>
          <section className={styles.stageProgress} aria-labelledby={`journey-stage-heading-${control.opportunityId}`}>
            <div><p>Current Journey stage</p><h3 id={`journey-stage-heading-${control.opportunityId}`}>{control.workflow.stages[currentIndex]?.label ?? "In progress"}</h3></div>
          </section>

          <form className={styles.updateForm} onSubmit={(event) => { event.preventDefault(); if (selected) void update(selected); }}>
            <fieldset>
              <legend>What changed?</legend>
              <p>Choose the factual stage you want to record. UnlockED never advances your Journey automatically.</p>
              <div className={styles.stageChoices}>
                {control.actions.slice(0, 1).map((action) => <label key={action.id} data-destructive={action.destructive ? "true" : undefined}>
                  <input type="radio" name={`journey-stage-${control.opportunityId}`} value={action.id} checked={selectedId === action.id} onChange={() => setSelectedId(action.id)} />
                  <span><strong>{studentActionLabel(action)}</strong>{action.stage && !action.correction ? <span className={styles.canonicalStage}>{action.stage.label}</span> : null}<small>{action.correction ? "Correct the current record while preserving its stage history." : action.stage?.description ?? (action.id === "paused" ? "Keep the opportunity without moving it forward." : "Keep this opportunity in your history.")}</small></span>
                </label>)}
              </div>
              {alternateActions.length ? <details ref={alternateStagesRef} className={styles.alternateStages}>
                <summary>Choose a different stage</summary>
                <div className={styles.stageChoices}>
                  {alternateActions.map((action) => <label key={action.id} data-destructive={action.destructive ? "true" : undefined}>
                    <input type="radio" name={`journey-stage-${control.opportunityId}`} value={action.id} checked={selectedId === action.id} onChange={() => setSelectedId(action.id)} />
                    <span><strong>{studentActionLabel(action)}</strong>{action.stage && !action.correction ? <span className={styles.canonicalStage}>{action.stage.label}</span> : null}<small>{action.correction ? "Correct the current record while preserving its stage history." : action.stage?.description ?? (action.id === "paused" ? "Keep the opportunity without moving it forward." : "Keep this opportunity in your history.")}</small></span>
                  </label>)}
                </div>
              </details> : null}
            </fieldset>

            <details ref={milestoneDetailsRef} className={styles.milestoneDetails}>
              <summary>Add private details <span>Optional</span></summary>
              <div>
                <label>Private note<textarea value={notes} maxLength={1200} rows={3} onChange={(event) => setNotes(event.target.value)} placeholder="Add a factual note for your records" /></label>
                <div className={styles.dateFields}>
                  <label>{dateLabel}<input type="date" value={milestoneDate} onChange={(event) => setMilestoneDate(event.target.value)} /></label>
                  <label>Reminder<input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} /></label>
                </div>
                {reminderAt ? <label>Reminder note<input type="text" maxLength={160} value={reminderText} onChange={(event) => setReminderText(event.target.value)} placeholder="For example, request a recommendation letter" /></label> : null}
                {supportsDocuments ? <><label>Document references<input type="file" multiple onChange={(event) => setDocuments(documentsFrom(event.target.files))} /></label>
                  <p className={styles.documentNotice}>For privacy, UnlockED records filenames only. The files are not uploaded or verified.</p>
                  {documents.length ? <ul className={styles.documentList}>{documents.map((document) => <li key={document.id}>{document.name}</li>)}</ul> : null}</> : null}
              </div>
            </details>

            {error ? <p className={styles.controlError} role="alert">{error}</p> : null}
            <footer className={styles.updateActions}>
              <button type="button" onClick={() => close()} disabled={pending}>Cancel</button>
              <button type="submit" className={styles.updatePrimary} disabled={pending || !selected} aria-busy={pending ? "true" : undefined} data-action-state={pending ? "loading" : "idle"}><DelayedPendingLabel pending={pending} idle={selected?.destructive ? "Archive opportunity" : "Save milestone"} pendingLabel="Saving milestone…" /></button>
            </footer>
            <p className={styles.studentReported}>Student reported · Private by default · UnlockED does not verify supporting details</p>
          </form>
        </>}
      </div>
    </dialog>
  </div>;
}
