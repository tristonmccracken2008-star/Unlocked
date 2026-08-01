"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OpportunityListing } from "@/data/opportunity-listing";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent } from "@/data/account-sync";
import { CloseIcon, SearchIcon } from "@/components/icons";
import styles from "./journey-command-center.module.css";
import { DelayedPendingLabel } from "./delayed-pending-label";

type CatalogResponse = { opportunities?: OpportunityListing[]; error?: string };
type AddResponse = { ok?: boolean; duplicate?: boolean; error?: string };
type InitialStage = "saved" | "preparing" | "applied";

function errorFor(status: number, message?: string) {
  if (status === 401) return "Your session ended. Sign in again before changing your Journey.";
  if (status === 403) return "This request could not be verified. Refresh and try again.";
  if (status === 423) return "Another Journey update is still saving. Try again in a moment.";
  return message || "We couldn’t add this opportunity. Nothing changed.";
}

export function JourneyCommandActions({ trackedIds }: { trackedIds: string[] }) {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpportunityListing[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [stage, setStage] = useState<InitialStage>("saved");
  const [note, setNote] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [reminderText, setReminderText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const tracked = new Set(trackedIds);
  const selectedOpportunity = results.find((opportunity) => opportunity.id === selectedId);
  const supportsApplied = selectedOpportunity
    ? selectedOpportunity.type === "Career" || selectedOpportunity.type === "Scholarship" || /competition|challenge|hackathon/i.test(`${selectedOpportunity.category} ${selectedOpportunity.type}`)
    : true;
  const dirty = Boolean(selectedId || note || reminderAt || reminderText || stage !== "saved");

  useEffect(() => {
    const reset = () => {
      requestRef.current?.abort("account-changed");
      dialogRef.current?.close();
      setResults([]);
      setSelectedId("");
      setError("");
      setSaving(false);
      setExporting(false);
    };
    window.addEventListener(accountSessionEvent, reset);
    return () => {
      requestRef.current?.abort("unmounted");
      window.removeEventListener(accountSessionEvent, reset);
    };
  }, []);

  function open() {
    setError("");
    dialogRef.current?.showModal();
    if (!results.length) void search("");
  }

  function close(force = false) {
    if (!force && dirty && !window.confirm("Close without saving this Journey record?")) return;
    dialogRef.current?.close();
    addTriggerRef.current?.focus();
  }

  async function search(nextQuery = query) {
    requestRef.current?.abort("new-search");
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ view: "discover", query: nextQuery.trim(), limit: "16" });
      const response = await fetch(`/api/opportunities?${params}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json().catch(() => null) as CatalogResponse | null;
      if (!response.ok || !body?.opportunities) {
        setError(body?.error || "Opportunity search is temporarily unavailable.");
        return;
      }
      setResults(body.opportunities);
    } catch {
      if (!controller.signal.aborted) setError("We couldn’t reach the opportunity catalog. Try again.");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function add() {
    if (!selectedId || saving || tracked.has(selectedId)) return;
    setSaving(true);
    setError("");
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 8_000);
    try {
      const response = await authenticatedFetch("/api/journey/add", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          opportunityId: selectedId,
          source: "journey",
          initialStage: stage,
          idempotencyKey: `journey-add:${crypto.randomUUID()}`,
          details: {
            notes: note.trim() || undefined,
            reminderAt: reminderAt ? new Date(reminderAt).toISOString() : undefined,
            reminderText: reminderAt ? reminderText.trim() || undefined : undefined,
          },
        }),
      });
      const body = await response.json().catch(() => null) as AddResponse | null;
      if (!response.ok || !body?.ok) {
        setError(errorFor(response.status, body?.error));
        return;
      }
      setSelectedId("");
      setStage("saved");
      setNote("");
      setReminderAt("");
      setReminderText("");
      close(true);
      router.refresh();
    } catch {
      if (controller.signal.reason === "account-changed" || controller.signal.reason === "unmounted") return;
      setError(controller.signal.reason === "timeout" ? "Saving took too long. Nothing changed; try again." : "We couldn’t reach UnlockED. Nothing changed; try again.");
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      setSaving(false);
    }
  }

  async function exportData() {
    if (exporting) return;
    setExporting(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/journey/export", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setError(errorFor(response.status, body?.error || "Your Journey export could not be prepared."));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "unlocked-journey.csv";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setError("We couldn’t reach UnlockED. Try exporting again.");
    } finally {
      setExporting(false);
    }
  }

  return <div className={styles.headerActions} data-journey-command-actions="">
    <div>
      <button ref={addTriggerRef} type="button" className={styles.addButton} onClick={open}>Add opportunity</button>
      <button type="button" className={styles.exportButton} onClick={() => void exportData()} disabled={exporting} aria-busy={exporting ? "true" : undefined} data-action-state={exporting ? "loading" : "idle"}><DelayedPendingLabel pending={exporting} idle="Export data" pendingLabel="Preparing export…" /></button>
    </div>
    {error && !dialogRef.current?.open ? <p role="alert">{error}</p> : null}
    <dialog ref={dialogRef} className={styles.addDialog} aria-labelledby={titleId} onCancel={(event) => { if (saving || dirty) event.preventDefault(); if (!saving) close(); }}>
      <div className={styles.addDialogShell}>
        <header>
          <div><p>Journey</p><h2 id={titleId}>Add an opportunity</h2><span>Search UnlockED’s catalog, then choose where this record begins.</span></div>
          <button type="button" onClick={() => close()} disabled={saving} aria-label="Close Add opportunity"><CloseIcon /></button>
        </header>
        <form className={styles.catalogSearch} onSubmit={(event) => { event.preventDefault(); void search(); }} role="search">
          <SearchIcon />
          <label htmlFor={`${titleId}-search`} className="sr-only">Search the opportunity catalog</label>
          <input id={`${titleId}-search`} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder="Search title or organization" autoComplete="off" />
          <button type="submit" disabled={loading} aria-busy={loading ? "true" : undefined} data-action-state={loading ? "loading" : "idle"}><DelayedPendingLabel pending={loading} idle="Search" pendingLabel="Searching…" /></button>
        </form>
        <div className={styles.catalogResults} aria-busy={loading ? "true" : undefined}>
          {!loading && !results.length ? <p>No catalog opportunities match this search.</p> : results.map((opportunity) => {
            const exists = tracked.has(opportunity.id);
            return <label key={opportunity.id} data-existing={exists ? "true" : undefined}>
              <input type="radio" name="journey-opportunity" value={opportunity.id} checked={selectedId === opportunity.id} disabled={exists} onChange={() => { setSelectedId(opportunity.id); if (stage === "applied" && !(opportunity.type === "Career" || opportunity.type === "Scholarship" || /competition|challenge|hackathon/i.test(`${opportunity.category} ${opportunity.type}`))) setStage("saved"); }} />
              <span><strong>{opportunity.title}</strong><small>{opportunity.organization} · {opportunity.category}</small></span>
              <b>{exists ? "Already in Journey" : "Select"}</b>
            </label>;
          })}
        </div>
        <section className={styles.addDetails} aria-label="Initial Journey details">
          <label>Starting stage<select value={stage} onChange={(event) => setStage(event.target.value as InitialStage)}><option value="saved">Saved</option><option value="preparing">Preparing</option><option value="applied" disabled={!supportsApplied}>Applied</option></select></label>
          <label>Private note <span>Optional</span><textarea value={note} maxLength={1200} rows={2} onChange={(event) => setNote(event.target.value)} /></label>
          <div>
            <label>Reminder <span>Optional</span><input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} /></label>
            {reminderAt ? <label>Reminder note <span>Optional</span><input value={reminderText} maxLength={160} onChange={(event) => setReminderText(event.target.value)} /></label> : null}
          </div>
        </section>
        {error ? <p className={styles.actionError} role="alert">{error}</p> : null}
        <footer><button type="button" onClick={() => close()} disabled={saving}>Cancel</button><button type="button" onClick={() => void add()} disabled={!selectedId || saving || tracked.has(selectedId)}>{saving ? "Adding…" : "Add to Journey"}</button></footer>
      </div>
    </dialog>
  </div>;
}
