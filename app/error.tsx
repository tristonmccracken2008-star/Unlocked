"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[UnlockED] Unexpected page error", error); }, [error]);
  return <main className="px-5 py-16 sm:px-8 sm:py-24">
    <section className="mx-auto max-w-4xl border-y border-red-700/20 bg-white px-5 py-12 sm:px-10">
      <p className="rule-label text-red-700">Unexpected error</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.03em] sm:text-6xl">Something did not load correctly.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-ink/55">Try again, or return home and reopen your workspace. If this keeps happening, contact UnlockED with the page URL.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={reset} className="min-h-12 bg-forest px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-ink">Try again</button>
        <Link href="/" className="inline-flex min-h-12 items-center justify-center border border-ink/20 px-5 text-xs font-bold uppercase tracking-wider text-ink/65 hover:border-forest hover:text-forest">Return home</Link>
        <Link href="/contact" className="inline-flex min-h-12 items-center justify-center border border-ink/20 px-5 text-xs font-bold uppercase tracking-wider text-ink/65 hover:border-forest hover:text-forest">Contact support</Link>
      </div>
    </section>
  </main>;
}
