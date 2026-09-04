"use client";

import { useState } from "react";

export function PassportCollectionSave({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save() {
    setState("saving");
    const response = await fetch("/api/passport", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "copy_collection", token }) });
    if (response.status === 401) { window.location.assign(`/join?returnTo=${encodeURIComponent(`/c/${token}`)}`); return; }
    setState(response.ok ? "saved" : "error");
  }
  return <button className="mt-5 min-h-11 rounded-full bg-forest px-4 text-xs font-bold text-white disabled:opacity-60" type="button" onClick={() => void save()} disabled={state === "saving" || state === "saved"}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved to my collections" : state === "error" ? "Try again" : "Copy to my collections"}</button>;
}
