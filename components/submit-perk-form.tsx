"use client";

import { FormEvent, useState } from "react";
import { categories } from "@/data/seed";

type Submission = { name: string; category: string; url: string; school: string; description: string; email: string; submittedAt: string };

export function SubmitPerkForm() {
  const [saved, setSaved] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const submission: Submission = { name: String(data.get("name") || ""), category: String(data.get("category") || ""), url: String(data.get("url") || ""), school: String(data.get("school") || ""), description: String(data.get("description") || ""), email: String(data.get("email") || ""), submittedAt: new Date().toISOString() };
    try {
      const previous = JSON.parse(localStorage.getItem("unlocked-submissions") || "[]") as Submission[];
      localStorage.setItem("unlocked-submissions", JSON.stringify([...previous, submission]));
      console.info("[UnlockED] Perk submission saved locally:", submission);
      form.reset(); setSaved(true);
    } catch (error) { console.error("[UnlockED] Could not save perk submission:", error); }
  }
  return <form onSubmit={submit} className="mt-10 space-y-6 border-y-2 border-ink bg-white p-6 sm:p-8">
    {saved && <div role="status" className="border-l-2 border-trust bg-trust/[.06] p-4 text-sm font-semibold text-trust">Thanks—your submission was saved in this browser for review.</div>}
    <div className="grid gap-5 sm:grid-cols-2"><Field label="Perk name" name="name" placeholder="e.g. Figma for Education" required /><label className="block"><span className="mb-2 block text-sm font-bold">Category</span><select name="category" className="h-12 w-full border border-ink/25 bg-white px-3 outline-none focus:border-forest">{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select></label></div>
    <Field label="Claim URL" name="url" type="url" placeholder="https://..." required />
    <Field label="School or .edu domain" name="school" placeholder="Any school, or example.edu" required />
    <label className="block"><span className="mb-2 block text-sm font-bold">Description</span><textarea name="description" rows={5} required placeholder="What does the perk include, and who is eligible?" className="w-full resize-none border border-ink/25 px-3 py-3 outline-none placeholder:text-ink/30 focus:border-forest" /></label>
    <Field label="Your email (optional)" name="email" type="email" placeholder="you@example.edu" />
    <p className="text-xs leading-5 text-ink/45">Submissions are stored only in this browser for now. Do not include sensitive information.</p>
    <button type="submit" className="min-h-12 w-full bg-ink px-6 py-3 font-bold text-white hover:bg-forest sm:w-auto">Save submission</button>
  </form>;
}

function Field({ label, name, type = "text", placeholder, required = false }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span><input name={name} type={type} placeholder={placeholder} required={required} className="h-12 w-full border border-ink/25 px-3 outline-none placeholder:text-ink/30 focus:border-forest" /></label>;
}
