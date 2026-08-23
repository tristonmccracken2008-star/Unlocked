"use client";

export default function PlannerError({ reset }: { reset: () => void }) {
  return <main className="px-5 py-16 sm:px-8"><div className="mx-auto max-w-3xl border-y border-ink/10 py-12"><p className="rule-label text-forest">Opportunity Planner</p><h1 className="mt-3 font-editorial text-4xl font-bold">Your plan could not load.</h1><p className="mt-4 text-sm leading-6 text-ink/55">Your Journey and saved dates are unchanged.</p><button type="button" onClick={reset} className="mt-6 min-h-11 rounded-lg bg-forest px-5 text-sm font-bold text-white">Try again</button></div></main>;
}
