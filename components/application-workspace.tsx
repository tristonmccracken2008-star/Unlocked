"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent } from "@/data/account-sync";
import type { OpportunityTrackerStatus } from "@/data/student-activity";
import type { ApplicationWorkspaceProjection } from "@/lib/application-workspace";
import { ArrowIcon, CheckIcon } from "@/components/icons";
import { SmartEmptyState } from "@/components/smart-empty-state";
import { ActionButtonLabel, ActionFeedback } from "@/components/action-feedback";
import { useUndoRecovery } from "@/components/undo-recovery";
import { ContextualCalendarAction } from "@/components/contextual-calendar-action";
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

function optimisticCompletion(workspace: ApplicationWorkspaceProjection, taskId: string, completed: boolean) {
  const tasks = workspace.tasks.map((task) => task.id === taskId ? { ...task, completed } : task);
  const completedCount = tasks.filter((task) => task.completed).length;
  return {
    ...workspace,
    tasks,
    completedCount,
    unfinishedCount: tasks.length - completedCount,
    progressPercent: tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0,
    readyForSubmission: !workspace.submitted && tasks.length > 0 && completedCount === tasks.length,
  };
}

export function ApplicationWorkspace({ initial, opportunityTitle, submission }: {
  initial: ApplicationWorkspaceProjection;
  opportunityTitle: string;
  submission?: SubmissionAction;
}) {
  const router = useRouter();
  const { offerUndo } = useUndoRecovery();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [workspace, setWorkspace] = useState(initial);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const orderedTasks = useMemo(() => [...workspace.tasks].sort((left, right) => Number(left.completed) - Number(right.completed)), [workspace.tasks]);

  useEffect(() => setWorkspace(initial), [initial]);
  useEffect(() => {
    const popover = workspaceRef.current?.closest<HTMLElement>("[popover]");
    if (!popover) return;
    const restoreFocus = (event: Event) => {
      if ((event as ToggleEvent).newState !== "closed") return;
      const trigger = popover.parentElement?.querySelector<HTMLButtonElement>(`[popovertarget="${popover.id}"]`);
      trigger?.focus();
    };
    popover.addEventListener("toggle", restoreFocus);
    return () => popover.removeEventListener("toggle", restoreFocus);
  }, []);
  useEffect(() => {
    const reset = () => {
      requestRef.current?.abort("account-changed");
      setPending("");
      setError("");
      setMessage("");
      setAnnouncement("");
      setRetry(null);
      setTitle("");
      setDueDate("");
    };
    window.addEventListener(accountSessionEvent, reset);
    return () => { requestRef.current?.abort("unmounted"); window.removeEventListener(accountSessionEvent, reset); };
  }, []);

  async function mutate(body: Record<string, unknown>, pendingKey: string, options: {
    optimistic?: (current: ApplicationWorkspaceProjection) => ApplicationWorkspaceProjection;
    success?: string;
    announce?: string;
    onSuccess?: (workspace: ApplicationWorkspaceProjection) => void;
  } = {}) {
    if (pending) return null;
    const previous = workspace;
    setPending(pendingKey);
    setError("");
    setMessage("");
    setRetry(null);
    if (options.optimistic) setWorkspace(options.optimistic(previous));
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
        if (options.optimistic) setWorkspace(previous);
        setError(errorMessage(response.status, result?.error));
        setRetry(() => () => void mutate(body, pendingKey, options));
        if (response.status === 409) router.refresh();
        return null;
      }
      setWorkspace(result.workspace);
      if (options.success) setMessage(options.success);
      if (options.announce) setAnnouncement(options.announce);
      options.onSuccess?.(result.workspace);
      return result.workspace;
    } catch {
      if (options.optimistic) setWorkspace(previous);
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") {
        setError(controller.signal.reason === "timeout" ? "Saving took too long. Your previous version is still intact." : "We couldn’t reach UnlockED. Your previous version is still intact.");
        setRetry(() => () => void mutate(body, pendingKey, options));
      }
      return null;
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") setPending("");
    }
  }

  async function addTask() {
    if (!title.trim()) return;
    const result = await mutate({ action: "add_task", idempotencyKey: `application-task:${crypto.randomUUID()}`, title, dueDate: dueDate || undefined }, "add", { success: "Task added." });
    if (result) { setTitle(""); setDueDate(""); }
  }

  async function restoreTask(taskId: string, expectedVersion: number) {
    const response = await authenticatedFetch("/api/journey/application", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore_task", opportunityId: workspace.opportunityId, expectedVersion, taskId }),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; workspace?: ApplicationWorkspaceProjection } | null;
    if (!response.ok || !result?.ok || !result.workspace) throw new Error("Task restore failed");
    setWorkspace(result.workspace);
  }

  async function markApplied() {
    if (!submission || pending) return;
    setPending("submit");
    setError("");
    setMessage("");
    setRetry(null);
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
      setAnnouncement("Application marked as submitted.");
      router.refresh();
    } catch {
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") setError(controller.signal.reason === "timeout" ? "Saving took too long. Your Journey stage is unchanged." : "We couldn’t reach UnlockED. Your Journey stage is unchanged.");
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") setPending("");
    }
  }

  if (workspace.submitted) return <section ref={workspaceRef} className={styles.workspace} aria-labelledby={`application-${workspace.opportunityId}`} data-application-workspace="submitted">
    <div className={styles.submitted}><span aria-hidden="true"><CheckIcon /></span><div><h4 id={`application-${workspace.opportunityId}`}>Application submitted</h4><p>{workspace.submittedAt ? `Submitted ${formatDate(workspace.submittedAt)}. ` : ""}Keep Journey updated when you hear back.</p></div></div>
    <a className={styles.official} href={workspace.officialSource} target="_blank" rel="noreferrer">Open official application <ArrowIcon /><span className="sr-only">(opens in a new tab)</span></a>
  </section>;

  return <section ref={workspaceRef} className={styles.workspace} aria-labelledby={`application-${workspace.opportunityId}`} data-application-workspace="active">
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

    <div className={styles.smartSetup}>
      <span>{workspace.requirementsVerified ? "Verified requirements were added automatically." : "Add only the private steps you need."}{workspace.deadline ? " The official deadline is already in Upcoming." : ""}</span>
      <ContextualCalendarAction className={styles.dateAction} label="Add personal date" context={{ opportunityId: workspace.opportunityId, opportunityTitle, type: "personal_target", title: "Personal application target" }} />
    </div>

    {workspace.recentProviderUpdate ? <p className={styles.providerUpdate} role="status"><strong>{workspace.recentProviderUpdate.label}</strong> {workspace.recentProviderUpdate.summary}</p> : null}
    {workspace.tasks.length ? <section className={styles.taskSection} aria-labelledby={`application-tasks-${workspace.opportunityId}`}><header><h5 id={`application-tasks-${workspace.opportunityId}`}>{workspace.unfinishedCount ? "What’s left" : "Application tasks"}</h5><span>{workspace.unfinishedCount ? `${workspace.unfinishedCount} remaining` : "All complete"}</span></header><ul className={styles.tasks}>{orderedTasks.map((task) => <li key={task.id} data-completed={task.completed ? "true" : undefined} data-pending={pending === task.id ? "true" : undefined}>
      <button type="button" className={styles.check} aria-pressed={task.completed} aria-busy={pending === task.id ? "true" : undefined} aria-label={`${task.completed ? "Mark incomplete" : "Mark complete"}: ${task.title}`} disabled={Boolean(pending)} onClick={() => {
        const completed = !task.completed;
        void mutate({ action: "set_completion", taskId: task.id, completed }, task.id, {
          optimistic: (current) => optimisticCompletion(current, task.id, completed),
          announce: completed ? `Task completed: ${task.title}` : `Task reopened: ${task.title}`,
        });
      }}>{task.completed ? <CheckIcon /> : null}</button>
      <div><span>{task.title}</span><small>{task.source === "verified_requirement" ? (task.recentlyUpdated ? "Verified requirement · Updated by the provider" : "Verified requirement") : "Your task"}{task.dueDate ? <> · <time dateTime={task.dueDate}>Due {formatDate(task.dueDate)}</time></> : null}</small></div>
      {task.source === "user" ? <button type="button" className={styles.remove} disabled={Boolean(pending)} onClick={() => void mutate({ action: "delete_task", taskId: task.id }, `delete:${task.id}`, {
        onSuccess: (next) => offerUndo({
          message: "Task deleted.",
          restoredMessage: "Task restored.",
          undo: () => restoreTask(task.id, next.workspaceVersion),
        }),
      })}>Remove<span className="sr-only"> {task.title}</span></button> : null}
    </li>)}</ul></section> : <SmartEmptyState compact className={styles.smartEmpty} title="No application tasks yet." description="UnlockED hasn’t verified the application materials for this opportunity. Review the official requirements, then add only the tasks you need." primaryAction={{ label: "Open official application", href: workspace.officialSource, external: true }} />}

    <details className={styles.addTask}>
      <summary>+ Add task</summary>
      <div><label>Task name<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Ask professor for recommendation" /></label><label>Due date <span>Optional</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><button type="button" disabled={!title.trim() || Boolean(pending)} aria-busy={pending === "add" ? "true" : undefined} data-action-state={pending === "add" ? "loading" : "idle"} onClick={() => void addTask()}><ActionButtonLabel phase={pending === "add" ? "pending" : "idle"} idle="Add task" pending="Adding task…" /></button></div>
    </details>

    {workspace.readyForSubmission ? <div className={styles.ready}><div><strong>Everything looks ready.</strong><span>Did you submit your application?</span></div>{submission ? <button type="button" disabled={Boolean(pending)} aria-busy={pending === "submit" ? "true" : undefined} data-action-state={pending === "submit" ? "loading" : "idle"} onClick={() => void markApplied()}><ActionButtonLabel phase={pending === "submit" ? "pending" : "idle"} idle="Mark as Applied" pending="Saving application…" /></button> : null}</div> : null}
    {message ? <ActionFeedback message={message} state="success" level="routine" /> : null}
    {error ? <ActionFeedback message={error} state="error" level="confirmatory" action={retry ? { label: "Try again", onClick: retry, pending: Boolean(pending) } : undefined} /> : null}
    <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    <a className={styles.official} href={workspace.officialSource} target="_blank" rel="noreferrer">Open official application <ArrowIcon /><span className="sr-only">(opens in a new tab)</span></a>
    <p className="sr-only">Application workspace for {opportunityTitle}.</p>
  </section>;
}
