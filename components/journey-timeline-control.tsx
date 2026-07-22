"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent } from "@/data/account-sync";
import type { JourneyMilestoneDocumentReference, JourneyProgressTransition, TrackedOpportunity } from "@/data/student-activity";
import type { JourneyProfessionalAction } from "@/data/journey-professional";
import type { JourneyTimelineControl } from "@/lib/journey-timeline";
import { CheckCircleIcon, CloseIcon } from "@/components/icons";
import styles from "./journey-timeline.module.css";

type TransitionResponse = {
  ok: true;
  duplicate: boolean;
  transition: JourneyProgressTransition;
  record: TrackedOpportunity;
  professionalStage?: { id: string; label: string; major: boolean };
  stageChange?: { before: string; after: string };
  narrative: { title: string; accomplishment: string; whatChanged: string; storyType: string };
  summaryChanges: Array<{ id: string; label: string; before: number; after: number }>;
};

function messageForStatus(status: number, fallback?: string) {
  if (status === 401) return "Your session ended. Sign in again before updating your Journey.";
  if (status === 403) return "This request could not be verified. Refresh and try again.";
  if (status === 409) return "Your Journey changed in another tab. Refreshing the latest version.";
  if (status === 423) return "Another Journey update is still saving. Try again in a moment.";
  if (status === 422) return fallback || "That milestone is not available from the current stage.";
  return fallback || "We couldn’t save this milestone. Your previous stage is unchanged.";
}

function BrandMark({ branding, organization }: Pick<JourneyTimelineControl, "branding" | "organization">) {
  if (branding.kind === "image") return <span className={styles.updateBrand} aria-label={branding.alt}>
    <span aria-hidden="true">{branding.initials || organization.slice(0, 2).toUpperCase()}</span>
    <img src={branding.src} alt="" width="56" height="56" />
  </span>;
  return <span className={styles.updateBrand} aria-label={branding.alt}>{branding.kind === "category" ? branding.categoryIcon : branding.initials}</span>;
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

export function JourneyTimelineControl({ control }: { control: JourneyTimelineControl }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const [selectedId, setSelectedId] = useState(control.actions[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [documents, setDocuments] = useState<JourneyMilestoneDocumentReference[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TransitionResponse | null>(null);
  const [followUpDismissed, setFollowUpDismissed] = useState(false);
  const currentIndex = control.workflow.stages.findIndex((stage) => stage.id === control.currentStageId);
  const selected = useMemo(() => control.actions.find((action) => action.id === selectedId) ?? control.actions[0], [control.actions, selectedId]);

  useEffect(() => {
    const accountChanged = () => {
      controllerRef.current?.abort("account-changed");
      dialogRef.current?.close();
      setPending(false);
      setResult(null);
      setError("");
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => {
      controllerRef.current?.abort("journey-control-unmounted");
      window.removeEventListener(accountSessionEvent, accountChanged);
    };
  }, []);

  function open(actionId = control.actions[0]?.id) {
    if (actionId) setSelectedId(actionId);
    setError("");
    setResult(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    if (result) router.refresh();
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
    {control.inactiveDays && !followUpDismissed ? <aside className={styles.followUp} aria-label="Journey update reminder">
      <p>You marked this as <strong>{control.workflow.stages[currentIndex]?.label ?? "active"}</strong> {control.inactiveDays} days ago.</p>
      <div><button type="button" onClick={() => open()}>Update Journey</button><button type="button" onClick={() => setFollowUpDismissed(true)}>Keep current stage</button><button type="button" onClick={() => open("archived")}>Archive</button></div>
    </aside> : <button type="button" className={styles.updateJourneyButton} onClick={() => open()}>Update Journey</button>}

    <dialog ref={dialogRef} className={styles.updateDialog} data-journey-update-dialog="" onCancel={(event) => { if (pending) event.preventDefault(); }} aria-labelledby={`journey-update-title-${control.opportunityId}`}>
      <div className={styles.updateDialogShell}>
        <header className={styles.updateDialogHeader}>
          <div className={styles.updateIdentity}>
            <BrandMark branding={control.branding} organization={control.organization} />
            <div><p>{control.organization}</p><h2 id={`journey-update-title-${control.opportunityId}`}>{control.opportunityTitle}</h2></div>
          </div>
          <button type="button" className={styles.updateClose} onClick={close} disabled={pending} aria-label="Close Update Journey"><CloseIcon /></button>
        </header>

        {result ? <section className={styles.updateConfirmation} aria-live="polite" data-journey-update-confirmation="">
          <span className={styles.confirmationIcon} aria-hidden="true"><CheckCircleIcon /></span>
          <p>Journey updated</p>
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
          <button type="button" className={styles.updatePrimary} onClick={close}>Return to Journey</button>
        </section> : <>
          <section className={styles.stageProgress} aria-labelledby={`journey-stage-heading-${control.opportunityId}`}>
            <div><p>Current Journey stage</p><h3 id={`journey-stage-heading-${control.opportunityId}`}>{control.workflow.stages[currentIndex]?.label ?? "In progress"}</h3></div>
            <ol aria-label={`${control.workflow.label} stages`}>
              {control.workflow.stages.filter((stage) => stage.id !== "archived").map((stage, index) => <li key={stage.id} data-state={index < currentIndex ? "complete" : index === currentIndex ? "current" : "future"}>
                <span aria-hidden="true" />
                <p>{stage.label}</p>
              </li>)}
            </ol>
          </section>

          <form className={styles.updateForm} onSubmit={(event) => { event.preventDefault(); if (selected) void update(selected); }}>
            <fieldset>
              <legend>What changed?</legend>
              <p>Only the next valid milestone is available. UnlockED never advances your Journey automatically.</p>
              <div className={styles.stageChoices}>
                {control.actions.map((action) => <label key={action.id} data-destructive={action.destructive ? "true" : undefined}>
                  <input type="radio" name={`journey-stage-${control.opportunityId}`} value={action.id} checked={selectedId === action.id} onChange={() => setSelectedId(action.id)} />
                  <span><strong>{action.id === "resume" ? action.label : action.stage?.label ?? action.label}</strong><small>{action.stage?.description ?? (action.id === "paused" ? "Keep the opportunity without moving it forward." : "Keep this opportunity in your history.")}</small></span>
                </label>)}
              </div>
            </fieldset>

            <details className={styles.milestoneDetails}>
              <summary>Add private details <span>Optional</span></summary>
              <div>
                <label>Notes<textarea value={notes} maxLength={1200} rows={4} onChange={(event) => setNotes(event.target.value)} placeholder="What would you want to remember about this milestone?" /></label>
                <div className={styles.dateFields}>
                  <label>Milestone date<input type="date" value={milestoneDate} onChange={(event) => setMilestoneDate(event.target.value)} /></label>
                  <label>Reminder<input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} /></label>
                </div>
                <label>Document references<input type="file" multiple onChange={(event) => setDocuments(documentsFrom(event.target.files))} /></label>
                <p className={styles.documentNotice}>For privacy, UnlockED records filenames only. The files are not uploaded or verified.</p>
                {documents.length ? <ul className={styles.documentList}>{documents.map((document) => <li key={document.id}>{document.name}</li>)}</ul> : null}
              </div>
            </details>

            {error ? <p className={styles.controlError} role="alert">{error}</p> : null}
            <footer className={styles.updateActions}>
              <button type="button" onClick={close} disabled={pending}>Cancel</button>
              <button type="submit" className={styles.updatePrimary} disabled={pending || !selected}>{pending ? "Saving milestone…" : selected?.destructive ? "Archive opportunity" : "Save milestone"}</button>
            </footer>
            <p className={styles.studentReported}>Student reported · Private by default · UnlockED does not verify supporting details</p>
          </form>
        </>}
      </div>
    </dialog>
  </div>;
}
