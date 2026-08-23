"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { accomplishmentKindLabels, accomplishmentKinds, accomplishmentOutcomeLabels, accomplishmentOutcomes, type AccomplishmentRecord } from "@/data/accomplishments";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import { CloseIcon, PenLineIcon } from "./icons";
import styles from "./accomplishments.module.css";

type FormState = {
  title: string; organization: string; kind: string; outcome: string; outcomeDate: string; startDate: string; endDate: string;
  roleTitle: string; team: string; location: string; projectTitle: string; mentor: string; labOrGroup: string; researchArea: string;
  placement: string; awardAmount: string; description: string; notes: string; skills: string;
};

const emptyForm = (): FormState => ({ title: "", organization: "", kind: "internship", outcome: "completed", outcomeDate: new Date().toISOString().slice(0, 10), startDate: "", endDate: "", roleTitle: "", team: "", location: "", projectTitle: "", mentor: "", labOrGroup: "", researchArea: "", placement: "", awardAmount: "", description: "", notes: "", skills: "" });

function formFrom(record: AccomplishmentRecord): FormState {
  return { ...emptyForm(), title: record.snapshot.title, organization: record.snapshot.organization, kind: record.kind, outcome: record.outcome, outcomeDate: record.outcomeDate, startDate: record.startDate ?? "", endDate: record.endDate ?? "", roleTitle: record.roleTitle ?? "", team: record.team ?? "", location: record.location ?? "", projectTitle: record.projectTitle ?? "", mentor: record.mentor ?? "", labOrGroup: record.labOrGroup ?? "", researchArea: record.researchArea ?? "", placement: record.placement ?? "", awardAmount: record.awardAmount ?? "", description: record.description ?? "", notes: record.notes ?? "", skills: record.skills?.join(", ") ?? "" };
}

export function AccomplishmentsManager({ showTrigger = true }: { showTrigger?: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [record, setRecord] = useState<AccomplishmentRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    trackProductEvent("accomplishment_viewed_v1");
    async function click(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const create = target.closest<HTMLElement>("[data-accomplishment-create]");
      if (create) { setRecord(null); setForm(emptyForm()); setError(""); setConfirmRemove(false); dialog.current?.showModal(); return; }
      const edit = target.closest<HTMLElement>("[data-accomplishment-edit]");
      const id = edit?.dataset.accomplishmentEdit;
      if (!id) return;
      setLoading(true); setError(""); setConfirmRemove(false); dialog.current?.showModal();
      try {
        const response = await authenticatedFetch(`/api/accomplishments?id=${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
        const body = await response.json().catch(() => null) as { ok?: boolean; record?: AccomplishmentRecord; error?: string } | null;
        if (!response.ok || !body?.record) throw new Error(body?.error ?? "The accomplishment could not be loaded.");
        setRecord(body.record); setForm(formFrom(body.record));
      } catch (caught) { setError(caught instanceof Error ? caught.message : "The accomplishment could not be loaded."); }
      finally { setLoading(false); }
    }
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);

  function update(key: keyof FormState, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  function close() { if (!pending) dialog.current?.close(); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError("");
    try {
      const action = record ? "update" : "create";
      const allFields = { ...form, skills: form.skills.split(",").map((item) => item.trim()).filter(Boolean) };
      const { title: _title, organization: _organization, kind: _kind, outcome: _outcome, outcomeDate: _outcomeDate, ...personalFields } = allFields;
      const response = await authenticatedFetch("/api/accomplishments", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id: record?.id, expectedVersion: record?.version, idempotencyKey: `accomplishment:${crypto.randomUUID()}`, fields: derived ? personalFields : allFields }) });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "The accomplishment could not be saved.");
      trackProductEvent(record ? "outcome_recorded_v1" : "manual_accomplishment_added_v1", { source: record?.source ?? "manual" });
      dialog.current?.close(); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The accomplishment could not be saved."); }
    finally { setPending(false); }
  }

  async function remove() {
    if (!record || pending) return;
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setPending(true); setError("");
    try {
      const response = await authenticatedFetch("/api/accomplishments", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", id: record.id, expectedVersion: record.version, idempotencyKey: `accomplishment:${crypto.randomUUID()}` }) });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "The accomplishment could not be removed.");
      dialog.current?.close(); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The accomplishment could not be removed."); }
    finally { setPending(false); }
  }

  const derived = record?.source === "journey";
  return <>
    {showTrigger ? <button type="button" className={styles.addAction} data-accomplishment-create=""><PenLineIcon /> Add accomplishment</button> : null}
    <dialog ref={dialog} className={styles.dialog} onClose={() => { setRecord(null); setError(""); }}>
      <header><div><p>{record ? "Edit record" : "Add accomplishment"}</p><h2>{record ? record.snapshot.title : "Something you’ve done"}</h2></div><button type="button" aria-label="Close" onClick={close}><CloseIcon /></button></header>
      {loading ? <div className={styles.dialogLoading} role="status">Loading record…</div> : <form onSubmit={save}>
        {derived ? <p className={styles.factNote}>Title, organization, outcome, and date come from Journey. Correct those facts from the Journey record.</p> : null}
        <div className={styles.formGrid}>
          <label><span>Type</span><select value={form.kind} disabled={derived} onChange={(event) => update("kind", event.target.value)}>{accomplishmentKinds.map((kind) => <option key={kind} value={kind}>{accomplishmentKindLabels[kind]}</option>)}</select></label>
          <label><span>Outcome</span><select value={form.outcome} disabled={derived} onChange={(event) => update("outcome", event.target.value)}>{accomplishmentOutcomes.map((outcome) => <option key={outcome} value={outcome}>{accomplishmentOutcomeLabels[outcome]}</option>)}</select></label>
          <label className={styles.wide}><span>Title</span><input required maxLength={180} disabled={derived} value={form.title} onChange={(event) => update("title", event.target.value)} /></label>
          <label className={styles.wide}><span>Organization</span><input required maxLength={180} disabled={derived} value={form.organization} onChange={(event) => update("organization", event.target.value)} /></label>
          <label><span>Outcome date</span><input type="date" required disabled={derived} value={form.outcomeDate} onChange={(event) => update("outcomeDate", event.target.value)} /></label>
          <label><span>Role or title <small>Optional</small></span><input maxLength={160} value={form.roleTitle} onChange={(event) => update("roleTitle", event.target.value)} /></label>
          <label><span>Start date <small>Optional</small></span><input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
          <label><span>End date <small>Optional</small></span><input type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
          {form.kind === "internship" ? <><label><span>Team <small>Optional</small></span><input maxLength={160} value={form.team} onChange={(event) => update("team", event.target.value)} /></label><label><span>Location <small>Optional</small></span><input maxLength={160} value={form.location} onChange={(event) => update("location", event.target.value)} /></label></> : null}
          {form.kind === "research" ? <><label><span>Project title <small>Optional</small></span><input maxLength={180} value={form.projectTitle} onChange={(event) => update("projectTitle", event.target.value)} /></label><label><span>Mentor <small>Optional</small></span><input maxLength={160} value={form.mentor} onChange={(event) => update("mentor", event.target.value)} /></label><label><span>Lab or group <small>Optional</small></span><input maxLength={180} value={form.labOrGroup} onChange={(event) => update("labOrGroup", event.target.value)} /></label><label><span>Research area <small>Optional</small></span><input maxLength={180} value={form.researchArea} onChange={(event) => update("researchArea", event.target.value)} /></label></> : null}
          {form.kind === "scholarship" ? <label><span>Award amount <small>Optional</small></span><input maxLength={100} value={form.awardAmount} onChange={(event) => update("awardAmount", event.target.value)} /></label> : null}
          {form.kind === "competition" ? <label><span>Placement or result <small>Optional</small></span><input maxLength={100} value={form.placement} onChange={(event) => update("placement", event.target.value)} /></label> : null}
          <label className={styles.wide}><span>What you did <small>Optional</small></span><textarea maxLength={1500} rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
          <label className={styles.wide}><span>Private notes <small>Optional</small></span><textarea maxLength={2000} rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
          <label className={styles.wide}><span>Skills or areas <small>Optional, comma separated</small></span><input maxLength={500} value={form.skills} onChange={(event) => update("skills", event.target.value)} /></label>
        </div>
        {error ? <p className={styles.formError} role="alert">{error}</p> : null}
        <footer>{record ? <button type="button" className={styles.removeAction} disabled={pending} onClick={() => void remove()}>{confirmRemove ? (derived ? "Confirm hide" : "Confirm remove") : (derived ? "Hide from Accomplishments" : "Remove record")}</button> : <span/>}<div><button type="button" disabled={pending} onClick={close}>Cancel</button><button type="submit" disabled={pending}>{pending ? "Saving…" : "Save record"}</button></div></footer>
      </form>}
    </dialog>
  </>;
}
