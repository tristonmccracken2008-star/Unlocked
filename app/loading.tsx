export default function JourneyLoading() {
  return <main className="min-h-[70vh] bg-paper px-4 py-10 sm:px-6 sm:py-16" aria-busy="true" aria-label="Loading your Journey">
    <div className="unlocked-skeleton mx-auto w-full max-w-[88rem]">
      <div className="flex items-start justify-between gap-6">
        <div className="w-full max-w-xl"><div className="h-12 w-48 rounded-lg bg-ink/8"/><div className="mt-4 h-4 w-4/5 rounded-full bg-ink/8"/></div>
        <div className="hidden gap-3 sm:flex"><div className="h-11 w-36 rounded-lg bg-forest/10"/><div className="h-11 w-28 rounded-lg bg-ink/8"/></div>
      </div>
      <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 rounded-xl border border-ink/10 bg-white/55 p-4"><div className="h-3 w-24 rounded-full bg-forest/10"/><div className="mt-7 h-8 w-24 rounded-md bg-ink/8"/><div className="mt-4 h-3 w-3/4 rounded-full bg-ink/8"/></div>)}
      </div>
      <div className="mt-4 rounded-xl border border-ink/10 bg-white/45">
        <div className="h-12 border-b border-ink/10 p-4"><div className="h-4 w-32 rounded-full bg-ink/8"/></div>
        {[1, 2, 3].map((item) => <div key={item} className="grid h-16 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 border-b border-ink/10 px-4 last:border-0"><div className="h-9 w-9 rounded-lg bg-forest/10"/><div><div className="h-3 w-1/2 rounded-full bg-ink/8"/><div className="mt-2 h-2.5 w-2/3 rounded-full bg-ink/8"/></div></div>)}
      </div>
      <div className="mt-7"><div className="h-6 w-48 rounded-md bg-ink/8"/><div className="mt-5 rounded-xl border border-ink/10 bg-white/45">
        {[1, 2, 3, 4].map((item) => <div key={item} className="grid h-20 grid-cols-[2.5rem_minmax(0,1fr)_6rem] items-center gap-4 border-b border-ink/10 px-4 last:border-0"><div className="h-10 w-10 rounded-lg bg-forest/10"/><div><div className="h-4 w-2/3 rounded-full bg-ink/8"/><div className="mt-2 h-3 w-2/5 rounded-full bg-ink/8"/></div><div className="h-9 rounded-md bg-forest/10"/></div>)}
      </div></div>
      <p className="sr-only" role="status" aria-live="polite">Loading your saved opportunities, deadlines, and progress.</p>
    </div>
  </main>;
}
