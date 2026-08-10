"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent } from "@/data/account-sync";
import type { OpportunityTrackerStatus } from "@/data/student-activity";
import type { ApplicationWorkspaceProjection } from "@/lib/application-workspace";
import { ArrowIcon, CheckIcon } from "@/components/icons";
import styles from "./application-workspace.module.css";

type SubmissionAction = {
  professionalStageId: string;
  transition: "submit";
  expectedStatus: OpportunityTrackerStatus;
  expectedVersion: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value.length === 10 ? `${value}T12:00:00.000Z` : value));
}

function errorMessage(status: number, fallback?: string) {
  if (status === 401) return "Your session ended. Sign in again before updating this application.";
  if (status === 403) return "This application workspace could not be verified. Refresh and try again.";
  if (status === 409) return "This application changed in another tab. Refreshing the latest version.";
  if (status === 423) return "Another application update is still saving. Try again in a moment.";
  return fallback || "We couldn’t save this update. Your application is unchanged.";
}

export function ApplicationWorkspace({ initial, opportunityTitle, submission }: {
  initial: ApplicationWorkspaceProjection;
  opportunityTitle: string;
  submission?: SubmissionAction;
}) {
  const router = useRouter();
  const requestRef = useRef<AbortController | null>(null);
  const [workspace, setWorkspace] = useState(initial);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => setWorkspace(initial), [initial]);
  useEffect(() => {
    const reset = () => {
      requestRef.current?.abort("account-changed");
      setPending("");
      setError("");
      setTitle("");
      setDueDate("");
    };
    window.addEventListener(accountSessionEvent, reset);
    return () => { requestRef.current?.abort("unmounted"); window.removeEventListener(accountSessionEvent, reset); };
  }, []);

  async function mutate(body: Record<string, unknown>, pendingKey: string) {
    if (pending) return null;
    setPending(pendingKey);
    setError("");
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 8_000);
    try {
      const response = await authenticatedFetch("/api/journey/application", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ opportunityId: workspace.opportunityId, expectedVersion: workspace.workspaceVersion, ...body }),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; workspace?: ApplicationWorkspaceProjection } | null;
      if (!response.ok || !result?.ok || !result.workspace) {
        setError(errorMessage(response.status, result?.error));
        if (response.status === 409) router.refresh();
        return null;
      }
      setWorkspace(result.workspace);
      router.refresh();
      return result.workspace;
    } catch {
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") setError(controller.signal.reason === "timeout" ? "Saving took too long. Nothing changed; try again." : "We couldn’t reach UnlockED. Nothing changed.");
      return null;
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") setPending("");
    }
  }

  async function addTask() {
    if (!title.trim()) return;
    const result = await mutate({ action: "add_task", idempotencyKey: `application-task:${crypto.randomUUID()}`, title, dueDate: dueDate || undefined }, "add");
    if (result) { setTitle(""); setDueDate(""); }
  }

  async function markApplied() {
    if (!submission || pending) return;
    setPending("submit");
    setError("");
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 8_000);
    try {
      const response = await authenticatedFetch("/api/journey/transition", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          opportunityId: workspace.opportunityId,
          professionalStageId: submission.professionalStageId,
          transition: submission.transition,
          expectedStatus: submission.expectedStatus,
          expectedVersion: submission.expectedVersion,
          idempotencyKey: `application-submit:${crypto.randomUUID()}`,
          details: { source: "student_reported" },
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(errorMessage(response.status, result?.error));
        if (response.status === 409) router.refresh();
        return;
      }
      setWorkspace({ ...workspace, submitted: true, readyForSubmission: false, submittedAt: new Date().toISOString() });
      router.refresh();
    } catch {
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") setError(controller.signal.reason === "timeout" ? "Saving took too long. Your Journey stage is unchanged." : "We couldn’t reach UnlockED. Your Journey stage is unchanged.");
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") setPending("");
    }
  }

  if (workspace.submitted) return <section className={styles.workspace} aria-labelledby={`application-${workspace.opportunityId}`} data-application-workspace="submitted">
    <div className={styles.submitted}><span aria-hidden="true"><CheckIcon /></span><div><h4 id={`application-${workspace.opportunityId}`}>Application submitted</h4><p>{workspace.submittedAt ? `Submitted ${formatDate(workspace.submittedAt)}. ` : ""}Keep Journey updated when you hear back.</p></div></div>
    <a className={styles.official} href={workspace.officialSource} target="_blank" rel="noreferrer">Open official application <ArrowIcon /><span className="sr-only">(opens in a new tab)</span></a>
  </section>;

  return <section className={styles.workspace} aria-labelledby={`application-${workspace.opportunityId}`} data-application-workspace="active">
    <header className={styles.summary}>
      <div><p>Application</p><h4 id={`application-${workspace.opportunityId}`}>Prepare your application</h4></div>
      {workspace.deadline ? <div><span>Deadline</span><strong>{formatDate(workspace.deadline)}</strong></div> : null}
    </header>

    {workspace.totalCount ? <div className={styles.progress} aria-label={`${workspace.completedCount} of ${workspace.totalCount} application tasks complete`}>
      <div><span>Application progress</span><strong>{workspace.completedCount} of {workspace.totalCount} complete</strong></div>
      <div className={styles.progressBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={workspace.progressPercent}><i style={{ width: `${workspace.progressPercent}%` }} /></div>
      {workspace.deadlineDaysRemaining !== undefined && workspace.deadlineDaysRemaining >= 0 && workspace.deadlineDaysRemaining <= 30 && workspace.unfinishedCount > 0
        ? <p>{workspace.deadlineDaysRemaining === 0 ? "Due today" : `${workspace.deadlineDaysRemaining} ${workspace.deadlineDaysRemaining === 1 ? "day" : "days"} remaining`} · {workspace.unfinishedCount} {workspace.unfinishedCount === 1 ? "task" : "tasks"} left</p>
        : null}
    </div> : null}

    {workspace.recentProviderUpdate ? <p className={styles.providerUpdate} role="status"><strong>{workspace.recentProviderUpdate.label}</strong> {workspace.recentProviderUpdate.summary}</p> : null}
    {workspace.tasks.length ? <ul className={styles.tasks}>{workspace.tasks.map((task) => <li key={task.id} data-completed={task.completed ? "true" : undefined}>
      <button type="button" className={styles.check} aria-pressed={task.completed} aria-label={`${task.completed ? "Mark incomplete" : "Mark complete"}: ${task.title}`} disabled={Boolean(pending)} onClick={() => void mutate({ action: "set_completion", taskId: task.id, completed: !task.completed }, task.id)}>{task.completed ? <CheckIcon /> : null}</button>
      <div><span>{task.title}</span>{task.dueDate ? <time dateTime={task.dueDate}>Due {formatDate(task.dueDate)}</time> : task.source === "verified_requirement" ? <small>{task.recentlyUpdated ? "Updated by the provider" : "Listed by the provider"}</small> : null}</div>
      {task.source === "user" ? <button type="button" className={styles.remove} disabled={Boolean(pending)} onClick={() => void mutate({ action: "delete_task", taskId: task.id }, `delete:${task.id}`)}>Remove<span className="sr-only"> {task.title}</span></button> : null}
    </li>)}</ul> : <div className={styles.unverified}><h5>Get organized</h5><p>UnlockED hasn’t verified the application materials for this opportunity yet. Check the official application, then add only the tasks you need.</p></div>}

    <details className={styles.addTask}>
      <summary>+ Add task</summary>
      <div><label>Task name<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Ask professor for recommendation" /></label><label>Due date <span>Optional</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><button type="button" disabled={!title.trim() || Boolean(pending)} onClick={() => void addTask()}>{pending === "add" ? "Adding…" : "Add task"}</button></div>
    </details>

    {workspace.readyForSubmission ? <div className={styles.ready}><div><strong>Everything looks ready.</strong><span>Did you submit your application?</span></div>{submission ? <button type="button" disabled={Boolean(pending)} onClick={() => void markApplied()}>{pending === "submit" ? "Saving…" : "Mark as Applied"}</button> : null}</div> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <a className={styles.official} href={workspace.officialSource} target="_blank" rel="noreferrer">Open official application <ArrowIcon /><span className="sr-only">(opens in a new tab)</span></a>
    <p className="sr-only">Application workspace for {opportunityTitle}.</p>
  </section>;
}
