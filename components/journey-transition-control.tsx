"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent } from "@/data/account-sync";
import { replaceStudentActivity, readStudentActivity, type JourneyProgressTransition, type TrackedOpportunity } from "@/data/student-activity";
import type { JourneyTransitionAction } from "@/data/journey-transformations";
import type { JourneyEditorialModel } from "@/lib/journey-editorial";
import { ArrowIcon } from "@/components/icons";
import { journeyTransformationEvent } from "./journey-live-line";
import styles from "./journey-editorial.module.css";

type TransitionResponse = {
  ok: true;
  duplicate: boolean;
  transition: JourneyProgressTransition;
  record: TrackedOpportunity;
  narrative: { title: string; accomplishment: string; whatChanged: string; storyType: string };
  geometries: JourneyEditorialModel["geometries"];
  horizonGeometries: JourneyEditorialModel["horizon"]["geometries"];
};

function messageForStatus(status: number, fallback?: string) {
  if (status === 401) return "Your session has ended. Sign in again to update your Journey.";
  if (status === 403) return "This update was blocked because the request could not be verified. Refresh and try again.";
  if (status === 409) return "Your Journey changed in another tab. Refreshing the latest version.";
  if (status === 423) return "Another Journey update is still saving. Try again in a moment.";
  if (status === 422) return fallback || "That progress change is not available from the current status.";
  if (status >= 500) return "We couldn’t save this update. Your previous status is unchanged.";
  return fallback || "We couldn’t save this update. Your previous status is unchanged.";
}

export function JourneyTransitionControl({ control }: { control: NonNullable<JourneyEditorialModel["transitionControl"]> }) {
  const router = useRouter();
  const [record, setRecord] = useState<TrackedOpportunity>({
    id: control.opportunityId,
    status: control.status,
    savedAt: "",
    updatedAt: "",
    version: control.version,
  });
  const [actions, setActions] = useState(control.actions);
  const [pending, setPending] = useState<JourneyProgressTransition | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TransitionResponse | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const primary = useMemo(() => actions.find((action) => action.primary), [actions]);

  useEffect(() => {
    setRecord((current) => ({ ...current, status: control.status, version: control.version }));
    setActions(control.actions);
  }, [control.actions, control.status, control.version]);

  useEffect(() => {
    mountedRef.current = true;
    const accountChanged = () => {
      controllerRef.current?.abort("account-changed");
      setPending(null);
      setResult(null);
      setError("");
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort("journey-control-unmounted");
      window.removeEventListener(accountSessionEvent, accountChanged);
    };
  }, []);

  async function run(action: JourneyTransitionAction) {
    if (pendingRef.current) return;
    if (action.destructive && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    setConfirmClose(false);
    pendingRef.current = true;
    setPending(action.transition);
    setError("");
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("journey-transition-timeout"), 8_000);
    try {
      const response = await authenticatedFetch("/api/journey/transition", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          opportunityId: control.opportunityId,
          transition: action.transition,
          expectedStatus: record.status,
          expectedVersion: record.version ?? 0,
          idempotencyKey: `journey:${crypto.randomUUID()}`,
        }),
      });
      const body = await response.json().catch(() => null) as (TransitionResponse & { error?: string }) | null;
      if (!response.ok || !body?.ok) {
        const message = messageForStatus(response.status, body?.error);
        if (mountedRef.current) setError(message);
        if (response.status === 409) window.setTimeout(() => router.refresh(), 400);
        return;
      }
      if (!mountedRef.current || controller.signal.aborted) return;
      setRecord(body.record);
      setActions([]);
      setResult(body);
      const activity = readStudentActivity();
      activity.tracked = { ...(activity.tracked ?? {}), [body.record.id]: body.record };
      activity.saved = [...new Set([...activity.saved, body.record.id])];
      replaceStudentActivity(activity);
      window.dispatchEvent(new CustomEvent(journeyTransformationEvent, { detail: {
        geometries: body.geometries,
        horizonGeometries: body.horizonGeometries,
        announcement: `${body.narrative.title}. ${body.narrative.whatChanged}`,
      } }));
      window.setTimeout(() => { if (mountedRef.current) router.refresh(); }, 1_200);
      window.setTimeout(() => { if (mountedRef.current) setResult(null); }, 2_600);
    } catch (caught) {
      if (!mountedRef.current || controller.signal.reason === "account-changed" || controller.signal.reason === "account-signed-out") return;
      if (controller.signal.reason === "journey-transition-timeout") {
        setError("We couldn’t confirm this update in time. Refreshing your latest Journey.");
        window.setTimeout(() => router.refresh(), 400);
      } else {
        setError(caught instanceof Error ? "We couldn’t reach UnlockED. Your previous status is unchanged." : "We couldn’t save this update. Your previous status is unchanged.");
      }
    } finally {
      window.clearTimeout(timeout);
      pendingRef.current = false;
      if (mountedRef.current) setPending(null);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  if (result) return <section className={styles.transformationResult} aria-labelledby="journey-transformation-title" aria-live="polite" aria-atomic="true" data-journey-transformation-result="">
    <p className={styles.transformationLabel}>What changed</p>
    <h3 id="journey-transformation-title">{result.narrative.title}</h3>
    <p>{result.narrative.accomplishment}</p>
    <p className={styles.transformationMeaning}>{result.narrative.whatChanged}</p>
    <a href="/my-opportunities" className={styles.quietJourneyLink}>Manage applications <ArrowIcon /></a>
  </section>;

  return <div className={styles.transitionControls} data-journey-transition-control="" data-opportunity-id={control.opportunityId}>
    {primary ? <button type="button" className={styles.primaryAction} disabled={Boolean(pending)} aria-describedby={error ? "journey-transition-error" : undefined} onClick={() => void run(primary)}>
      {pending === primary.transition ? "Saving…" : primary.label} {!pending ? <ArrowIcon /> : null}
    </button> : null}
    {actions.some((action) => !action.primary) ? <details className={styles.manageDisclosure}>
      <summary>Manage applications</summary>
      <div className={styles.manageActions}>
        {actions.filter((action) => !action.primary).map((action) => <button key={action.transition} type="button" disabled={Boolean(pending)} onClick={() => void run(action)}>
          {action.destructive && confirmClose ? "Confirm close" : action.label}
        </button>)}
        {confirmClose ? <button type="button" onClick={() => setConfirmClose(false)}>Keep it active</button> : null}
        <a href="/my-opportunities" className={styles.manageApplicationsLink}>Open application management <ArrowIcon /></a>
      </div>
    </details> : <a href="/my-opportunities" className={styles.manageApplicationsLink}>Manage applications <ArrowIcon /></a>}
    {error ? <p id="journey-transition-error" className={styles.transitionError} role="alert">{error}</p> : null}
    <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{pending ? `Saving ${primary?.label ?? "Journey update"}.` : ""}</p>
  </div>;
}
