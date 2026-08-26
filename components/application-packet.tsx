"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationPacketModel, ApplicationPacketRequirement } from "@/lib/application-packet";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import { ArrowIcon, CalendarIcon, CheckIcon, ListIcon } from "./icons";
import { OrganizationMark } from "./organization-logo";
import styles from "./application-packet.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`));
}

function safeError(status: number, fallback?: string) {
  if (status === 401) return "Your session ended. Sign in again before updating this packet.";
  if (status === 403) return "This application could not be verified for your account.";
  if (status === 409) return "This application changed in another tab. Refresh to review the latest version.";
  if (status === 423) return "Another account update is still saving. Try again in a moment.";
  return fallback || "We couldn’t save this update. Your previous state is unchanged.";
}

export function ApplicationPacket({ initial }: { initial: ApplicationPacketModel }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => { trackProductEvent("application_packet_opened_v1", { status: initial.status }); }, [initial.status]);

  async function request(key: string, endpoint: string, body: Record<string, unknown>, success: string) {
    if (pending) return;
    setPending(key); setError(""); setAnnouncement("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await authenticatedFetch(endpoint, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setError(safeError(response.status, payload?.error)); return; }
      setAnnouncement(success);
      router.refresh();
    } catch {
      setError(controller.signal.aborted ? "Saving took too long. Your previous state is unchanged." : "We couldn’t reach UnlockED. Your previous state is unchanged.");
    } finally {
      window.clearTimeout(timeout); setPending("");
    }
  }

  function completeTask(taskId: string) {
    void request(`task:${taskId}`, "/api/journey/application", { action: "set_completion", opportunityId: initial.application.id, expectedVersion: initial.application.workspace.workspaceVersion, taskId, completed: true }, "Application task completed.");
  }

  function selectMaterial(requirement: ApplicationPacketRequirement, materialId: string) {
    if (!requirement.materialType || !materialId) return;
    trackProductEvent("packet_material_selected_v1", { category: requirement.materialType });
    void request(`material:${requirement.id}`, "/api/materials", { action: "associate", expectedVersion: initial.application.workspace.materials.storeVersion, opportunityId: initial.application.id, requirementType: requirement.materialType, materialId }, "Material selected for this application.");
  }

  function markApplied() {
    const submission = initial.application.submission;
    if (!submission) return;
    void request("submit", "/api/journey/transition", { opportunityId: initial.application.id, professionalStageId: submission.professionalStageId, transition: "submit", expectedStatus: submission.expectedStatus, expectedVersion: submission.expectedVersion, idempotencyKey: `packet-submit:${crypto.randomUUID()}`, details: { source: "student_reported" } }, "Application marked as submitted.");
  }

  const nextHref = initial.nextAction.href ?? (initial.nextAction.materialType ? `#requirement-${initial.nextAction.materialType}` : initial.nextAction.taskId ? `#task-${initial.nextAction.taskId}` : "#final-review");
  return <main className={styles.page} data-application-packet>
    <div className={styles.shell}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/applications">Applications</Link><span aria-hidden="true">/</span><span>Application Packet</span></nav>
      <header className={styles.hero}>
        <div className={styles.identity}><OrganizationMark organization={initial.application.organization} officialSource={initial.application.officialSource} type="Career" category={initial.application.category} size="md" /><div><p className="rule-label">Application Packet</p><h1>{initial.application.title}</h1><span>{initial.application.organization} · {initial.application.stageLabel}</span></div></div>
        <div className={styles.deadline}><small>{initial.application.deadline ? "Verified deadline" : "Deadline"}</small><strong>{initial.application.deadline ? formatDate(initial.application.deadline) : "Not verified"}</strong>{initial.application.deadlineDaysRemaining !== undefined && initial.application.deadlineDaysRemaining >= 0 ? <span>{initial.application.deadlineDaysRemaining === 0 ? "Due today" : `${initial.application.deadlineDaysRemaining} days remaining`}</span> : null}</div>
      </header>

      <section className={styles.statusBand} data-state={initial.status} aria-labelledby="packet-status-title"><div><p className="rule-label">Current state</p><h2 id="packet-status-title">{initial.statusLabel}</h2><p>{initial.statusDetail}</p></div><dl><div><dt>Verified requirements</dt><dd>{initial.verifiedRequirementCount || "Unknown"}</dd></div><div><dt>Recorded complete</dt><dd>{initial.verifiedRequirementCount ? `${initial.assembledRequirementCount} of ${initial.verifiedRequirementCount}` : "—"}</dd></div><div><dt>Private tasks left</dt><dd>{initial.personalTasks.filter((item) => !item.completed).length}</dd></div></dl></section>

      {!initial.submitted ? <section className={styles.nextAction} aria-labelledby="packet-next-title"><span aria-hidden="true"><ArrowIcon /></span><div><p className="rule-label">Next action</p><h2 id="packet-next-title">{initial.nextAction.label}</h2><p>{initial.nextAction.reason}</p></div><a href={nextHref} onClick={() => trackProductEvent("packet_next_action_opened_v1", { category: initial.nextAction.kind })}>Continue <ArrowIcon /></a></section> : null}

      {initial.changes.length ? <section className={styles.changes} aria-labelledby="packet-changes-title"><header><p className="rule-label">Provider updates</p><h2 id="packet-changes-title">What changed</h2></header>{initial.changes.map((change) => <article key={change.id}><div><strong>{change.label}</strong><time dateTime={change.detectedAt}>{formatDate(change.detectedAt)}</time></div><p>{change.summary}</p></article>)}</section> : null}

      <div className={styles.contentGrid}>
        <section className={styles.requirements} aria-labelledby="packet-requirements-title">
          <header><div><p className="rule-label">Known requirements</p><h2 id="packet-requirements-title">Application contents</h2></div>{initial.requirementsCheckedAt ? <span>Reviewed {formatDate(initial.requirementsCheckedAt)}</span> : <span>Complete list not verified</span>}</header>
          {initial.requirements.length ? <ol>{initial.requirements.map((requirement) => <RequirementRow key={requirement.id} requirement={requirement} historical={initial.historical} pending={pending} opportunityId={initial.application.id} onSelect={selectMaterial} onComplete={completeTask} />)}</ol> : <div className={styles.unknown}><ListIcon /><div><strong>Requirements not yet verified.</strong><p>Use the official provider page to confirm what this application needs. UnlockED will not guess.</p></div></div>}
          <footer><p>{initial.requirements.length ? "Only requirements supported by current official evidence appear here." : "No verified requirement denominator is shown."}</p>{initial.requirementsSourceUrl ? <a href={initial.requirementsSourceUrl} target="_blank" rel="noreferrer">Review official source <ArrowIcon /></a> : null}</footer>
        </section>

        <aside className={styles.side} aria-label="Packet context">
          {initial.resume ? <section><p className="rule-label">Selected resume</p><h2>{initial.resume.title}</h2><p>{initial.resume.status === "ready" ? "Marked Ready" : initial.resume.status === "historical" ? "Recorded at submission" : "Needs review"}{initial.resume.versionLabel ? ` · ${initial.resume.versionLabel}` : ""}</p><div className={styles.resumeContext} data-state={initial.resume.targetState}>{initial.resume.targetState === "current_opportunity" ? "Created for this opportunity" : initial.resume.targetState === "general" ? "General resume selected" : initial.resume.targetState === "different_target" ? `Created for a different target${initial.resume.targetLabel ? `: ${initial.resume.targetLabel}` : ""}` : "Managed in Materials"}</div>{!initial.historical ? <Link href={initial.resume.reviewHref}>Review in Resume Lab <ArrowIcon /></Link> : null}</section> : <section><p className="rule-label">Resume</p><h2>No resume selected</h2><p>If a resume is required, create or review one in Resume Lab, then select it here.</p><Link href={`/resume-lab?target=${encodeURIComponent(initial.application.id)}`}>Open Resume Lab <ArrowIcon /></Link></section>}
          <section><p className="rule-label">Timing</p><h2>{initial.calendarContext ? "Busy application period" : "Application dates"}</h2>{initial.calendarContext ? <p>{initial.calendarContext.applicationCount} application deadlines fall between {formatDate(initial.calendarContext.start)} and {formatDate(initial.calendarContext.end)}.</p> : <p>No cross-application deadline cluster affects this packet.</p>}<Link href="/#journey-calendar">Open Calendar <CalendarIcon /></Link></section>
        </aside>
      </div>

      {initial.personalTasks.length ? <section className={styles.tasks} aria-labelledby="packet-tasks-title"><header><p className="rule-label">Your preparation</p><h2 id="packet-tasks-title">Private tasks</h2></header><ul>{initial.personalTasks.map((task) => <li id={`task-${task.id}`} key={task.id}><div><strong>{task.title}</strong><span>{task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No date"}</span></div>{task.completed ? <span className={styles.complete}><CheckIcon /> Complete</span> : <button type="button" disabled={Boolean(pending)} onClick={() => completeTask(task.id)}>{pending === `task:${task.id}` ? "Saving…" : "Mark complete"}</button>}</li>)}</ul></section> : null}

      <section id="final-review" className={styles.finalReview} aria-labelledby="packet-review-title"><div><p className="rule-label">Final review</p><h2 id="packet-review-title">Review what UnlockED knows.</h2><p>{initial.submitted ? "This is the factual record associated with your submitted application." : initial.knownItemsNeedingAttention ? `${initial.knownItemsNeedingAttention} known ${initial.knownItemsNeedingAttention === 1 ? "item is" : "items are"} not recorded complete. You can still submit if the provider accepted different materials.` : "Known requirements are assembled. Confirm the provider’s current instructions before submitting."}</p></div><div className={styles.reviewActions}><a className="button button-primary" href={initial.application.officialSource} target="_blank" rel="noreferrer" onClick={() => trackProductEvent("official_application_opened_v1", { source: initial.application.sourceVerified ? "official" : "provider" })}>Open {initial.application.sourceVerified ? "official application" : "provider page"} <ArrowIcon /></a>{!initial.submitted && initial.application.submission ? <button className="button button-secondary" type="button" disabled={Boolean(pending)} onClick={markApplied}>{pending === "submit" ? "Saving…" : "Mark as applied"}</button> : null}</div></section>

      {initial.timeline.length ? <details className={styles.timeline}><summary>Application history <span>{initial.timeline.length}</span></summary><ol>{initial.timeline.map((item) => <li key={item.id}><span /><div><strong>{item.label}</strong><time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time></div></li>)}</ol></details> : null}
      {error ? <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => router.refresh()}>Refresh</button></div> : null}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  </main>;
}

export function ApplicationPacketSkeleton() {
  return <main className={styles.page} aria-busy="true"><div className={styles.shell}><div className={styles.packetSkeletonHero} /><div className={styles.packetSkeletonStatus} /><div className={styles.packetSkeletonContent} /><span className="sr-only">Loading application packet</span></div></main>;
}

export function ApplicationPacketUnavailable({ onRetry }: { onRetry: () => void }) {
  return <main className={styles.page}><div className={styles.shell}><section className={styles.unavailable}><p className="rule-label">Application Packet</p><h1>This packet could not be loaded.</h1><p>Your Journey, Materials, and application history are unchanged. Try loading it again.</p><div><button className="button button-primary" type="button" onClick={onRetry}>Retry</button><Link className="button button-secondary" href="/applications">Back to Applications</Link></div></section></div></main>;
}

function RequirementRow({ requirement, historical, pending, onSelect, onComplete }: { requirement: ApplicationPacketRequirement; historical: boolean; pending: string; opportunityId: string; onSelect: (requirement: ApplicationPacketRequirement, materialId: string) => void; onComplete: (taskId: string) => void }) {
  const selectedTitle = requirement.selected?.title ?? requirement.selectedSnapshot?.title;
  return <li id={requirement.materialType ? `requirement-${requirement.materialType}` : `requirement-${requirement.id}`} data-state={requirement.state}>
    <span className={styles.requirementMark} aria-hidden="true">{requirement.completed && ["assembled", "recorded_complete"].includes(requirement.state) ? <CheckIcon /> : requirement.recentlyAdded ? "!" : "—"}</span>
    <div className={styles.requirementCopy}><strong>{requirement.title}</strong><span>{requirement.recentlyAdded ? "Verified requirement · recently changed" : "Verified requirement"}{requirement.duplicateMaterialType ? " · Review separately from similar requirements" : ""}</span></div>
    <div className={styles.requirementMaterial}><strong>{selectedTitle ?? requirement.materialTypeLabel ?? "External step"}</strong><span>{requirement.stateLabel}{requirement.otherApplicationUseCount ? ` · Selected for ${requirement.otherApplicationUseCount} other ${requirement.otherApplicationUseCount === 1 ? "application" : "applications"}` : ""}</span>{!historical && requirement.materialType && requirement.candidates.length ? <select aria-label={`Select ${requirement.materialTypeLabel} for this application`} value={requirement.selected?.id ?? ""} disabled={Boolean(pending)} onChange={(event) => onSelect(requirement, event.target.value)}><option value="">Choose version</option>{requirement.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}{candidate.versionLabel ? ` · ${candidate.versionLabel}` : ""}{candidate.status !== "ready" ? ` · ${candidate.status === "draft" ? "Draft" : "Needs update"}` : ""}</option>)}</select> : !historical && requirement.materialType && !requirement.candidates.length ? <Link href={`/materials?type=${requirement.materialType}`}>Add in Materials</Link> : null}</div>
    {!historical && !requirement.completed ? <button type="button" disabled={Boolean(pending)} onClick={() => onComplete(requirement.id)}>{pending === `task:${requirement.id}` ? "Saving…" : "Mark complete"}</button> : requirement.completed ? <span className={styles.complete}><CheckIcon /> Recorded</span> : null}
  </li>;
}
