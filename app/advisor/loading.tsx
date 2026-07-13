export default function Loading() {
  return <main className="min-h-[65vh] px-5 py-14 sm:px-8 sm:py-20" aria-busy="true" aria-live="polite">
    <div className="mx-auto max-w-7xl">
      <p className="rule-label text-forest">For You</p>
      <h1 className="mt-4 max-w-3xl font-editorial text-5xl font-bold leading-tight sm:text-6xl">Preparing your recommendations.</h1>
      <p className="mt-5 max-w-xl text-sm leading-7 text-ink/50">Checking your profile against verified opportunities.</p>
      <div className="mt-12 h-56 animate-pulse rounded-[2rem] bg-white/65 shadow-soft ring-1 ring-ink/6" />
    </div>
  </main>;
}
