"use client";

import { useRef, useState } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";

const issueOptions = [
  ["incorrect_deadline", "Deadline or dates are incorrect"],
  ["incorrect_eligibility", "Eligibility is incorrect"],
  ["incorrect_value", "Value or award is incorrect"],
  ["broken_official_source", "Official source link is broken"],
  ["opportunity_closed", "Opportunity is closed"],
  ["duplicate_listing", "This is a duplicate"],
  ["other", "Something else"],
] as const;

export function ReportOutdatedButton({ opportunityId }: { opportunityId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useRef("");

  async function submit(form: HTMLFormElement) {
    if (pending) return;
    setPending(true);
    setError("");
    requestKey.current ||= `opportunity-report:${crypto.randomUUID()}`;
    const values = new FormData(form);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort("timeout"), 8_000);
    try {
      const response = await authenticatedFetch("/api/opportunities/report", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          opportunityId,
          issue: String(values.get("issue") ?? ""),
          detail: String(values.get("detail") ?? ""),
          idempotencyKey: requestKey.current,
        }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) {
        setError(response.status === 401 ? "Your session ended. Sign in again, then retry." : response.status === 429 ? "You’ve sent several reports recently. Please try again later." : body?.error || "We couldn’t send this report. Try again.");
        return;
      }
      setSent(true);
      setOpen(false);
    } catch {
      setError(controller.signal.reason === "timeout" ? "Sending took too long. Try again." : "We couldn’t reach UnlockED. Try again.");
    } finally {
      window.clearTimeout(timeout);
      setPending(false);
    }
  }

  return <div className="mt-3">
    <button type="button" aria-expanded={open} onClick={() => { setOpen((value) => !value); setError(""); }} className="flex min-h-11 w-full items-center justify-center rounded-xl border border-ink/20 px-4 text-center text-xs font-bold text-ink/60 hover:border-forest hover:text-forest">Report incorrect information</button>
    {open && !sent ? <form className="mt-3 rounded-xl border border-ink/15 bg-paper p-4" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <label className="text-xs font-bold" htmlFor={`report-issue-${opportunityId}`}>What needs attention?</label>
      <select id={`report-issue-${opportunityId}`} name="issue" className="mt-2 min-h-11 w-full rounded-lg border border-ink/20 bg-white px-3 text-sm" required defaultValue="">
        <option value="" disabled>Choose an issue</option>
        {issueOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className="mt-3 block text-xs font-bold" htmlFor={`report-detail-${opportunityId}`}>Details <span className="font-normal text-ink/40">(optional)</span></label>
      <textarea id={`report-detail-${opportunityId}`} name="detail" maxLength={300} rows={3} className="mt-2 w-full rounded-lg border border-ink/20 bg-white p-3 text-sm" placeholder="Briefly tell our reviewers what changed." />
      <button disabled={pending} className="mt-3 min-h-11 w-full rounded-lg bg-ink px-4 text-xs font-bold text-white hover:bg-forest disabled:cursor-wait disabled:opacity-60">{pending ? "Sending…" : "Send report"}</button>
    </form> : null}
    {error ? <p role="alert" className="mt-3 text-xs font-bold leading-5 text-red-700">{error}</p> : null}
    {sent ? <p role="status" className="mt-3 text-xs font-bold leading-5 text-trust">Thank you. Our team will review this listing.</p> : null}
  </div>;
}
