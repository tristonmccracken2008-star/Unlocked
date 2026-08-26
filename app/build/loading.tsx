export default function BuildLoading() {
  return <main className="min-h-[70vh] px-5 py-12 sm:px-8" aria-busy="true" aria-label="Loading Build">
    <div className="mx-auto w-full max-w-[1180px]">
      <div className="h-3 w-16 animate-pulse rounded bg-ink/10 motion-reduce:animate-none" />
      <div className="mt-5 h-20 w-full max-w-3xl animate-pulse rounded-md bg-ink/10 motion-reduce:animate-none" />
      <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded bg-ink/10 motion-reduce:animate-none" />
      <div className="mt-12 h-36 animate-pulse rounded-lg border border-ink/10 bg-white/40 motion-reduce:animate-none" />
      <div className="mt-12 grid gap-8 md:grid-cols-2"><div className="h-52 animate-pulse rounded-lg bg-ink/5 motion-reduce:animate-none" /><div className="h-52 animate-pulse rounded-lg bg-ink/5 motion-reduce:animate-none" /></div>
    </div>
  </main>;
}
