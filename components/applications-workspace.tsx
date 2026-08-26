"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { trackProductEvent } from "@/data/product-analytics";
import type { ApplicationsWorkspaceApplication, ApplicationsWorkspaceModel } from "@/lib/applications-workspace";
import { ArrowIcon, CalendarIcon, ListIcon } from "./icons";
import { OrganizationMark } from "./organization-logo";
import { SmartEmptyState } from "./smart-empty-state";
import styles from "./applications-workspace.module.css";

type Filter = "attention" | "active" | "ready" | "submitted";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00.000Z`));
}

export function ApplicationsWorkspace({ initial }: { initial: ApplicationsWorkspaceModel }) {
  const [filter, setFilter] = useState<Filter>("attention");
  const filtered = useMemo(() => {
    if (filter === "attention") return initial.active.filter((item) => item.state === "needs_attention" || item.attention.length > 0);
    if (filter === "ready") return initial.ready;
    if (filter === "submitted") return initial.submitted;
    return initial.active;
  }, [filter, initial]);
  useEffect(() => { trackProductEvent("applications_workspace_opened_v1", { status: initial.counts.active ? "active" : "empty" }); }, [initial.counts.active]);

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
            {filtered.length ? <div className={styles.applicationList}>{filtered.map((application) => <ApplicationRow key={application.id} application={application} />)}</div> : <SmartEmptyState compact className={styles.filteredEmpty} title={`No ${filter === "attention" ? "applications need attention" : filter} applications.`} description={filter === "attention" ? "Known requirements and recorded tasks are current." : "Choose another view to review your applications."} />}
          </section>

          <aside className={styles.context} aria-label="Application context">
            <section><header><p className="rule-label">Upcoming</p><Link href="/#journey-calendar">Calendar <ArrowIcon /></Link></header>{initial.deadlineClusters.map((cluster) => <p className={styles.cluster} key={cluster.id}>{cluster.label}</p>)}{initial.deadlines.length ? <ol className={styles.deadlines}>{initial.deadlines.slice(0, 6).map((item) => <li key={item.applicationId}><time dateTime={item.date}><b>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toLocaleUpperCase()}</b><strong>{new Date(`${item.date}T12:00:00Z`).getUTCDate()}</strong></time><div><span>{item.title}</span><small>Application deadline</small></div></li>)}</ol> : <p className={styles.contextEmpty}>No verified deadlines recorded.</p>}</section>
            <section><header><p className="rule-label">Material reuse</p><Link href="/materials">Materials <ArrowIcon /></Link></header>{initial.materials.length ? <ul className={styles.materialDemand}>{initial.materials.slice(0, 6).map((item) => <li key={item.type}><div><strong>{item.label}</strong><span>Needed by {item.applicationCount} {item.applicationCount === 1 ? "application" : "applications"}</span></div><small>{item.selectedCount === item.applicationCount ? "Selected for all" : item.availableCount ? `${item.availableCount} ready to select` : item.missingCount ? `${item.missingCount} missing` : `${item.needsAttentionCount} need review`}</small></li>)}</ul> : <p className={styles.contextEmpty}>No verified reusable-material requirements recorded.</p>}</section>
          </aside>
        </div>
        <p className={styles.disclosure}>Ready means the verified requirements UnlockED knows about are covered and no incomplete application tasks are recorded. Submit through the provider, then mark the application as applied.</p>
      </>}
    </div>
  </main>;
}

function ApplicationRow({ application }: { application: ApplicationsWorkspaceApplication }) {
  return <article id={`application-${application.id}`} className={styles.applicationRow} data-state={application.state}>
    <div className={styles.identity}><OrganizationMark organization={application.organization} officialSource={application.officialSource} type="Career" category={application.category} size="sm" /><div><h3>{application.title}</h3><p>{application.organization} · {application.stageLabel}</p></div></div>
    <div className={styles.applicationState}><strong>{application.stateLabel}</strong><span>{application.deadline ? `Application due ${formatDate(application.deadline)}` : "No verified deadline"}</span></div>
    <div className={styles.coverage}><strong>{application.workspace.requirementsVerified ? `${application.coveredRequirementCount} of ${application.verifiedRequirementCount} verified requirements recorded` : "Requirements not verified"}</strong><span>{application.incompleteTaskCount ? `${application.incompleteTaskCount} incomplete ${application.incompleteTaskCount === 1 ? "task" : "tasks"}` : "No incomplete tasks"}</span></div>
    <Link className={styles.rowAction} href={application.commandCenterHref} onClick={() => trackProductEvent("application_packet_opened_v1", { status: application.state })}>Open packet <ArrowIcon /></Link>
  </article>;
}

export function ApplicationsWorkspaceSkeleton() {
  return <main className={styles.page} aria-busy="true"><div className={styles.shell}><div className={styles.heroSkeleton} /><div className={styles.overviewSkeleton} /><div className={styles.listSkeleton} /><span className="sr-only">Loading applications</span></div></main>;
}

export function ApplicationsWorkspaceUnavailable() {
  return <main className={styles.page}><div className={styles.shell}><SmartEmptyState className={styles.empty} title="Applications could not be loaded." description="Your Journey, tasks, and Materials are unchanged. This is a temporary data error." primaryAction={{ label: "Retry", href: "/applications" }} secondaryAction={{ label: "Open Journey", href: "/" }} /></div></main>;
}
