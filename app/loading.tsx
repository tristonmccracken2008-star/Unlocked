export default function JourneyLoading() {
  return <main className="min-h-[70vh] bg-paper px-5 py-14 sm:py-24" aria-busy="true" aria-label="Loading your Journey">
    <div className="mx-auto w-full max-w-6xl animate-pulse motion-reduce:animate-none">
      <div className="h-3 w-20 rounded-full bg-forest/12" />
      <div className="mt-5 h-14 w-4/5 max-w-xl rounded-xl bg-ink/8 sm:h-20" />
      <div className="mt-5 h-4 w-3/5 rounded-full bg-ink/8" />
      <div className="mt-10 grid grid-cols-2 border-y border-ink/10 sm:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-24 border-r border-ink/10 p-4 last:border-r-0"><div className="h-8 w-10 rounded-md bg-forest/10"/><div className="mt-3 h-3 w-24 rounded-full bg-ink/8"/></div>)}
      </div>
      <div className="mt-14">
        <div className="h-9 w-56 rounded-lg bg-ink/8"/>
        <div className="mt-7 border-t border-ink/10">
          {["w-3/5", "w-4/5", "w-2/3"].map((width) => <div key={width} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-b border-ink/10 py-5">
            <div className="h-10 w-10 rounded-lg bg-forest/10" />
            <div><div className={`h-6 rounded-lg bg-ink/8 ${width}`} /><div className="mt-3 h-3 w-1/2 rounded-full bg-ink/8" /></div>
          </div>)}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">Loading your saved opportunities and progress.</p>
    </div>
  </main>;
}
