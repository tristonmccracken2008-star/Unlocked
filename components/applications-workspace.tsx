"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import type { ApplicationsWorkspaceApplication, ApplicationsWorkspaceModel } from "@/lib/applications-workspace";
import { ArrowIcon, CalendarIcon, CheckIcon, ListIcon } from "./icons";
import { OrganizationMark } from "./organization-logo";
import { SmartEmptyState } from "./smart-empty-state";
import styles from "./applications-workspace.module.css";

type Filter = "attention" | "active" | "ready" | "submitted";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00.000Z`));
}

function actionError(status: number, fallback?: string) {
  if (status === 401) return "Your session ended. Sign in again before updating this application.";
  if (status === 403) return "This application could not be verified for your account.";
  if (status === 409) return "This application changed in another tab. Refreshing the latest version.";
  if (status === 423) return "Another account update is still saving. Try again in a moment.";
  return fallback || "We couldn’t save this update. Your previous state is unchanged.";
}

export function ApplicationsWorkspace({ initial }: { initial: ApplicationsWorkspaceModel }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("attention");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const filtered = useMemo(() => {
    if (filter === "attention") return initial.active.filter((item) => item.state === "needs_attention" || item.attention.length > 0);
    if (filter === "ready") return initial.ready;
    if (filter === "submitted") return initial.submitted;
    return initial.active;
  }, [filter, initial]);
  useEffect(() => { trackProductEvent("applications_workspace_opened_v1", { status: initial.counts.active ? "active" : "empty" }); }, [initial.counts.active]);

  async function request(application: ApplicationsWorkspaceApplication, key: string, endpoint: string, body: Record<string, unknown>, success: string, onSuccess?: () => void) {
    if (pending) return;
    setPending(key); setError(""); setAnnouncement("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await authenticatedFetch(endpoint, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(actionError(response.status, payload?.error));
        if (response.status === 409) router.refresh();
        return;
      }
      setAnnouncement(success);
      onSuccess?.();
      router.refresh();
    } catch {
      setError(controller.signal.aborted ? "Saving took too long. Your previous state is unchanged." : "We couldn’t reach UnlockED. Your previous state is unchanged.");
    } finally {
      window.clearTimeout(timeout);
      setPending("");
    }
  }

  function completeTask(application: ApplicationsWorkspaceApplication, taskId: string) {
    const task = application.workspace.tasks.find((item) => item.id === taskId);
    return request(application, `task:${application.id}:${taskId}`, "/api/journey/application", { action: "set_completion", opportunityId: application.id, expectedVersion: application.workspace.workspaceVersion, taskId, completed: true }, "Application task completed.", () => trackProductEvent("application_task_completed_v1", { category: application.state, source: task?.source === "user" ? "private" : "verified" }));
  }

  function selectMaterial(application: ApplicationsWorkspaceApplication, requirementType: string, materialId: string) {
    return request(application, `material:${application.id}:${requirementType}`, "/api/materials", { action: "associate", expectedVersion: application.workspace.materials.storeVersion, opportunityId: application.id, requirementType, materialId }, "Material selected for this application.");
  }

  function markApplied(application: ApplicationsWorkspaceApplication) {
    if (!application.submission) return;
    return request(application, `submit:${application.id}`, "/api/journey/transition", {
      opportunityId: application.id,
      professionalStageId: application.submission.professionalStageId,
      transition: "submit",
      expectedStatus: application.submission.expectedStatus,
      expectedVersion: application.submission.expectedVersion,
      idempotencyKey: `applications-submit:${crypto.randomUUID()}`,
      details: { source: "student_reported" },
    }, "Application marked as submitted.");
  }

  return <main className={styles.page} data-applications-workspace>
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div><p className="rule-label">Private application workspace</p><h1>Applications</h1><span>Manage active applications in one place.</span></div>
        <nav aria-label="Application workspace links"><Link href="/materials">Materials</Link><Link href="/#journey-calendar">Calendar</Link><Link href="/">Journey</Link></nav>
      </header>

      {!initial.applications.length ? <SmartEmptyState className={styles.empty} title="No active applications yet." description="When you begin pursuing an application-based opportunity in Journey, it will appear here." primaryAction={{ label: "Browse For You", href: "/advisor" }} secondaryAction={{ label: "Open Journey", href: "/" }} /> : <>
        <section className={styles.overview} aria-labelledby="applications-overview-title">
          <div className={styles.overviewCopy}><p className="rule-label">At a glance</p><h2 id="applications-overview-title">{initial.counts.needsAttention ? `${initial.counts.needsAttention} ${initial.counts.needsAttention === 1 ? "application needs" : "applications need"} attention.` : "Your active applications are current."}</h2><p>{initial.deadlines[0] ? `Nearest verified application deadline: ${formatDate(initial.deadlines[0].date)}.` : "No verified application deadlines are currently recorded."}</p></div>
          <dl className={styles.counts}><div><dt>Active</dt><dd>{initial.counts.active}</dd></div><div><dt>Need attention</dt><dd>{initial.counts.needsAttention}</dd></div><div><dt>Ready</dt><dd>{initial.counts.ready}</dd></div><div><dt>Submitted</dt><dd>{initial.counts.submitted}</dd></div></dl>
        </section>

        {initial.attention.length ? <section className={styles.attention} aria-labelledby="applications-attention-title"><header><div><p className="rule-label">Needs attention</p><h2 id="applications-attention-title">What needs doing</h2></div><span>{initial.attention.length} factual {initial.attention.length === 1 ? "item" : "items"}</span></header><ol>{initial.attention.slice(0, 6).map((item) => <li key={item.id}><span data-kind={item.kind} aria-hidden="true">{item.kind === "deadline" || item.kind === "task_due" ? <CalendarIcon /> : <ListIcon />}</span><div><strong>{item.label}</strong><p>{initial.applications.find((application) => application.id === item.applicationId)?.title} · {item.detail}</p></div><Link href={item.href} aria-label={`Review ${item.label}`}><ArrowIcon /></Link></li>)}</ol></section> : null}

        <div className={styles.workspaceGrid}>
          <section className={styles.applications} aria-labelledby="active-applications-title">
            <header><div><p className="rule-label">Application work</p><h2 id="active-applications-title">Active applications</h2></div><div className={styles.filters} role="group" aria-label="Filter applications">{([
              ["attention", "Attention", initial.active.filter((item) => item.state === "needs_attention" || item.attention.length).length],
              ["active", "All active", initial.counts.active],
              ["ready", "Ready", initial.counts.ready],
              ["submitted", "Submitted", initial.counts.submitted],
            ] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); trackProductEvent("application_filter_changed_v1", { control: value }); }}>{label}<span>{count}</span></button>)}</div></header>
            {filtered.length ? <div className={styles.applicationList}>{filtered.map((application) => <ApplicationRow key={application.id} application={application} pending={pending} onCompleteTask={completeTask} onSelectMaterial={selectMaterial} onMarkApplied={markApplied} />)}</div> : <SmartEmptyState compact className={styles.filteredEmpty} title={`No ${filter === "attention" ? "applications need attention" : filter} applications.`} description={filter === "attention" ? "Known requirements and recorded tasks are current." : "Choose another view to review your applications."} />}
          </section>

          <aside className={styles.context} aria-label="Application context">
            <section><header><p className="rule-label">Upcoming</p><Link href="/#journey-calendar">Calendar <ArrowIcon /></Link></header>{initial.deadlineClusters.map((cluster) => <p className={styles.cluster} key={cluster.id}>{cluster.label}</p>)}{initial.deadlines.length ? <ol className={styles.deadlines}>{initial.deadlines.slice(0, 6).map((item) => <li key={item.applicationId}><time dateTime={item.date}><b>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toLocaleUpperCase()}</b><strong>{new Date(`${item.date}T12:00:00Z`).getUTCDate()}</strong></time><div><span>{item.title}</span><small>Application deadline</small></div></li>)}</ol> : <p className={styles.contextEmpty}>No verified deadlines recorded.</p>}</section>
            <section><header><p className="rule-label">Material reuse</p><Link href="/materials">Materials <ArrowIcon /></Link></header>{initial.materials.length ? <ul className={styles.materialDemand}>{initial.materials.slice(0, 6).map((item) => <li key={item.type}><div><strong>{item.label}</strong><span>Needed by {item.applicationCount} {item.applicationCount === 1 ? "application" : "applications"}</span></div><small>{item.selectedCount === item.applicationCount ? "Selected for all" : item.availableCount ? `${item.availableCount} ready to select` : item.missingCount ? `${item.missingCount} missing` : `${item.needsAttentionCount} need review`}</small></li>)}</ul> : <p className={styles.contextEmpty}>No verified reusable-material requirements recorded.</p>}</section>
          </aside>
        </div>
        <p className={styles.disclosure}>Ready means the verified requirements UnlockED knows about are covered and no incomplete application tasks are recorded. Submit through the provider, then mark the application as applied.</p>
      </>}
      {error ? <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => { setError(""); router.refresh(); }}>Refresh</button></div> : null}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  </main>;
}

function ApplicationRow({ application, pending, onCompleteTask, onSelectMaterial, onMarkApplied }: {
  application: ApplicationsWorkspaceApplication;
  pending: string;
  onCompleteTask: (application: ApplicationsWorkspaceApplication, taskId: string) => void;
  onSelectMaterial: (application: ApplicationsWorkspaceApplication, type: string, materialId: string) => void;
  onMarkApplied: (application: ApplicationsWorkspaceApplication) => void;
}) {
  const busy = pending.includes(application.id);
  return <article id={`application-${application.id}`} className={styles.applicationRow} data-state={application.state}>
    <div className={styles.identity}><OrganizationMark organization={application.organization} officialSource={application.officialSource} type="Career" category={application.category} size="sm" /><div><h3>{application.title}</h3><p>{application.organization} · {application.stageLabel}</p></div></div>
    <div className={styles.applicationState}><strong>{application.stateLabel}</strong><span>{application.deadline ? `Application due ${formatDate(application.deadline)}` : "No verified deadline"}</span></div>
    <div className={styles.coverage}><strong>{application.workspace.requirementsVerified ? `${application.coveredRequirementCount} of ${application.verifiedRequirementCount} verified requirements recorded` : "Requirements not verified"}</strong><span>{application.incompleteTaskCount ? `${application.incompleteTaskCount} incomplete ${application.incompleteTaskCount === 1 ? "task" : "tasks"}` : "No incomplete tasks"}</span></div>
    <Link className={styles.rowAction} href={application.commandCenterHref} onClick={() => trackProductEvent("application_command_center_opened_v1", { status: application.state })}>Open <ArrowIcon /></Link>
    <details className={styles.details} onToggle={(event) => { if (event.currentTarget.open) trackProductEvent("application_summary_opened_v1", { status: application.state, category: "application" }); }}><summary>Review requirements, materials, and tasks</summary><div className={styles.detailBody}>
      {application.recentChange ? <p className={styles.change}><strong>{application.recentChange.label}</strong>{application.recentChange.summary}</p> : null}
      <section><h4>Verified materials</h4>{application.workspace.materials.mappedRequirements.length ? <ul>{application.workspace.materials.mappedRequirements.map((requirement) => <li key={requirement.type}><div><strong>{requirement.typeLabel}</strong><span>{requirement.state === "selected" ? `Selected · ${requirement.selected?.title}` : requirement.state === "available" ? "Ready version available" : requirement.state === "needs_attention" ? "Available version needs review" : "Missing"}</span></div>{requirement.state !== "selected" && requirement.candidates.some((candidate) => candidate.status === "ready") ? <select aria-label={`Select ${requirement.typeLabel} for ${application.title}`} defaultValue="" disabled={busy} onChange={(event) => { if (event.target.value) onSelectMaterial(application, requirement.type, event.target.value); }}><option value="">Select version</option>{requirement.candidates.filter((candidate) => candidate.status === "ready").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}{candidate.versionLabel ? ` · ${candidate.versionLabel}` : ""}</option>)}</select> : requirement.state === "missing" ? <Link href={`/materials?type=${requirement.type}`}>Add in Materials</Link> : null}</li>)}</ul> : <p>No reusable materials are mapped to the verified requirements.</p>}</section>
      <section><h4>Requirements and private tasks</h4>{application.workspace.tasks.length ? <ul>{application.workspace.tasks.map((task) => <li key={task.id}><div><strong>{task.title}</strong><span>{task.source === "verified_requirement" ? "Verified requirement" : "Your task"}{task.dueDate ? ` · Due ${formatDate(task.dueDate)}` : ""}</span></div>{task.completed ? <span className={styles.complete}><CheckIcon /> Complete</span> : <button type="button" disabled={busy} aria-busy={pending === `task:${application.id}:${task.id}`} onClick={() => onCompleteTask(application, task.id)}>{pending === `task:${application.id}:${task.id}` ? "Saving…" : "Mark complete"}</button>}</li>)}</ul> : <p>No application tasks recorded.</p>}</section>
      <footer><a href={application.officialSource} target="_blank" rel="noreferrer">Open {application.sourceVerified ? "official application" : "provider source"} <ArrowIcon /></a><Link href={application.commandCenterHref} onClick={() => trackProductEvent("application_command_center_opened_v1", { status: application.state })}>Open Command Center <ArrowIcon /></Link>{application.state === "ready" && application.submission ? <button type="button" disabled={busy} onClick={() => onMarkApplied(application)}>{pending === `submit:${application.id}` ? "Saving…" : "Mark as applied"}</button> : null}</footer>
    </div></details>
  </article>;
}

export function ApplicationsWorkspaceSkeleton() {
  return <main className={styles.page} aria-busy="true"><div className={styles.shell}><div className={styles.heroSkeleton} /><div className={styles.overviewSkeleton} /><div className={styles.listSkeleton} /><span className="sr-only">Loading applications</span></div></main>;
}

export function ApplicationsWorkspaceUnavailable() {
  return <main className={styles.page}><div className={styles.shell}><SmartEmptyState className={styles.empty} title="Applications could not be loaded." description="Your Journey, tasks, and Materials are unchanged. This is a temporary data error." primaryAction={{ label: "Retry", href: "/applications" }} secondaryAction={{ label: "Open Journey", href: "/" }} /></div></main>;
}
