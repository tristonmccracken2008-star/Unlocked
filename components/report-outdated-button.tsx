"use client";

import { useState } from "react";
import { trackProductEvent } from "@/data/product-analytics";

export function ReportOutdatedButton({ opportunityId }: { opportunityId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return <div className="mt-3">
    <button type="button" onClick={() => { setOpen((value) => !value); if (!open) trackProductEvent("report_outdated", { opportunityId }); }} className="flex min-h-11 w-full items-center justify-center border border-ink/20 px-4 text-center text-xs font-bold uppercase tracking-wider text-ink/60">Report outdated information</button>
    {open && !sent ? <form className="mt-3 border border-ink/15 bg-paper p-4" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const reason = String(form.get("reason"));
      const details = String(form.get("details"));
      const subject = encodeURIComponent(`Outdated opportunity: ${opportunityId}`);
      const body = encodeURIComponent(`Opportunity ID: ${opportunityId}\nIssue: ${reason}\n\nDetails:\n${details || "No additional details provided."}`);
      window.location.href = `mailto:support@unlockededu.com?subject=${subject}&body=${body}`;
      setSent(true);
    }}>
      <label className="text-xs font-bold" htmlFor="report-reason">What needs attention?</label>
      <select id="report-reason" name="reason" className="mt-2 min-h-11 w-full border border-ink/20 bg-white px-3 text-sm" required><option>Deadline or dates</option><option>Eligibility</option><option>Offer or value</option><option>Broken official source</option><option>Opportunity ended</option><option>Other</option></select>
      <label className="mt-3 block text-xs font-bold" htmlFor="report-details">Details (optional)</label>
      <textarea id="report-details" name="details" rows={3} className="mt-2 w-full border border-ink/20 bg-white p-3 text-sm" placeholder="Tell our reviewers what changed." />
      <button className="mt-3 min-h-11 w-full bg-ink px-4 text-xs font-bold uppercase tracking-wider text-white">Submit report</button>
    </form> : null}
    {sent ? <p role="status" className="mt-3 text-xs font-bold text-trust">Your email app should open with the report filled in. Review it, then send it to notify UnlockED.</p> : null}
  </div>;
}
