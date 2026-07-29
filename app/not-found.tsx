import Link from "next/link";
export default function NotFound() {
  return <main className="px-5 py-16 sm:px-8 sm:py-24">
    <section className="mx-auto max-w-4xl rounded-[1.5rem] border border-ink/15 bg-white px-5 py-12 shadow-soft sm:px-10">
      <p className="rule-label text-forest">Page not found</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.03em] sm:text-6xl">That page is not here.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-ink/55">The link may be old or mistyped. Return home and sign in to open your UnlockED workspace.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">Return home</Link>
      </div>
    </section>
  </main>;
}
