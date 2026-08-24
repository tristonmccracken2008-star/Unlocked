"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto min-h-[70vh] max-w-4xl px-5 py-20 sm:px-8"><p className="rule-label text-forest">Opportunity Paths</p><h1 className="mt-4 font-editorial text-4xl font-bold text-ink">Paths could not be loaded.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-ink/55">Your profile, Journey, and saved opportunities are unchanged.</p><button type="button" onClick={reset} className="mt-7 min-h-11 bg-forest px-5 font-bold text-white">Try again</button></main>;
}
