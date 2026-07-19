export default function JourneyLoading() {
  return <main className="min-h-[70vh] bg-[#f6f0e6] px-5 py-14 sm:py-24" aria-busy="true" aria-label="Loading your Journey">
    <div className="mx-auto w-full max-w-[52rem] animate-pulse motion-reduce:animate-none">
      <div className="h-3 w-20 rounded-full bg-forest/12" />
      <div className="mt-5 h-14 w-4/5 max-w-xl rounded-xl bg-ink/8 sm:h-20" />
      <div className="mt-5 h-4 w-3/5 rounded-full bg-ink/8" />
      <div className="mt-14 border-t border-ink/10 pt-12">
        {["w-3/5", "w-4/5", "w-2/3"].map((width) => <div key={width} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 pb-12 sm:grid-cols-[7rem_2.5rem_minmax(0,1fr)]">
          <div className="hidden h-3 w-16 rounded-full bg-ink/8 sm:block" />
          <div className="h-10 w-10 rounded-full bg-forest/10" />
          <div><div className={`h-7 rounded-lg bg-ink/8 ${width}`} /><div className="mt-3 h-3 w-1/2 rounded-full bg-ink/8" /></div>
        </div>)}
      </div>
      <p className="sr-only" role="status" aria-live="polite">Loading your saved opportunities and progress.</p>
    </div>
  </main>;
}
