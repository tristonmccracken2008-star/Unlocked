"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import type { JourneyProgressTransition, TrackedOpportunity } from "@/data/student-activity";
import type { JourneyTimelineControl } from "@/lib/journey-timeline";
import styles from "./journey-timeline.module.css";

function messageForStatus(status: number, fallback?: string) {
  if (status === 401) return "Your session ended. Sign in again before updating this status.";
  if (status === 403) return "This request could not be verified. Refresh and try again.";
  if (status === 409) return "This status changed in another tab. Refreshing the latest version.";
  if (status === 423) return "Another Journey update is still saving. Try again in a moment.";
  if (status === 422) return fallback || "That status change is not available.";
  return fallback || "We couldn’t save this update. The previous status is unchanged.";
}

export function JourneyTimelineControl({ control }: { control: JourneyTimelineControl }) {
  const router = useRouter();
  const [pending, setPending] = useState<JourneyProgressTransition | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const pendingRef = useRef(false);

  async function update(transition: JourneyProgressTransition) {
    if (pendingRef.current) return;
    const action = control.actions.find((item) => item.transition === transition);
    if (action?.destructive && !window.confirm(`${action.label}? This keeps the opportunity in your Journey history.`)) return;
    pendingRef.current = true;
    setPending(transition);
    setMessage("");
    setError(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await authenticatedFetch("/api/journey/transition", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          opportunityId: control.opportunityId,
          transition,
          expectedStatus: control.status,
          expectedVersion: control.version,
          idempotencyKey: `journey:${crypto.randomUUID()}`,
        }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; record?: TrackedOpportunity; error?: string } | null;
      if (!response.ok || !body?.ok || !body.record) {
        setError(true);
        setMessage(messageForStatus(response.status, body?.error));
        if (response.status === 409) window.setTimeout(() => router.refresh(), 450);
        return;
      }
      const label = body.record.status === "Interview" ? "Interviewing" : body.record.status === "Rejected" ? "Closed" : body.record.status;
      setMessage(`Status updated to ${label}.`);
      window.setTimeout(() => router.refresh(), 350);
    } catch {
      setError(true);
      setMessage(controller.signal.aborted ? "We couldn’t confirm this update in time. Refresh and try again." : "We couldn’t reach UnlockED. The previous status is unchanged.");
    } finally {
      window.clearTimeout(timeout);
      pendingRef.current = false;
      setPending(null);
    }
  }

  return <div className={styles.statusControl} aria-busy={pending ? "true" : undefined}>
    <details>
      <summary>Update status</summary>
      <div className={styles.statusActions}>
        {control.actions.map((action) => <button key={action.transition} type="button" disabled={Boolean(pending)} onClick={() => void update(action.transition)}>{pending === action.transition ? "Saving…" : action.label}</button>)}
      </div>
    </details>
    {message ? <p className={error ? styles.controlError : styles.controlSuccess} role={error ? "alert" : "status"} aria-live="polite">{message}</p> : null}
  </div>;
}
