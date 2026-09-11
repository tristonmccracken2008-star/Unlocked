"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WritingDocument, WritingIdea, WritingPrompt, WritingStatus } from "@/data/writing";
import { writingStatuses, writingStatusLabels } from "@/data/writing";
import { cuttingSuggestions, reviewWriting, writingWordCount } from "@/lib/writing-review";

type ExperienceContext = { id: string; title: string; organization?: string; role?: string; facts: string[]; accomplishments: string[]; notes?: string };
type CollegeContext = { id: string; name: string; programs: string[]; notes?: string; priorities: string[] };
type SaveResponse = { error?: string; storeVersion?: number; document?: WritingDocument; idea?: WritingIdea };

export function WritingEditor({
  initialStoreVersion,
  initialDocument,
  prompt,
  ideas: initialIdeas,
  experiences,
  relatedWriting,
  college,
}: {
  initialStoreVersion: number;
  initialDocument: WritingDocument;
  prompt: WritingPrompt;
  ideas: WritingIdea[];
  experiences: ExperienceContext[];
  relatedWriting: Array<{ id: string; title: string; status: WritingStatus; updatedAt: string }>;
  college?: CollegeContext;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [ideas, setIdeas] = useState(initialIdeas);
  const [panel, setPanel] = useState<"ideas" | "review" | "research" | "versions" | null>(null);
  const [reviewMode, setReviewMode] = useState<"review" | "cut">("review");
  const [focus, setFocus] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveMessage, setSaveMessage] = useState("Saved");
  const storeVersion = useRef(initialStoreVersion);
  const documentVersion = useRef(initialDocument.version);
  const saving = useRef(false);
  const queued = useRef(false);
  const lastSaved = useRef(JSON.stringify([initialDocument.title, initialDocument.content, initialDocument.status, initialDocument.privateNotes, initialDocument.planningDate]));
  const current = useRef(document);
  current.current = document;
  const words = writingWordCount(document.content);
  const over = prompt.wordLimit ? Math.max(0, words - prompt.wordLimit) : 0;
  const feedback = useMemo(() => reviewMode === "cut" ? cuttingSuggestions(document.content) : reviewWriting(document.content, prompt), [document.content, prompt, reviewMode]);

  const persist = useCallback(async (checkpoint = false) => {
    const draft = current.current;
    const key = JSON.stringify([draft.title, draft.content, draft.status, draft.privateNotes, draft.planningDate]);
    if (!checkpoint && key === lastSaved.current) return;
    if (saving.current) {
      queued.current = true;
      return;
    }
    saving.current = true;
    setSaveState("saving");
    setSaveMessage("Saving…");
    try {
      const response = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_document",
          expectedVersion: storeVersion.current,
          documentId: draft.id,
          expectedDocumentVersion: documentVersion.current,
          title: draft.title,
          content: draft.content,
          status: draft.status,
          privateNotes: draft.privateNotes,
          planningDate: draft.planningDate,
          checkpoint,
        }),
      });
      const data = await response.json() as SaveResponse;
      if (!response.ok || !data.document || data.storeVersion === undefined) throw new Error(data.error ?? "Unable to save.");
      storeVersion.current = data.storeVersion;
      documentVersion.current = data.document.version;
      lastSaved.current = JSON.stringify([data.document.title, data.document.content, data.document.status, data.document.privateNotes, data.document.planningDate]);
      const latest = current.current;
      const latestKey = JSON.stringify([latest.title, latest.content, latest.status, latest.privateNotes, latest.planningDate]);
      setDocument(latestKey === key ? data.document : (value) => ({
        ...value,
        versions: data.document!.versions,
        updatedAt: data.document!.updatedAt,
        version: data.document!.version,
      }));
      setSaveState("saved");
      setSaveMessage(checkpoint ? "Version saved" : "Saved");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Unable to save");
    } finally {
      saving.current = false;
      if (queued.current) {
        queued.current = false;
        void persist();
      }
    }
  }, []);

  useEffect(() => {
    const key = JSON.stringify([document.title, document.content, document.status, document.privateNotes, document.planningDate]);
    if (key === lastSaved.current) return;
    const timeout = window.setTimeout(() => void persist(), 900);
    return () => window.clearTimeout(timeout);
  }, [document.title, document.content, document.status, document.privateNotes, document.planningDate, persist]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void persist(true);
      }
      if (event.key === "Escape" && focus) setFocus(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focus, persist]);

  useEffect(() => {
    const retry = () => {
      if (saveState === "error") void persist();
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [persist, saveState]);

  async function restore(versionId: string) {
    if (!window.confirm("Restore this version? Your current draft will be saved in history first.")) return;
    setSaveState("saving");
    try {
      const response = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_version", expectedVersion: storeVersion.current, documentId: document.id, expectedDocumentVersion: documentVersion.current, versionId }),
      });
      const data = await response.json() as SaveResponse;
      if (!response.ok || !data.document || data.storeVersion === undefined) throw new Error(data.error ?? "Unable to restore this version.");
      storeVersion.current = data.storeVersion;
      documentVersion.current = data.document.version;
      lastSaved.current = JSON.stringify([data.document.title, data.document.content, data.document.status, data.document.privateNotes, data.document.planningDate]);
      setDocument(data.document);
      setSaveState("saved");
      setSaveMessage("Version restored");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Unable to restore");
    }
  }

  async function attachIdea(idea: WritingIdea) {
    const response = await fetch("/api/writing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "attach_idea", expectedVersion: storeVersion.current, documentId: document.id, expectedDocumentVersion: documentVersion.current, ideaId: idea.id }),
    });
    const data = await response.json() as SaveResponse;
    if (!response.ok || !data.document || data.storeVersion === undefined) {
      setSaveState("error");
      setSaveMessage(data.error ?? "Unable to attach this idea.");
      return;
    }
    storeVersion.current = data.storeVersion;
    documentVersion.current = data.document.version;
    setDocument(data.document);
    setSaveMessage("Idea connected");
  }

  async function ideaFromExperience(experience: ExperienceContext) {
    const response = await fetch("/api/writing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_idea",
        expectedVersion: storeVersion.current,
        idempotencyKey: crypto.randomUUID(),
        title: experience.title,
        category: "An experience",
        notes: [experience.role, experience.organization, ...experience.facts, ...experience.accomplishments].filter(Boolean).join("\n"),
        experienceId: experience.id,
      }),
    });
    const data = await response.json() as SaveResponse;
    if (!response.ok || !data.idea || data.storeVersion === undefined) {
      setSaveState("error");
      setSaveMessage(data.error ?? "Unable to save this inspiration.");
      return;
    }
    storeVersion.current = data.storeVersion;
    setIdeas((value) => [data.idea!, ...value]);
    setSaveMessage("Saved to your Idea Bank");
  }

  const shellClass = focus ? "fixed inset-0 z-50 overflow-y-auto bg-[var(--unlocked-bg)] px-4 py-4 sm:px-8" : "min-h-screen px-4 pb-24 pt-6 sm:px-8 sm:pt-8";
  return <main id="main-content" className={shellClass}>
    <div className="mx-auto max-w-[1480px]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          {!focus ? <Link href="/build/writing" className="text-sm font-bold text-forest">Writing</Link> : null}
          {!focus ? <span className="text-ink/25">/</span> : null}
          <input aria-label="Internal essay title" value={document.title} onChange={(event) => setDocument((value) => ({ ...value, title: event.target.value }))} className="min-w-0 max-w-md bg-transparent font-editorial text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-forest/30" />
        </div>
        <div className="flex items-center gap-2">
          {saveState === "error" ? <button type="button" onClick={() => void persist()} className="text-xs font-bold text-red-700">{saveMessage} · Retry</button> : <span role="status" className="text-xs font-bold text-ink/40">{saveMessage}</span>}
          <button type="button" onClick={() => void persist(true)} className="min-h-10 rounded-full border border-ink/10 px-3 text-xs font-bold">Save version</button>
          <button type="button" aria-pressed={focus} onClick={() => setFocus((value) => !value)} className="min-h-10 rounded-full bg-ink px-4 text-xs font-bold text-white">{focus ? "Exit focus" : "Focus mode"}</button>
        </div>
      </header>

      <div className={"grid gap-6 pt-6 " + (panel && !focus ? "xl:grid-cols-[18rem_minmax(0,48rem)_21rem]" : "xl:grid-cols-[18rem_minmax(0,48rem)] xl:justify-center")}>
        <aside className={focus ? "hidden" : ""}>
          <p className="rule-label text-forest">{prompt.institutionName ?? "Common Application"}</p>
          <h1 className="mt-3 font-editorial text-2xl font-semibold">{prompt.title}</h1>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[.12em] text-ink/35">Prompt overview</p>
          <p className="mt-2 text-sm leading-6 text-ink/55">{prompt.text}</p>
          <div className="mt-5 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/45">
            <p>{prompt.required ? "Required" : "Optional"} · {prompt.provider === "common_app" ? "Common App" : prompt.provider === "coalition_scoir" ? "Coalition with Scoir" : "Institution-specific"}</p>
            <p className="mt-1 text-forest">Official source checked for {prompt.cycle}</p>
            <a href={prompt.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-forest">Read exact prompt at official source ↗</a>
          </div>
          <label className="mt-6 block text-xs font-bold text-ink/45">Personal planning date<input type="date" value={document.planningDate ?? ""} onChange={(event) => setDocument((value) => ({ ...value, planningDate: event.target.value || undefined }))} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-[var(--unlocked-surface)] px-3 text-sm text-ink" /></label>
          <label className="mt-4 block text-xs font-bold text-ink/45">Writing status<select value={document.status} onChange={(event) => setDocument((value) => ({ ...value, status: event.target.value as WritingStatus }))} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-[var(--unlocked-surface)] px-3 text-sm text-ink">{writingStatuses.map((status) => <option key={status} value={status}>{writingStatusLabels[status]}</option>)}</select></label>
          {relatedWriting.length ? <div className="mt-6 border-t border-ink/10 pt-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/40">Related writing</p><p className="mt-2 text-xs leading-5 text-ink/45">You have previous writing on a related topic. View it for context; nothing is copied automatically.</p><div className="mt-3 space-y-2">{relatedWriting.map((item) => <Link key={item.id} href={"/build/writing/" + encodeURIComponent(item.id)} className="block text-xs font-bold text-forest">{item.title} · {writingStatusLabels[item.status]}</Link>)}</div></div> : null}
        </aside>

        <section aria-label="Essay editor" className="min-w-0">
          {focus ? <div className="mb-3 flex items-center justify-between gap-3"><p className="truncate text-xs text-ink/45">{prompt.title}</p><WordCount words={words} limit={prompt.wordLimit} over={over} /></div> : null}
          <div className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-[var(--unlocked-surface)] shadow-soft">
            <textarea
              aria-label="Essay draft"
              autoFocus={focus}
              spellCheck
              value={document.content}
              onChange={(event) => setDocument((value) => ({ ...value, content: event.target.value, status: value.status === "not_started" ? "drafting" : value.status }))}
              placeholder="Begin with what you actually want to say…"
              className="min-h-[60vh] w-full resize-y bg-transparent px-6 py-8 font-editorial text-[1.18rem] leading-8 text-ink outline-none placeholder:text-ink/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest/25 sm:min-h-[68vh] sm:px-10 sm:py-10 sm:text-[1.3rem]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-5 py-3">
              <WordCount words={words} limit={prompt.wordLimit} over={over} />
              <div className="flex gap-3 text-xs font-bold text-forest">
                <button type="button" onClick={() => void navigator.clipboard.writeText(document.content)}>Copy</button>
                <button type="button" onClick={() => void navigator.clipboard.writeText(document.content.split(/\n\s*\n/).map((part) => part.replace(/\s+/g, " ").trim()).join("\n\n"))}>Copy plain text</button>
              </div>
            </div>
          </div>
          {!focus ? <div className="mt-4 flex gap-2 overflow-x-auto">
            {(["ideas", "review", "research", "versions"] as const).map((item) => <button key={item} type="button" onClick={() => setPanel(panel === item ? null : item)} aria-pressed={panel === item} className={"min-h-11 shrink-0 rounded-full px-4 text-xs font-bold capitalize " + (panel === item ? "bg-forest text-white" : "border border-ink/10 text-ink/55")}>{item}</button>)}
          </div> : null}
          {!focus ? <label className="mt-5 block text-xs font-bold text-ink/45">Private notes<textarea value={document.privateNotes ?? ""} onChange={(event) => setDocument((value) => ({ ...value, privateNotes: event.target.value }))} placeholder="Questions, revision plans, or reminders that will never be part of the essay." className="mt-2 min-h-24 w-full rounded-xl border border-ink/10 bg-[var(--unlocked-surface)] p-3 text-sm leading-6 text-ink" /></label> : null}
        </section>

        {panel && !focus ? <aside className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5 xl:max-h-[76vh] xl:overflow-y-auto">
          {panel === "ideas" ? <IdeasPanel ideas={ideas} attached={document.ideaIds} experiences={experiences} attachIdea={attachIdea} ideaFromExperience={ideaFromExperience} /> : null}
          {panel === "review" ? <ReviewPanel mode={reviewMode} setMode={setReviewMode} feedback={feedback} hasContent={Boolean(document.content.trim())} /> : null}
          {panel === "research" ? <ResearchPanel college={college} /> : null}
          {panel === "versions" ? <VersionsPanel document={document} restore={restore} /> : null}
        </aside> : null}
      </div>
    </div>
  </main>;
}

function WordCount({ words, limit, over }: { words: number; limit?: number; over: number }) {
  return <p className={"text-xs font-bold " + (over ? "text-red-700" : "text-ink/45")}>{words}{limit ? " / " + limit : ""} words{over ? " · " + over + " over" : ""}</p>;
}
function IdeasPanel({ ideas, attached, experiences, attachIdea, ideaFromExperience }: { ideas: WritingIdea[]; attached: string[]; experiences: ExperienceContext[]; attachIdea: (idea: WritingIdea) => Promise<void>; ideaFromExperience: (experience: ExperienceContext) => Promise<void> }) {
  return <><p className="rule-label text-forest">Your raw material</p><h2 className="mt-2 font-editorial text-2xl font-semibold">Ideas, not essays</h2><p className="mt-2 text-xs leading-5 text-ink/45">Connect a memory or experience for reference. Nothing is turned into prose automatically.</p>
    <div className="mt-4 space-y-3">{ideas.slice(0, 10).map((idea) => <article key={idea.id} className="border-t border-ink/10 pt-3"><strong className="text-sm">{idea.title}</strong><p className="mt-1 text-xs text-ink/45">{idea.category}</p><button type="button" disabled={attached.includes(idea.id)} onClick={() => void attachIdea(idea)} className="mt-2 text-xs font-bold text-forest">{attached.includes(idea.id) ? "Connected" : "Connect to this draft"}</button></article>)}</div>
    {experiences.length ? <div className="mt-7"><p className="rule-label text-ink/40">Experience Bank</p><div className="mt-3 space-y-3">{experiences.map((experience) => <article key={experience.id} className="border-t border-ink/10 pt-3"><strong className="text-sm">{experience.title}</strong><p className="mt-1 text-xs leading-5 text-ink/45">{[experience.role, experience.organization].filter(Boolean).join(" · ")}</p><button type="button" onClick={() => void ideaFromExperience(experience)} className="mt-2 text-xs font-bold text-forest">Use as inspiration</button></article>)}</div></div> : null}
  </>;
}
function ReviewPanel({ mode, setMode, feedback, hasContent }: { mode: "review" | "cut"; setMode: (mode: "review" | "cut") => void; feedback: ReturnType<typeof reviewWriting>; hasContent: boolean }) {
  return <><p className="rule-label text-forest">Revision</p><h2 className="mt-2 font-editorial text-2xl font-semibold">Questions, not scores</h2><div className="mt-4 flex gap-2"><button onClick={() => setMode("review")} className={"min-h-9 rounded-full px-3 text-xs font-bold " + (mode === "review" ? "bg-forest text-white" : "border border-ink/10")}>Review draft</button><button onClick={() => setMode("cut")} className={"min-h-9 rounded-full px-3 text-xs font-bold " + (mode === "cut" ? "bg-forest text-white" : "border border-ink/10")}>Help me cut</button></div>
    <div className="mt-5 space-y-5">{feedback.map((item) => <article key={item.id} className="border-t border-ink/10 pt-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-forest">{item.kind.replaceAll("_", " ")}</p>{item.excerpt ? <blockquote className="mt-2 border-l-2 border-mint pl-3 text-xs italic leading-5 text-ink/55">“{item.excerpt}”</blockquote> : null}<p className="mt-2 text-xs leading-5 text-ink/60">{item.message}</p>{item.question ? <p className="mt-2 text-sm font-semibold leading-5">{item.question}</p> : null}</article>)}</div>
    {hasContent && !feedback.length ? <p className="mt-5 text-sm leading-6 text-ink/50">No focused notes from this check. Read the draft aloud and ask whether each paragraph adds something new.</p> : null}
    {!hasContent ? <p className="mt-5 text-sm leading-6 text-ink/50">Write a little first. Review will point to specific passages without replacing your words.</p> : null}
  </>;
}
function ResearchPanel({ college }: { college?: CollegeContext }) {
  if (!college) return <><p className="rule-label text-forest">Research</p><p className="mt-3 text-sm leading-6 text-ink/50">Institution research appears for college-specific supplements.</p></>;
  return <><p className="rule-label text-forest">Your saved research</p><h2 className="mt-2 font-editorial text-2xl font-semibold">{college.name}</h2>{college.notes ? <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/40">Your notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/60">{college.notes}</p></div> : null}{college.priorities.length ? <div className="mt-4 flex flex-wrap gap-2">{college.priorities.map((item) => <span key={item} className="rounded-full bg-mint/45 px-2 py-1 text-xs font-bold text-forest">{item}</span>)}</div> : null}<div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/40">Reported programs</p><p className="mt-2 text-xs leading-5 text-ink/50">{college.programs.join(" · ")}</p></div><p className="mt-5 text-xs leading-5 text-ink/42">Use only details you have verified. UnlockED does not add college facts to your draft.</p></>;
}
function VersionsPanel({ document, restore }: { document: WritingDocument; restore: (versionId: string) => Promise<void> }) {
  return <><p className="rule-label text-forest">Version history</p><h2 className="mt-2 font-editorial text-2xl font-semibold">Recover earlier writing</h2><article className="mt-4 border-t border-ink/10 pt-3"><strong className="text-sm">Current draft</strong><p className="mt-1 text-xs text-ink/45">{new Date(document.updatedAt).toLocaleString()}</p></article>{[...document.versions].reverse().map((version) => <article key={version.id} className="mt-3 border-t border-ink/10 pt-3"><strong className="text-sm">{writingStatusLabels[version.status]}</strong><p className="mt-1 text-xs text-ink/45">{new Date(version.createdAt).toLocaleString()} · {writingWordCount(version.content)} words</p><button type="button" onClick={() => void restore(version.id)} className="mt-2 text-xs font-bold text-forest">Restore this version</button></article>)}{!document.versions.length ? <p className="mt-4 text-sm leading-6 text-ink/45">Automatic checkpoints appear as the draft changes. Press ⌘S or Ctrl+S to save one now.</p> : null}</>;
}
