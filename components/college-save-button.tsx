"use client";

import { useState } from "react";
import { BookmarkIcon, CheckIcon } from "./icons";

export function CollegeSaveButton({ collegeId, initialSaved = false, compact = false }: { collegeId: string; initialSaved?: boolean; compact?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    if (pending) return;
    const next = !saved;
    setPending(true); setError(""); setSaved(next);
    try {
      const response = await fetch("/api/colleges/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collegeId, saved: next }) });
      if (!response.ok) throw new Error("Save failed");
    } catch {
      setSaved(!next); setError("Could not update your saved colleges.");
    } finally { setPending(false); }
  }
  return <div className="relative">
    <button type="button" onClick={toggle} disabled={pending} aria-pressed={saved} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition active:scale-[.98] disabled:opacity-60 ${saved ? "border-forest/20 bg-mint/70 text-forest" : "border-ink/10 bg-white/60 text-ink/65 hover:border-forest/25 hover:text-forest"}`}>
      {saved ? <CheckIcon /> : <BookmarkIcon />}{compact ? (saved ? "Saved" : "Save") : (saved ? "Saved college" : "Save college")}
    </button>
    {error ? <p role="status" className="absolute right-0 top-full mt-1 w-56 text-right text-xs text-red-700">{error}</p> : null}
  </div>;
}
