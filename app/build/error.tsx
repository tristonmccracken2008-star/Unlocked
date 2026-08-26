"use client";

import Link from "next/link";

export default function BuildError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-[65vh] px-5 py-20 sm:px-8"><section className="mx-auto max-w-2xl border-t border-ink/10 pt-10"><p className="rule-label text-forest">Build</p><h1 className="mt-3 font-editorial text-4xl font-bold text-ink sm:text-5xl">Your materials are still safe.</h1><p className="mt-4 max-w-xl leading-7 text-ink/60">Build could not load this time. Your Experience Bank, resumes, and material records were not changed.</p><div className="mt-8 flex flex-wrap gap-3"><button type="button" className="button button-primary" onClick={reset}>Try again</button><Link href="/applications" className="button button-secondary">Return to Applications</Link></div></section></main>;
}
