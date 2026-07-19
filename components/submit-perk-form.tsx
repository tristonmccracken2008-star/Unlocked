"use client";

import { FormEvent, useState } from "react";
import { categories } from "@/data/seed";

export function SubmitPerkForm() {
  const [prepared, setPrepared] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "Student opportunity");
    const details = [
      `Name: ${name}`,
      `Category: ${String(data.get("category") || "Unknown")}`,
      `Official URL: ${String(data.get("url") || "Not provided")}`,
      `School or domain: ${String(data.get("school") || "Not provided")}`,
      `Submitted by: ${String(data.get("email") || "Not provided")}`,
      "",
      String(data.get("description") || ""),
    ].join("\n");
    window.location.href = `mailto:support@unlockededu.com?subject=${encodeURIComponent(`Opportunity for review: ${name}`)}&body=${encodeURIComponent(details)}`;
    setPrepared(true);
  }
  return <form onSubmit={submit} className="mt-10 space-y-6 border-y-2 border-ink bg-white p-6 sm:p-8">
    {prepared && <div role="status" className="border-l-2 border-trust bg-trust/[.06] p-4 text-sm font-semibold text-trust">Your email app is opening. Review the message and send it to complete your submission.</div>}
    <div className="grid gap-5 sm:grid-cols-2"><Field label="Perk name" name="name" placeholder="e.g. Figma for Education" required /><label className="block"><span className="mb-2 block text-sm font-bold">Category</span><select name="category" className="h-12 w-full border border-ink/25 bg-white px-3 outline-none focus:border-forest">{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select></label></div>
    <Field label="Claim URL" name="url" type="url" placeholder="https://..." required />
    <Field label="School or .edu domain" name="school" placeholder="Any school, or example.edu" required />
    <label className="block"><span className="mb-2 block text-sm font-bold">Description</span><textarea name="description" rows={5} required placeholder="What does the perk include, and who is eligible?" className="w-full resize-none border border-ink/25 px-3 py-3 outline-none placeholder:text-ink/30 focus:border-forest" /></label>
    <Field label="Your email (optional)" name="email" type="email" placeholder="you@example.edu" />
    <p className="text-xs leading-5 text-ink/45">This opens a message to the UnlockED review team. Do not include sensitive information.</p>
    <button type="submit" className="min-h-12 w-full bg-ink px-6 py-3 font-bold text-white hover:bg-forest sm:w-auto">Email for review</button>
  </form>;
}

function Field({ label, name, type = "text", placeholder, required = false }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span><input name={name} type={type} placeholder={placeholder} required={required} className="h-12 w-full border border-ink/25 px-3 outline-none placeholder:text-ink/30 focus:border-forest" /></label>;
}
