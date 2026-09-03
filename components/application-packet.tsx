"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
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
  if (status === 401) return "Your session ended. Sign in again before updating this application.";
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
  const [confirmingSubmission, setConfirmingSubmission] = useState(false);
  useEffect(() => { trackProductEvent("application_packet_opened_v1", { status: initial.status }); }, [initial.status]);

  async function request(key: string, endpoint: string, body: Record<string, unknown>, success: string, refresh = true) {
    if (pending) return false;
    setPending(key); setError(""); setAnnouncement("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await authenticatedFetch(endpoint, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setError(safeError(response.status, payload?.error)); return false; }
      setAnnouncement(success);
      if (refresh) router.refresh();
      return true;
    } catch {
      setError(controller.signal.aborted ? "Saving took too long. Your previous state is unchanged." : "We couldn’t reach UnlockED. Your previous state is unchanged.");
      return false;
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

  async function markApplied() {
    const submission = initial.application.submission;
    if (!submission) return;
    const key = crypto.randomUUID();
    const captured = await request("snapshot", "/api/journey/application", { action: "capture_submission", opportunityId: initial.application.id, expectedVersion: initial.application.workspace.workspaceVersion, idempotencyKey: key }, "Submission packet preserved.", false);
    if (captured) await request("submit", "/api/journey/transition", { opportunityId: initial.application.id, professionalStageId: submission.professionalStageId, transition: "submit", expectedStatus: submission.expectedStatus, expectedVersion: submission.expectedVersion, idempotencyKey: `packet-submit:${key}`, details: { source: "student_reported" } }, "Application marked as submitted.");
  }
  const saveStudio = (key: string, body: Record<string, unknown>, success: string) => request(key, "/api/journey/application", { ...body, opportunityId: initial.application.id, expectedVersion: initial.application.workspace.workspaceVersion }, success);

  const nextHref = initial.nextAction.href ?? (initial.nextAction.materialType ? `#requirement-${initial.nextAction.materialType}` : initial.nextAction.taskId ? `#task-${initial.nextAction.taskId}` : "#final-review");
  return <main className={styles.page} data-application-packet>
    <div className={styles.shell}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/applications">Applications</Link><span aria-hidden="true">/</span><span>Application details</span></nav>
      <header className={styles.hero}>
        <div className={styles.identity}><OrganizationMark organization={initial.application.organization} officialSource={initial.application.officialSource} type="Career" category={initial.application.category} size="md" /><div><p className="rule-label">Application details</p><h1>{initial.application.title}</h1><span>{initial.application.organization} · {initial.application.stageLabel}</span></div></div>
        <div className={styles.deadline}><small>{initial.application.deadline ? "Verified deadline" : "Deadline"}</small><strong>{initial.application.deadline ? formatDate(initial.application.deadline) : "Not verified"}</strong>{initial.application.deadlineDaysRemaining !== undefined && initial.application.deadlineDaysRemaining >= 0 ? <span>{initial.application.deadlineDaysRemaining === 0 ? "Due today" : `${initial.application.deadlineDaysRemaining} days remaining`}</span> : null}</div>
      </header>

      <details className={styles.applicationBrief}><summary>Application brief and sources</summary><dl><div><dt>Eligibility</dt><dd>{initial.brief.eligibility}</dd></div><div><dt>Requirements</dt><dd>{initial.brief.requirementsState}</dd></div><div><dt>Opening date</dt><dd>{initial.brief.openingDate ?? "Not published"}</dd></div><div><dt>Last verified</dt><dd>{initial.brief.lastVerified ? formatDate(initial.brief.lastVerified) : "Unknown"}</dd></div><div><dt>Official source</dt><dd><a href={initial.brief.officialSource} target="_blank" rel="noreferrer">Open provider source</a></dd></div></dl></details>

      <section className={styles.statusBand} data-state={initial.status} aria-labelledby="packet-status-title"><div><p className="rule-label">Current state</p><h2 id="packet-status-title">{initial.statusLabel}</h2><p>{initial.statusDetail}</p></div><dl><div><dt>Verified requirements</dt><dd>{initial.verifiedRequirementCount || "Unknown"}</dd></div><div><dt>Recorded complete</dt><dd>{initial.verifiedRequirementCount ? `${initial.assembledRequirementCount} of ${initial.verifiedRequirementCount}` : "—"}</dd></div><div><dt>Private tasks left</dt><dd>{initial.personalTasks.filter((item) => !item.completed).length}</dd></div></dl></section>

      {!initial.submitted ? <section className={styles.nextAction} aria-labelledby="packet-next-title"><span aria-hidden="true"><ArrowIcon /></span><div><p className="rule-label">Next action</p><h2 id="packet-next-title">{initial.nextAction.label}</h2><p>{initial.nextAction.reason}</p></div><a href={nextHref} onClick={() => trackProductEvent("packet_next_action_opened_v1", { category: initial.nextAction.kind })}>Review next action <ArrowIcon /></a></section> : null}

      {initial.changes.length ? <section className={styles.changes} aria-labelledby="packet-changes-title"><header><p className="rule-label">Provider updates</p><h2 id="packet-changes-title">What changed</h2></header>{initial.changes.map((change) => <article key={change.id}><div><strong>{change.label}</strong><time dateTime={change.detectedAt}>{formatDate(change.detectedAt)}</time></div><p>{change.summary}</p></article>)}</section> : null}

      <div className={styles.contentGrid}>
        <section className={styles.requirements} aria-labelledby="packet-requirements-title">
          <header><div><p className="rule-label">Known requirements</p><h2 id="packet-requirements-title">Application contents</h2></div>{initial.requirementsCheckedAt ? <span>Reviewed {formatDate(initial.requirementsCheckedAt)}</span> : <span>Complete list not verified</span>}</header>
          {initial.requirements.length ? <ol>{initial.requirements.map((requirement) => <RequirementRow key={requirement.id} requirement={requirement} historical={initial.historical} pending={pending} opportunityId={initial.application.id} onSelect={selectMaterial} onComplete={completeTask} />)}</ol> : <div className={styles.unknown}><ListIcon /><div><strong>Requirements not yet verified.</strong><p>Use the official provider page to confirm what this application needs. UnlockED will not guess.</p></div></div>}
          <footer><p>{initial.requirements.length ? "Only requirements supported by current official evidence appear here." : "No verified requirement denominator is shown."}</p>{initial.requirementsSourceUrl ? <a href={initial.requirementsSourceUrl} target="_blank" rel="noreferrer">Review official source <ArrowIcon /></a> : null}</footer>
        </section>

        <aside className={styles.side} aria-label="Application context">
          {initial.resume ? <section><p className="rule-label">Selected resume</p><h2>{initial.resume.title}</h2><p>{initial.resume.status === "ready" ? "Marked Ready" : initial.resume.status === "historical" ? "Recorded at submission" : "Needs review"}{initial.resume.versionLabel ? ` · ${initial.resume.versionLabel}` : ""}</p><div className={styles.resumeContext} data-state={initial.resume.targetState}>{initial.resume.targetState === "current_opportunity" ? "Created for this opportunity" : initial.resume.targetState === "general" ? "General resume selected" : initial.resume.targetState === "different_target" ? `Created for a different target${initial.resume.targetLabel ? `: ${initial.resume.targetLabel}` : ""}` : "Managed in Materials"}</div>{!initial.historical ? <Link href={`${initial.resume.reviewHref}${initial.resume.reviewHref.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(`/applications/${initial.application.id}`)}`}>Review in Resume Lab <ArrowIcon /></Link> : null}</section> : <section><p className="rule-label">Resume</p><h2>No resume selected</h2><p>If a resume is required, create or review one in Resume Lab, then select it here.</p><Link href={`/resume-lab?target=${encodeURIComponent(initial.application.id)}&returnTo=${encodeURIComponent(`/applications/${initial.application.id}`)}`}>Open Resume Lab <ArrowIcon /></Link></section>}
          <section><p className="rule-label">Timing</p><h2>{initial.calendarContext ? "Busy application period" : "Application dates"}</h2>{initial.calendarContext ? <p>{initial.calendarContext.applicationCount} application deadlines fall between {formatDate(initial.calendarContext.start)} and {formatDate(initial.calendarContext.end)}.</p> : <p>No cross-application deadline cluster affects this application.</p>}<Link href="/#journey-calendar">Open Calendar <CalendarIcon /></Link></section>
        </aside>
      </div>

      {initial.requirements.some((requirement) => requirement.materialType === "cover_letter") ? <section className={styles.coverLetter} aria-labelledby="cover-letter-title"><div><p className="rule-label">Cover letter preparation</p><h2 id="cover-letter-title">Build the connection from verified context.</h2><p>Use only reasons that genuinely matter to you. UnlockED does not invent organization praise or enthusiasm.</p></div><dl><div><dt>Opportunity</dt><dd>{initial.application.title}</dd></div><div><dt>Organization</dt><dd>{initial.application.organization}</dd></div><div><dt>Relevant resume</dt><dd>{initial.resume?.title ?? "No resume selected"}</dd></div><div><dt>Official context</dt><dd><a href={initial.application.officialSource} target="_blank" rel="noreferrer">Review provider source</a></dd></div></dl><ol><li>Opening and actual reason for interest</li><li>Relevant experience and confirmed evidence</li><li>Connection to the published opportunity</li><li>Closing points</li></ol><Link href="/materials?type=cover_letter">Open cover-letter versions in Materials <ArrowIcon /></Link></section> : null}

      <section className={styles.writing} aria-labelledby="written-responses-title">
        <header><div><p className="rule-label">Written responses</p><h2 id="written-responses-title">Answer the prompt, truthfully and completely.</h2><p>Verified prompts appear only when an official source publishes them. Add a student-recorded prompt when structured data is unavailable.</p></div><span>{initial.writtenResponses.length} prompt{initial.writtenResponses.length === 1 ? "" : "s"}</span></header>
        {initial.writtenResponses.map((response) => <ResponseEditor key={response.record.id} response={response} pending={pending} onSave={saveStudio} />)}
        {!initial.writtenResponses.length ? <div className={styles.noPrompts}><strong>No written prompts are recorded.</strong><p>This does not mean the application has none. Confirm the official form; UnlockED will not invent questions.</p></div> : null}
        {!initial.historical ? <AddPromptForm pending={pending} onSave={saveStudio} /> : null}
      </section>

      <section className={styles.answerBank} aria-labelledby="answer-bank-title">
        <header><div><p className="rule-label">Build · Answer Bank</p><h2 id="answer-bank-title">Reusable factual stories.</h2><p>Keep the real situation, action, result, and learning—not a canned essay.</p></div><span>{Object.keys(initial.answerBank.records).length} saved</span></header>
        {Object.values(initial.answerBank.records).slice(0, 6).map((story) => <article key={story.id}><strong>{story.title}</strong><span>{story.category}</span><p>{story.action ?? story.situation ?? story.challenge ?? "Story details saved privately."}</p></article>)}
        {!initial.historical ? <AnswerStoryForm pending={pending} onSave={saveStudio} /> : null}
      </section>

      <section id="references" className={styles.references} aria-labelledby="references-title">
        <header><div><p className="rule-label">References</p><h2 id="references-title">Recommendation preparation.</h2><p>{initial.recommendationRequired ? "A recommendation appears in the verified requirements." : "No recommendation requirement is currently verified. Add a contact only if useful."}</p></div><span>Student-reported</span></header>
        {initial.recommenders.map((person) => <article key={person.id}><div><strong>{person.name}</strong><span>{[person.role, person.organization].filter(Boolean).join(" · ") || "Role not recorded"}</span></div><div><strong>{person.status.replaceAll("_", " ")}</strong><span>{person.deadline ? `Deadline ${formatDate(person.deadline)}` : "No deadline recorded"}</span></div></article>)}
        {!initial.historical ? <RecommenderForm pending={pending} onSave={saveStudio} /> : null}
      </section>

      {!initial.historical ? <PrivateNotes initialValue={initial.privateNotes ?? ""} pending={pending} onSave={saveStudio} /> : null}

      {initial.personalTasks.length ? <section className={styles.tasks} aria-labelledby="packet-tasks-title"><header><p className="rule-label">Your preparation</p><h2 id="packet-tasks-title">Private tasks</h2></header><ul>{initial.personalTasks.map((task) => <li id={`task-${task.id}`} key={task.id}><div><strong>{task.title}</strong><span>{task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No date"}</span></div>{task.completed ? <span className={styles.complete}><CheckIcon /> Complete</span> : <button type="button" disabled={Boolean(pending)} onClick={() => completeTask(task.id)}>{pending === `task:${task.id}` ? "Saving…" : "Mark complete"}</button>}</li>)}</ul></section> : null}

      <section id="final-review" className={styles.finalReview} aria-labelledby="packet-review-title"><div><p className="rule-label">Final review</p><h2 id="packet-review-title">{initial.finalReview.readyToSubmit ? "Known requirements are ready." : `${initial.finalReview.items.length} ${initial.finalReview.items.length === 1 ? "thing" : "things"} to review.`}</h2><p>{initial.submitted ? "This is the factual record associated with your submitted application." : initial.finalReview.readyToSubmit ? "Ready means the known required components are prepared—not that selection is predicted. Confirm the provider’s current instructions." : "Resolve factual and required items before the official handoff. Subjective style notes do not block submission."}</p>{initial.finalReview.items.length ? <ul>{initial.finalReview.items.slice(0, 12).map((item, index) => <li key={`${item.category}:${index}`} data-severity={item.severity}><span>{item.category.replace("_", " ")}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></li>)}</ul> : null}</div><div className={styles.reviewActions}><a className="button button-primary" href={initial.application.officialSource} target="_blank" rel="noreferrer" onClick={() => trackProductEvent("official_application_opened_v1", { source: initial.application.sourceVerified ? "official" : "provider" })}>Open {initial.application.sourceVerified ? "official application" : "provider page"} <ArrowIcon /></a>{!initial.submitted && initial.application.submission ? <button className="button button-secondary" type="button" disabled={Boolean(pending)} onClick={() => setConfirmingSubmission(true)}>{pending === "snapshot" || pending === "submit" ? "Preserving packet…" : "Mark as applied"}</button> : null}</div></section>

      {confirmingSubmission ? <div className={styles.confirmOverlay} role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="confirm-submission-title"><p className="rule-label">Submission confirmation</p><h2 id="confirm-submission-title">Preserve this application packet?</h2><p>Use this only after submitting on the provider’s site. Future edits will not change this snapshot.</p><dl><div><dt>Resume</dt><dd>{initial.resume?.title ?? "None selected"}</dd></div><div><dt>Written responses</dt><dd>{initial.writtenResponses.length} saved version{initial.writtenResponses.length === 1 ? "" : "s"}</dd></div><div><dt>Recommenders</dt><dd>{initial.recommenders.length ? initial.recommenders.map((person) => `${person.name} — ${person.status.replaceAll("_", " ")}`).join("; ") : "None recorded"}</dd></div><div><dt>Submission date</dt><dd>{new Date().toLocaleDateString()}</dd></div></dl><div><button type="button" className="button button-primary" onClick={() => void markApplied()}>Preserve and mark applied</button><button type="button" className="button button-secondary" onClick={() => setConfirmingSubmission(false)}>Cancel</button></div></section></div> : null}

      {initial.timeline.length ? <details className={styles.timeline}><summary>Application history <span>{initial.timeline.length}</span></summary><ol>{initial.timeline.map((item) => <li key={item.id}><span /><div><strong>{item.label}</strong><time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time></div></li>)}</ol></details> : null}
      {initial.submissionSnapshots.length ? <details className={styles.timeline}><summary>Submitted application snapshots <span>{initial.submissionSnapshots.length}</span></summary>{[...initial.submissionSnapshots].reverse().map((snapshot) => <article key={snapshot.id}><strong>{new Date(snapshot.createdAt).toLocaleString()}</strong><p>{snapshot.opportunity.title} · {snapshot.materials.length} material version{snapshot.materials.length === 1 ? "" : "s"} · {snapshot.writtenResponses.length} written response version{snapshot.writtenResponses.length === 1 ? "" : "s"} · {snapshot.recommenders.length} recommender record{snapshot.recommenders.length === 1 ? "" : "s"}</p></article>)}</details> : null}
      {error ? <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => router.refresh()}>Refresh</button></div> : null}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  </main>;
}

export function ApplicationPacketSkeleton() {
  return <main className={styles.page} aria-busy="true"><div className={styles.shell}><div className={styles.packetSkeletonHero} /><div className={styles.packetSkeletonStatus} /><div className={styles.packetSkeletonContent} /><span className="sr-only">Loading application details</span></div></main>;
}

export function ApplicationPacketUnavailable({ onRetry }: { onRetry: () => void }) {
  return <main className={styles.page}><div className={styles.shell}><section className={styles.unavailable}><p className="rule-label">Application details</p><h1>This application could not be loaded.</h1><p>Your Journey, Materials, and application history are unchanged. Try loading it again.</p><div><button className="button button-primary" type="button" onClick={onRetry}>Retry</button><Link className="button button-secondary" href="/applications">Back to Applications</Link></div></section></div></main>;
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

type StudioSave = (key: string, body: Record<string, unknown>, success: string) => Promise<boolean | undefined>;

function ResponseEditor({ response, pending, onSave }: { response: ApplicationPacketModel["writtenResponses"][number]; pending: string; onSave: StudioSave }) {
  const [draft, setDraft] = useState(response.record.draft);
  const [previous, setPrevious] = useState<string | null>(null);
  const counts = { words: draft.trim() ? draft.trim().split(/\s+/).length : 0, characters: draft.length };
  function applyPreservingEdit(kind: "concise" | "direct" | "repetition") {
    setPrevious(draft);
    if (kind === "concise") setDraft(draft.replace(/\b(very|really|basically|actually)\b\s*/gi, "").replace(/\s{2,}/g, " "));
    else if (kind === "direct") setDraft(draft.replace(/\b(I think that|I believe that|In my opinion,?)\s*/gi, ""));
    else { const seen = new Set<string>(); setDraft(draft.split(/(?<=[.!?])\s+/).filter((sentence) => { const key = sentence.trim().toLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; }).join(" ")); }
  }
  return <article id={`response-${response.record.id}`} className={styles.responseEditor}>
    <div className={styles.promptContext}><span>{response.record.source === "verified" ? "Verified prompt" : "Student-added prompt"}{response.record.required ? " · Required" : " · Optional"}</span><h3>{response.record.prompt}</h3><div>{response.components.map((component) => <span key={component.label} data-state={component.state}>{component.label} · {component.state.replace("_", " ")}</span>)}</div>{response.storySuggestions.length ? <aside><strong>Potentially relevant stories</strong>{response.storySuggestions.map(({ story, reason }) => <button key={story.id} type="button" onClick={() => setDraft((value) => `${value}${value ? "\n\n" : ""}[Story notes — review before drafting]\n${[story.situation, story.action, story.result, story.learning].filter(Boolean).join("\n")}`)}><span>{story.title}</span><small>{reason}</small></button>)}</aside> : null}</div>
    <div className={styles.draftSurface}><label htmlFor={`draft-${response.record.id}`}>Response draft</label><textarea id={`draft-${response.record.id}`} rows={16} value={draft} onChange={(event) => setDraft(event.target.value)} /><div className={styles.editorFooter}><span>{response.record.wordLimit ? `${counts.words} / ${response.record.wordLimit} words` : `${counts.words} words`}{response.record.characterLimit ? ` · ${counts.characters} / ${response.record.characterLimit} characters` : ` · ${counts.characters} characters`}</span><div><button type="button" onClick={() => applyPreservingEdit("concise")}>Make concise</button><button type="button" onClick={() => applyPreservingEdit("direct")}>Make direct</button><button type="button" onClick={() => applyPreservingEdit("repetition")}>Reduce repetition</button>{previous !== null ? <button type="button" onClick={() => { setDraft(previous); setPrevious(null); }}>Undo</button> : null}</div></div><div className={styles.responseActions}><button className="button button-secondary" type="button" disabled={Boolean(pending)} onClick={() => void onSave(`response:${response.record.id}`, { action: "save_response", responseId: response.record.id, expectedResponseVersion: response.record.version, draft, status: "draft" }, "Written response saved.")}>Save draft</button><button className="button button-primary" type="button" disabled={Boolean(pending) || !draft.trim()} onClick={() => void onSave(`response:${response.record.id}`, { action: "save_response", responseId: response.record.id, expectedResponseVersion: response.record.version, draft, status: "ready" }, "Written response marked Ready.")}>Mark ready</button></div></div>
    <aside className={styles.writingReview}><strong>Writing review</strong>{response.findings.length ? response.findings.slice(0, 8).map((finding) => <div key={finding.id} data-severity={finding.severity}><span>{finding.category.replace("_", " ")}</span><b>{finding.title}</b><p>{finding.detail}</p></div>) : <p>No known limit, coverage, or factual-integrity issues in the saved draft. Review it yourself before submission.</p>}</aside>
  </article>;
}

function AddPromptForm({ pending, onSave }: { pending: string; onSave: StudioSave }) {
  const [open, setOpen] = useState(false); const [prompt, setPrompt] = useState(""); const [required, setRequired] = useState(true); const [limitType, setLimitType] = useState("words"); const [limit, setLimit] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); const ok = await onSave("prompt:new", { action: "add_prompt", idempotencyKey: crypto.randomUUID(), prompt, source: "student", required, wordLimit: limitType === "words" ? Number(limit) || undefined : undefined, characterLimit: limitType === "characters" ? Number(limit) || undefined : undefined }, "Student-added prompt saved."); if (ok) { setPrompt(""); setLimit(""); setOpen(false); } }
  return <div className={styles.addPanel}>{!open ? <button type="button" onClick={() => setOpen(true)}>+ Add a prompt from the official form</button> : <form onSubmit={(event) => void submit(event)}><p>This will be labeled student-added, not provider-verified.</p><label>Prompt text<textarea required rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label><div><label>Limit type<select value={limitType} onChange={(event) => setLimitType(event.target.value)}><option value="words">Words</option><option value="characters">Characters</option></select></label><label>Published limit <input type="number" min="1" value={limit} onChange={(event) => setLimit(event.target.value)} /></label></div><label className={styles.inlineCheck}><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} /> Required on the form</label><div><button className="button button-primary" disabled={Boolean(pending)}>Save prompt</button><button type="button" onClick={() => setOpen(false)}>Cancel</button></div></form>}</div>;
}

function RecommenderForm({ pending, onSave }: { pending: string; onSave: StudioSave }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [role, setRole] = useState(""); const [organization, setOrganization] = useState(""); const [email, setEmail] = useState(""); const [relationship, setRelationship] = useState(""); const [deadline, setDeadline] = useState(""); const [status, setStatus] = useState("planning");
  async function submit(event: FormEvent) { event.preventDefault(); const ok = await onSave("recommender:new", { action: "add_recommender", idempotencyKey: crypto.randomUUID(), name, role, organization, email, relationship, deadline, status }, "Recommender recorded."); if (ok) { setName(""); setOpen(false); } }
  return <div className={styles.addPanel}>{!open ? <button type="button" onClick={() => setOpen(true)}>+ Add recommender</button> : <form onSubmit={(event) => void submit(event)}><div><label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Role or title<input value={role} onChange={(event) => setRole(event.target.value)} /></label><label>Organization<input value={organization} onChange={(event) => setOrganization(event.target.value)} /></label><label>Email <span>optional</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Relationship or context<input value={relationship} onChange={(event) => setRelationship(event.target.value)} /></label><label>Student-reported status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="planning">Planning to ask</option><option value="not_requested">Not requested</option><option value="requested">Requested</option><option value="confirmed">Confirmed</option><option value="submitted">Submitted</option><option value="unknown">Unknown</option><option value="declined">Declined</option></select></label><label>Deadline <span>if known</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div><p>UnlockED never treats this as provider-confirmed submission.</p><button className="button button-primary" disabled={Boolean(pending)}>Save recommender</button><button type="button" onClick={() => setOpen(false)}>Cancel</button></form>}</div>;
}

function AnswerStoryForm({ pending, onSave }: { pending: string; onSave: StudioSave }) {
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(""); const [category, setCategory] = useState("leadership"); const [situation, setSituation] = useState(""); const [actionText, setActionText] = useState(""); const [result, setResult] = useState(""); const [learning, setLearning] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); const ok = await onSave("story:new", { action: "save_answer_story", idempotencyKey: crypto.randomUUID(), title, category, experienceIds: [], situation, actionText, result, learning }, "Story saved to Answer Bank."); if (ok) { setTitle(""); setOpen(false); } }
  return <div className={styles.addPanel}>{!open ? <button type="button" onClick={() => setOpen(true)}>+ Save a factual story</button> : <form onSubmit={(event) => void submit(event)}><div><label>Story title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Story type<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="leadership">Leadership</option><option value="challenge">Difficult problem</option><option value="teamwork">Teamwork</option><option value="research">Research interest</option><option value="service">Community or service</option><option value="technical">Technical challenge</option><option value="motivation">Personal motivation</option><option value="custom">Custom</option></select></label></div><label>Situation or context<textarea rows={2} value={situation} onChange={(event) => setSituation(event.target.value)} /></label><label>What you actually did<textarea required rows={3} value={actionText} onChange={(event) => setActionText(event.target.value)} /></label><label>Result <span>only if known</span><textarea rows={2} value={result} onChange={(event) => setResult(event.target.value)} /></label><label>What you learned <span>optional</span><textarea rows={2} value={learning} onChange={(event) => setLearning(event.target.value)} /></label><button className="button button-primary" disabled={Boolean(pending)}>Save to Answer Bank</button><button type="button" onClick={() => setOpen(false)}>Cancel</button></form>}</div>;
}

function PrivateNotes({ initialValue, pending, onSave }: { initialValue: string; pending: string; onSave: StudioSave }) {
  const [notes, setNotes] = useState(initialValue);
  return <section className={styles.notes}><div><p className="rule-label">Private notes</p><h2>Application notes</h2><p>Visible only in your authenticated application workspace and excluded from search and analytics.</p></div><label>Notes<textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button type="button" className="button button-secondary" disabled={Boolean(pending)} onClick={() => void onSave("notes", { action: "save_notes", notes }, "Private notes saved.")}>Save notes</button></section>;
}
