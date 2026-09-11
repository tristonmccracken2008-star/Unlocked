"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { WritingIdea, WritingPrompt, WritingStatus } from "@/data/writing";
import { writingStatusLabels } from "@/data/writing";

export type WritingHomeDocument = {
  id: string;
  promptId: string;
  collegeId?: string;
  title: string;
  status: WritingStatus;
  cycle: string;
  updatedAt: string;
  wordCount: number;
  wordLimit?: number;
  promptType: string;
};
export type WritingHomeInstitution = {
  id: string;
  name: string;
  prompts: WritingPrompt[];
  documents: WritingHomeDocument[];
  coverage?: {
    cycle: string;
    requirementSummary: string;
    sourceUrl: string;
    lastVerified: string;
    verificationStatus: "verified" | "not_yet_verified";
  };
};
type Resource = { title: string; detail: string; href: string; source: string };

export function WritingHome({
  initialVersion,
  documents: initialDocuments,
  ideas: initialIdeas,
  institutions,
  personalPrompts,
  additionalPrompt,
  resources,
  requestedCollegeId,
}: {
  initialVersion: number;
  documents: WritingHomeDocument[];
  ideas: WritingIdea[];
  institutions: WritingHomeInstitution[];
  personalPrompts: WritingPrompt[];
  additionalPrompt?: WritingPrompt;
  resources: Resource[];
  requestedCollegeId?: string;
}) {
  const router = useRouter();
  const [version, setVersion] = useState(initialVersion);
  const [documents] = useState(initialDocuments);
  const [ideas, setIdeas] = useState(initialIdeas);
  const [promptId, setPromptId] = useState(personalPrompts[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [addingIdea, setAddingIdea] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const personal = documents.find((document) => !document.collegeId && document.promptType !== "additional_information");
  const completed = documents.filter((document) => document.status === "final");
  const orderedInstitutions = useMemo(() => [...institutions].sort((a, b) => Number(b.id === requestedCollegeId) - Number(a.id === requestedCollegeId) || a.name.localeCompare(b.name)), [institutions, requestedCollegeId]);

  async function createDocument(selectedPromptId: string) {
    if (!selectedPromptId || pending) return;
    setPending(true);
    setMessage("");
    const key = crypto.randomUUID();
    try {
      const response = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_document", expectedVersion: version, idempotencyKey: key, promptId: selectedPromptId }),
      });
      const data = await response.json() as { error?: string; storeVersion?: number; document?: { id: string } };
      if (!response.ok || !data.document || data.storeVersion === undefined) throw new Error(data.error ?? "Could not create this writing workspace.");
      setVersion(data.storeVersion);
      router.push("/build/writing/" + encodeURIComponent(data.document.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create this writing workspace.");
      setPending(false);
    }
  }

  async function createIdea(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    if (!title || pending) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_idea",
          expectedVersion: version,
          idempotencyKey: crypto.randomUUID(),
          title,
          category: formData.get("category"),
          notes: formData.get("notes"),
        }),
      });
      const data = await response.json() as { error?: string; storeVersion?: number; idea?: WritingIdea };
      if (!response.ok || !data.idea || data.storeVersion === undefined) throw new Error(data.error ?? "Could not save this idea.");
      setIdeas((current) => [data.idea!, ...current]);
      setVersion(data.storeVersion);
      setAddingIdea(false);
      setMessage("Idea saved privately.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this idea.");
    } finally {
      setPending(false);
    }
  }

  async function saveIdea(formData: FormData) {
    const idea = ideas.find((item) => item.id === selectedIdeaId);
    if (!idea || pending) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_idea",
          expectedVersion: version,
          ideaId: idea.id,
          expectedIdeaVersion: idea.version,
          title: formData.get("title"),
          category: formData.get("category"),
          notes: formData.get("notes"),
          storyNotes: {
            happened: formData.get("happened"),
            remember: formData.get("remember"),
            thinking: formData.get("thinking"),
            changed: formData.get("changed"),
            detail: formData.get("detail"),
            whyRemember: formData.get("whyRemember"),
          },
        }),
      });
      const data = await response.json() as { error?: string; storeVersion?: number; idea?: WritingIdea };
      if (!response.ok || !data.idea || data.storeVersion === undefined) throw new Error(data.error ?? "Could not save this idea.");
      setIdeas((current) => current.map((item) => item.id === data.idea!.id ? data.idea! : item));
      setVersion(data.storeVersion);
      setMessage("Idea saved privately.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this idea.");
    } finally {
      setPending(false);
    }
  }

  return <main id="main-content" className="min-h-screen px-5 pb-28 pt-10 sm:px-8 sm:pt-14">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-ink/10 pb-8">
        <div>
          <p className="rule-label text-forest">Build · Private to your account</p>
          <h1 className="mt-3 font-editorial text-5xl font-semibold leading-none sm:text-6xl">Writing</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/50">Develop ideas, write in your own voice, revise with care, and keep every application essay in one place.</p>
        </div>
        <Link href="/build" className="inline-flex min-h-11 items-center text-sm font-bold text-forest">Back to Build →</Link>
      </header>
      {message ? <p role="status" className="mt-4 text-sm font-bold text-forest">{message}</p> : null}

      <section aria-labelledby="personal-statement" className="mt-10">
        <p className="rule-label text-forest">Personal statement</p>
        <h2 id="personal-statement" className="mt-3 font-editorial text-3xl font-semibold">Common Application personal essay</h2>
      {personal ? <DocumentFeature document={personal} /> : <div className="mt-5 grid gap-4 border-y border-ink/10 py-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-xs font-bold text-ink/45">Choose a current-cycle prompt
            <select value={promptId} onChange={(event) => setPromptId(event.target.value)} className="mt-2 block min-h-12 w-full max-w-2xl rounded-xl border border-ink/10 bg-[var(--unlocked-surface)] px-4 text-sm text-ink">
              {personalPrompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.title}</option>)}
            </select>
          </label>
          <button type="button" disabled={pending || !promptId} onClick={() => void createDocument(promptId)} className="min-h-12 rounded-full bg-ink px-5 text-sm font-bold text-white disabled:opacity-50">Start writing</button>
          <p className="text-xs leading-5 text-ink/42 sm:col-span-2">UnlockED shows a concise overview for organization. Confirm the exact wording at the linked official source before drafting.</p>
        </div>}
      </section>

      <section aria-labelledby="supplements" className="mt-12">
        <p className="rule-label text-forest">Supplements</p>
        <h2 id="supplements" className="sr-only">College supplements</h2>
        <div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
          {orderedInstitutions.length ? orderedInstitutions.map((institution) => <InstitutionRow key={institution.id} institution={institution} pending={pending} createDocument={createDocument} />) : <p className="py-6 text-sm text-ink/45">Save a college to organize verified supplements by institution.</p>}
        </div>
      </section>

      <section aria-labelledby="ideas" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="rule-label text-forest">Idea bank</p><h2 id="ideas" className="mt-2 font-editorial text-3xl font-semibold">{ideas.length} saved {ideas.length === 1 ? "idea" : "ideas"}</h2></div>
          <button type="button" onClick={() => setAddingIdea((value) => !value)} className="min-h-11 rounded-full border border-ink/15 px-4 text-sm font-bold text-forest">{addingIdea ? "Close" : "Capture an idea"}</button>
        </div>
        {addingIdea ? <form action={createIdea} className="mt-5 grid gap-4 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5 sm:grid-cols-2">
          <label className="text-xs font-bold text-ink/45">A short name<input required name="title" placeholder="The rainy bus ride" className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white/60 px-3 text-sm text-ink" /></label>
          <label className="text-xs font-bold text-ink/45">Kind of material<select name="category" className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white/60 px-3 text-sm text-ink">{["A conversation","A memory","An unusual interest","A moment of change","A responsibility","A project","A relationship","A place","A question","Something funny","Something ordinary but meaningful"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-xs font-bold text-ink/45 sm:col-span-2">Raw notes<textarea name="notes" placeholder="Capture what you remember. It does not need to sound like an essay." className="mt-2 min-h-28 w-full rounded-xl border border-ink/10 bg-white/60 p-3 text-sm leading-6 text-ink" /></label>
          <button disabled={pending} className="min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-white sm:justify-self-start">Save privately</button>
        </form> : null}
        {ideas.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ideas.slice(0, 9).map((idea) => <button type="button" onClick={() => setSelectedIdeaId(selectedIdeaId === idea.id ? null : idea.id)} key={idea.id} className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5 text-left"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-forest">{idea.category}</p><h3 className="mt-2 font-editorial text-xl font-semibold">{idea.title}</h3><p className="mt-2 line-clamp-3 text-xs leading-5 text-ink/45">{idea.notes || "Ready for reflection when you are."}</p><span className="mt-3 inline-block text-xs font-bold text-forest">{selectedIdeaId === idea.id ? "Close reflection" : "Reflect further"} →</span></button>)}</div> : <p className="mt-5 border-y border-ink/10 py-6 text-sm text-ink/45">Ideas can be ordinary. Save a moment, question, place, responsibility, or detail before deciding whether it belongs in an essay.</p>}
        {selectedIdeaId && ideas.find((item) => item.id === selectedIdeaId) ? <IdeaReflectionForm idea={ideas.find((item) => item.id === selectedIdeaId)!} pending={pending} saveIdea={saveIdea} /> : null}
      </section>

      {completed.length ? <section className="mt-12"><p className="rule-label text-forest">Completed writing</p><div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">{completed.map((document) => <DocumentRow key={document.id} document={document} />)}</div></section> : null}

      <section className="mt-12 border-t border-ink/10 pt-6"><p className="rule-label text-forest">Writing resources</p><h2 className="mt-2 font-editorial text-3xl font-semibold">Guidance from official sources</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">{resources.map((resource) => <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer" className="border-t border-ink/10 pt-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-forest">{resource.source}</p><h3 className="mt-2 font-bold">{resource.title} ↗</h3><p className="mt-2 text-xs leading-5 text-ink/45">{resource.detail}</p></a>)}</div></section>

      {additionalPrompt && !documents.some((document) => document.promptId === additionalPrompt.id) ? <section className="mt-12 border-t border-ink/10 pt-6"><p className="rule-label text-ink/40">Additional information</p><h2 className="mt-2 font-editorial text-2xl font-semibold">Relevant context that does not fit elsewhere</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ink/48">This section is optional. There is no benefit to filling it simply because it exists.</p><button type="button" disabled={pending} onClick={() => void createDocument(additionalPrompt.id)} className="mt-3 min-h-11 text-sm font-bold text-forest">Create only if needed →</button></section> : null}
    </div>
  </main>;
}

function IdeaReflectionForm({ idea, pending, saveIdea }: { idea: WritingIdea; pending: boolean; saveIdea: (formData: FormData) => Promise<void> }) {
  const prompts = [
    ["happened", "What happened?", idea.storyNotes.happened],
    ["remember", "What do you remember most clearly?", idea.storyNotes.remember],
    ["thinking", "What were you thinking at the time?", idea.storyNotes.thinking],
    ["changed", "What changed afterward, if anything?", idea.storyNotes.changed],
    ["detail", "What detail would someone else not know?", idea.storyNotes.detail],
    ["whyRemember", "Why do you still remember this?", idea.storyNotes.whyRemember],
  ] as const;
  return <form action={saveIdea} className="mt-5 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5 sm:p-7">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-bold text-ink/45">Idea title<input name="title" required defaultValue={idea.title} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white/60 px-3 text-sm text-ink" /></label>
      <label className="text-xs font-bold text-ink/45">Category<input name="category" defaultValue={idea.category} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white/60 px-3 text-sm text-ink" /></label>
      <label className="text-xs font-bold text-ink/45 sm:col-span-2">Raw notes<textarea name="notes" defaultValue={idea.notes} className="mt-2 min-h-24 w-full rounded-xl border border-ink/10 bg-white/60 p-3 text-sm leading-6 text-ink" /></label>
      {prompts.map(([name, label, value]) => <label key={name} className="text-xs font-bold text-ink/45">{label}<textarea name={name} defaultValue={value} className="mt-2 min-h-24 w-full rounded-xl border border-ink/10 bg-white/60 p-3 text-sm leading-6 text-ink" /></label>)}
    </div>
    <p className="mt-4 text-xs leading-5 text-ink/42">Answer only what helps. An ordinary detail can matter; no dramatic hardship is required.</p>
    <button disabled={pending} className="mt-4 min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-white">Save reflection</button>
  </form>;
}

function DocumentFeature({ document }: { document: WritingHomeDocument }) {
  return <Link href={"/build/writing/" + encodeURIComponent(document.id)} className="mt-5 grid gap-5 rounded-[1.5rem] bg-ink p-6 text-white sm:grid-cols-[1fr_auto] sm:items-end sm:p-8"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-mint">{writingStatusLabels[document.status]}</p><h3 className="mt-3 font-editorial text-3xl font-semibold">{document.title}</h3><p className="mt-3 text-sm text-white/55">{document.wordCount}{document.wordLimit ? " / " + document.wordLimit : ""} words · Updated {new Date(document.updatedAt).toLocaleDateString()}</p></div><span className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-forest">Continue →</span></Link>;
}
function DocumentRow({ document }: { document: WritingHomeDocument }) {
  return <Link href={"/build/writing/" + encodeURIComponent(document.id)} className="flex items-center justify-between gap-4 py-4"><span><strong className="block text-sm">{document.title}</strong><small className="mt-1 block text-xs text-ink/45">{writingStatusLabels[document.status]} · {document.wordCount}{document.wordLimit ? " / " + document.wordLimit : ""} words</small></span><span className="text-sm font-bold text-forest">Open →</span></Link>;
}
function InstitutionRow({ institution, pending, createDocument }: { institution: WritingHomeInstitution; pending: boolean; createDocument: (promptId: string) => Promise<void> }) {
  return <article className="py-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-editorial text-2xl font-semibold">{institution.name}</h3><p className="mt-2 text-xs text-ink/45">{institution.prompts.length ? institution.prompts.length + " verified current-cycle prompts" : institution.coverage?.requirementSummary ?? "Current prompts are not yet verified."}</p></div><Link href={"/colleges/" + institution.id + "/application"} className="text-xs font-bold text-forest">Application →</Link></div>
    {institution.documents.length ? <div className="mt-4 divide-y divide-ink/10">{institution.documents.map((document) => <DocumentRow key={document.id} document={document} />)}</div> : null}
    {institution.prompts.filter((prompt) => !institution.documents.some((document) => document.promptId === prompt.id)).length ? <div className="mt-4 flex flex-wrap gap-2">{institution.prompts.filter((prompt) => !institution.documents.some((document) => document.promptId === prompt.id)).map((prompt) => <button type="button" disabled={pending} onClick={() => void createDocument(prompt.id)} key={prompt.id} className="min-h-10 rounded-full border border-ink/12 px-3 text-xs font-bold text-forest">{prompt.title} · {prompt.required ? "Required" : "Optional"}</button>)}</div> : null}
    {institution.coverage ? <p className="mt-3 text-xs leading-5 text-amber-800">Current prompt wording is not yet verified. <a href={institution.coverage.sourceUrl} target="_blank" rel="noreferrer" className="font-bold underline">Check the official source ↗</a></p> : null}
  </article>;
}
