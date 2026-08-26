"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import {
  applicationMaterialContexts,
  applicationMaterialStatusLabels,
  applicationMaterialTypeLabels,
  applicationMaterialTypes,
  type ApplicationMaterialContext,
  type ApplicationMaterialStatus,
  type ApplicationMaterialType,
} from "@/data/application-materials";
import type { ApplicationMaterialRow, ApplicationMaterialsModel } from "@/lib/application-materials";
import type { GuidanceState } from "@/lib/guidance";
import { MaterialsGuidance } from "@/components/contextual-guidance";
import { ActionButtonLabel, ActionFeedback } from "@/components/action-feedback";
import { ArrowIcon, CheckIcon, ListIcon } from "@/components/icons";
import { SmartEmptyState } from "@/components/smart-empty-state";
import styles from "./application-materials.module.css";

const contextLabels: Record<ApplicationMaterialContext, string> = {
  general: "General",
  finance: "Finance",
  research: "Research",
  software: "Software",
  public_service: "Public service",
  health: "Health",
  humanities: "Humanities",
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function requestError(status: number, fallback?: string) {
  if (status === 401) return "Your session ended. Sign in again before updating Materials.";
  if (status === 403) return "This materials update could not be verified.";
  if (status === 409) return "Materials changed in another tab. Refresh and try again.";
  if (status === 423) return "Another materials update is still saving. Try again in a moment.";
  return fallback || "We couldn’t save this change. Your previous materials are unchanged.";
}

function MaterialForm({ record, pending, onSubmit, onCancel }: {
  record?: ApplicationMaterialRow;
  pending: boolean;
  onSubmit: (value: { type: ApplicationMaterialType; title: string; versionLabel?: string; status: ApplicationMaterialStatus; contexts: ApplicationMaterialContext[]; notes?: string }) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<ApplicationMaterialType>(record?.type ?? "resume");
  const [title, setTitle] = useState(record?.title ?? "");
  const [versionLabel, setVersionLabel] = useState(record?.versionLabel ?? "");
  const [status, setStatus] = useState<ApplicationMaterialStatus>(record?.status === "archived" ? "needs_update" : record?.status ?? "draft");
  const [contexts, setContexts] = useState<ApplicationMaterialContext[]>(record?.contexts ?? ["general"]);
  const [notes, setNotes] = useState(record?.notes ?? "");
  return <form className={styles.form} onSubmit={(event) => { event.preventDefault(); onSubmit({ type, title: title.trim(), versionLabel: versionLabel.trim() || undefined, status, contexts, notes: notes.trim() || undefined }); }}>
    <div className={styles.formGrid}>
      <label>Type<select value={type} disabled={Boolean(record)} onChange={(event) => setType(event.target.value as ApplicationMaterialType)}>{applicationMaterialTypes.map((item) => <option key={item} value={item}>{applicationMaterialTypeLabels[item]}</option>)}</select></label>
      <label>Name<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="General Resume" /></label>
      <label>Version <span>Optional</span><input maxLength={60} value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="2027" /></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as ApplicationMaterialStatus)}>{(["draft", "ready", "needs_update"] as const).map((item) => <option key={item} value={item}>{applicationMaterialStatusLabels[item]}</option>)}</select></label>
    </div>
    <fieldset><legend>Context <span>Optional</span></legend><div className={styles.contexts}>{applicationMaterialContexts.map((item) => <label key={item}><input type="checkbox" checked={contexts.includes(item)} onChange={() => setContexts((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item].slice(0, 4))} />{contextLabels[item]}</label>)}</div></fieldset>
    <label>Private note <span>Optional</span><textarea maxLength={800} value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Where you keep it or what this version is for" /></label>
    <p className={styles.fileNotice}>This saves a record, not a file. Keep the document in your usual storage.</p>
    <div className={styles.formActions}><button type="submit" disabled={pending || !title.trim()} data-action-state={pending ? "loading" : "idle"}><ActionButtonLabel phase={pending ? "pending" : "idle"} idle={record ? "Save changes" : "Add material"} pending="Saving…" /></button>{onCancel ? <button type="button" onClick={onCancel}>Cancel</button> : null}</div>
  </form>;
}

function MaterialRow({ record, pending, onMutate }: { record: ApplicationMaterialRow; pending: string; onMutate: (body: Record<string, unknown>, key: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return <article className={styles.row} id={`material-${record.id}`} data-status={record.status}>
    <div className={styles.identity}><span className={styles.typeMark} aria-hidden="true">{applicationMaterialTypeLabels[record.type].slice(0, 1)}</span><div><h3>{record.title}{record.versionLabel ? <small>{record.versionLabel}</small> : null}</h3><p>{record.typeLabel} · Updated {dateLabel(record.updatedAt)}</p></div></div>
    <div className={styles.contextCopy}>{record.contexts.length ? record.contexts.map((item) => contextLabels[item]).join(" · ") : "No context set"}<small>{record.relevantApplicationCount ? `Relevant to ${record.relevantApplicationCount} active ${record.relevantApplicationCount === 1 ? "application" : "applications"}` : "No verified active requirement"}</small></div>
    <div className={styles.useCopy}><strong>{record.statusLabel}{record.preferred ? " · Preferred" : ""}</strong><span>{record.selectedFor.length ? `Selected for ${record.selectedFor.map((item) => item.title).join(", ")}` : "Not selected for an application"}</span></div>
    <details className={styles.menu}><summary>Manage<span className="sr-only"> {record.title}</span></summary><div>
      {record.status !== "archived" ? <button type="button" onClick={() => setEditing((value) => !value)}>Edit</button> : null}
      {record.status !== "archived" && !record.preferred ? <button type="button" disabled={Boolean(pending)} onClick={() => void onMutate({ action: "set_preferred", materialId: record.id, expectedMaterialVersion: record.version }, `preferred:${record.id}`)}>Make preferred</button> : null}
      <button type="button" disabled={Boolean(pending)} onClick={() => void onMutate({ action: record.status === "archived" ? "restore" : "archive", materialId: record.id, expectedMaterialVersion: record.version }, `archive:${record.id}`)}>{record.status === "archived" ? "Restore" : "Archive"}</button>
      <button type="button" className={styles.danger} onClick={() => setConfirmDelete(true)}>Delete</button>
    </div></details>
    {editing ? <div className={styles.expanded}><MaterialForm record={record} pending={pending === `update:${record.id}`} onCancel={() => setEditing(false)} onSubmit={async (value) => { if (await onMutate({ action: "update", materialId: record.id, expectedMaterialVersion: record.version, ...value }, `update:${record.id}`)) setEditing(false); }} /></div> : null}
    {confirmDelete ? <div className={styles.expanded}><div className={styles.confirm}><div><strong>Delete {record.title}?</strong><p>{record.selectedFor.length ? `It is selected for ${record.selectedFor.length} ${record.selectedFor.length === 1 ? "application" : "applications"}. Historical references will keep its name, but it will no longer count as available.` : "This removes the material record from your account."}</p></div><button type="button" className={styles.dangerButton} disabled={Boolean(pending)} onClick={() => void onMutate({ action: "delete", materialId: record.id, expectedMaterialVersion: record.version, expectedUsageCount: record.selectedFor.length }, `delete:${record.id}`)}>Delete</button><button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button></div></div> : null}
  </article>;
}

function MaterialsSection({ title, records, pending, onMutate }: { title: string; records: ApplicationMaterialRow[]; pending: string; onMutate: (body: Record<string, unknown>, key: string) => Promise<boolean> }) {
  if (!records.length) return null;
  return <section className={styles.section} aria-labelledby={`materials-${title.toLowerCase().replaceAll(" ", "-")}`}><header><h2 id={`materials-${title.toLowerCase().replaceAll(" ", "-")}`}>{title}</h2><span>{records.length}</span></header><div className={styles.rows}>{records.map((record) => <MaterialRow key={record.id} record={record} pending={pending} onMutate={onMutate} />)}</div></section>;
}

export function ApplicationMaterials({ initial, guidance }: { initial: ApplicationMaterialsModel; guidance: GuidanceState }) {
  const addRef = useRef<HTMLDetailsElement | null>(null);
  const [model, setModel] = useState(initial);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { trackProductEvent("materials_page_opened_v1"); }, []);
  async function mutate(body: Record<string, unknown>, key: string) {
    if (pending) return false;
    setPending(key); setError(""); setMessage("");
    try {
      const response = await authenticatedFetch("/api/materials", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, expectedVersion: model.storeVersion }) });
      const payload = await response.json().catch(() => null) as { model?: ApplicationMaterialsModel; error?: string } | null;
      if (!response.ok || !payload?.model) throw Object.assign(new Error(requestError(response.status, payload?.error)), { status: response.status });
      setModel(payload.model);
      setMessage(body.action === "create" ? "Material added." : body.action === "associate" ? "Material selected." : "Materials updated.");
      if (body.action === "create") trackProductEvent("material_created_v1", { category: String(body.type ?? "other") });
      if (body.action === "archive") trackProductEvent("material_archived_v1", { category: "material" });
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : requestError(500)); return false; }
    finally { setPending(""); }
  }
  return <main className={styles.page} data-application-materials="">
    <div className={styles.container}>
      <header className={styles.hero}><div><p className="rule-label">Build</p><h1>Materials</h1><span>Keep names, versions, and application links for assets you store elsewhere.</span></div><details ref={addRef} className={styles.add}><summary>+ Add material</summary><div className={styles.addPanel}><header><strong>Add material</strong><button type="button" onClick={() => { if (addRef.current) addRef.current.open = false; }}>Close</button></header><MaterialForm pending={pending === "create"} onSubmit={async (value) => { if (await mutate({ action: "create", idempotencyKey: crypto.randomUUID(), ...value }, "create") && addRef.current) addRef.current.open = false; }} /></div></details></header>
      <MaterialsGuidance initialState={guidance} hasRecords={Boolean(model.records.length)} />
      {error ? <ActionFeedback message={error} state="error" level="confirmatory" /> : null}{message ? <ActionFeedback message={message} state="success" level="routine" /> : null}
      {!model.records.length ? <SmartEmptyState className={styles.empty} eyebrow="Materials" title="No material records yet." description="Add the name and version of a resume, transcript, essay, or other asset. Your files stay where you keep them." primaryAction={{ label: "Add your first material", onClick: () => { if (addRef.current) addRef.current.open = true; } }} icon={ListIcon} /> : <>
        {model.recurringRequirements.length ? <section className={styles.reuse} aria-labelledby="materials-reuse-heading"><header><p className="rule-label">Across active applications</p><h2 id="materials-reuse-heading">What you can reuse</h2></header><div>{model.recurringRequirements.map((item) => <article key={item.type} data-available={item.available ? "true" : "false"}><span aria-hidden="true">{item.available ? <CheckIcon /> : "—"}</span><div><strong>{item.label}</strong><small>{item.applicationCount} {item.applicationCount === 1 ? "application" : "applications"}</small></div><p>{item.available ? "Available" : `Missing for ${item.missingApplications.join(", ")}`}</p></article>)}</div></section> : null}
        <MaterialsSection title="Ready" records={model.ready} pending={pending} onMutate={mutate} />
        <MaterialsSection title="Needs attention" records={model.needsAttention} pending={pending} onMutate={mutate} />
        <MaterialsSection title="Archived" records={model.archived} pending={pending} onMutate={mutate} />
      </>}
      {model.applications.length ? <section className={styles.applications} aria-labelledby="material-applications-heading"><header><h2 id="material-applications-heading">Active applications</h2><Link href="/applications">View all <ArrowIcon /></Link></header>{model.applications.map((application) => <Link key={application.opportunityId} href={`/applications/${encodeURIComponent(application.opportunityId)}`}><div><strong>{application.title}</strong><span>{application.organization}</span></div><p>{application.readiness.summary}</p><ArrowIcon /></Link>)}</section> : null}
      <p className={styles.disclaimer}>“Ready” reflects your own status. Available materials may still need changes for a program’s exact format or instructions.</p>
    </div>
  </main>;
}

export function MaterialsSkeleton() { return <main className={styles.page} aria-busy="true" aria-label="Loading Materials"><div className={styles.container}><div className={styles.heroSkeleton} /><div className={styles.skeleton} /><div className={styles.skeleton} /></div></main>; }
export function ApplicationMaterialsUnavailable() { return <main className={styles.page}><div className={styles.container}><SmartEmptyState eyebrow="Materials" title="Materials are temporarily unavailable." description="Your saved records are unchanged. Try loading this page again." primaryAction={{ label: "Try again", href: "/materials" }} secondaryAction={{ label: "Return to Journey", href: "/" }} icon={ListIcon} /></div></main>; }
