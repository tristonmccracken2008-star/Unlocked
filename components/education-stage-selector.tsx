"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import { educationalStageDetails, educationalStages, type EducationalStage } from "@/lib/education-stages";
import type { AccountData } from "@/lib/account-types";

export function EducationStageSelector({ currentStage = null, mode = "onboarding", onSaved }: {
  currentStage?: EducationalStage | null;
  mode?: "onboarding" | "settings";
  onSaved?: (data: AccountData) => void;
}) {
  const [selected, setSelected] = useState<EducationalStage | null>(currentStage);
  const [editing, setEditing] = useState(mode === "onboarding" || !currentStage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!selected || selected === currentStage || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/account/stage", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: selected }),
      });
      const body = await response.json().catch(() => null) as { data?: AccountData; error?: string } | null;
      if (!response.ok || !body?.data) throw new Error(body?.error ?? "Your educational stage could not be saved.");
      onSaved?.(body.data);
      if (mode === "onboarding") window.location.assign(selected === "undergraduate" ? "/onboarding" : "/");
      else {
        setEditing(false);
        window.location.assign(selected === "undergraduate" && !body.data.onboardingComplete ? "/onboarding" : "/");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your educational stage could not be saved.");
      setSaving(false);
    }
  }

  if (mode === "settings" && currentStage && !editing) {
    return <div className="flex flex-col gap-4 border-y border-ink/12 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-bold text-[var(--unlocked-text)]">Educational stage</p><p className="mt-1 text-sm text-ink/50">{educationalStageDetails[currentStage].label}</p></div>
      <button type="button" onClick={() => setEditing(true)} className="min-h-11 self-start rounded-full border border-ink/15 px-5 text-sm font-bold text-forest transition hover:border-forest hover:bg-forest/[.04] sm:self-auto">Change</button>
    </div>;
  }

  return <div>
    <div role="radiogroup" aria-label="Educational stage" className="divide-y divide-ink/10 border-y border-ink/12">
      {educationalStages.map((stage) => {
        const detail = educationalStageDetails[stage];
        const active = selected === stage;
        return <button key={stage} type="button" role="radio" aria-checked={active} onClick={() => { setSelected(stage); setError(""); }} className={`group flex min-h-[5.5rem] w-full items-center gap-5 px-1 py-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/25 ${active ? "text-forest" : "text-[var(--unlocked-text)] hover:text-forest"}`}>
          <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${active ? "border-forest bg-forest" : "border-ink/20 bg-transparent group-hover:border-forest"}`}><span className={`h-2 w-2 rounded-full bg-white transition-opacity ${active ? "opacity-100" : "opacity-0"}`} /></span>
          <span className="min-w-0 flex-1"><strong className="block font-editorial text-xl font-semibold sm:text-2xl">{detail.label}</strong><span className="mt-1 block text-sm leading-6 text-ink/50">{detail.description}</span></span>
          <span aria-hidden="true" className={`text-lg transition-all ${active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"}`}>→</span>
        </button>;
      })}
    </div>
    {error ? <p role="alert" className="mt-4 text-sm font-bold text-red-700">{error}</p> : null}
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button type="button" disabled={!selected || selected === currentStage || saving} onClick={() => void save()} className="min-h-12 rounded-full bg-forest px-7 text-sm font-bold text-white shadow-[0_10px_24px_rgba(31,95,67,.16)] transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving…" : mode === "onboarding" ? "Continue" : "Confirm change"}</button>
      {mode === "settings" ? <button type="button" disabled={saving} onClick={() => { setSelected(currentStage); setEditing(false); setError(""); }} className="min-h-12 px-4 text-sm font-bold text-ink/45 hover:text-ink">Cancel</button> : null}
    </div>
    {mode === "settings" ? <p className="mt-4 max-w-2xl text-xs leading-5 text-ink/45">Changing stage adapts your UnlockED experience. Your opportunities, applications, experiences, materials, and history are kept.</p> : null}
  </div>;
}
