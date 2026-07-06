import type { ReactNode } from "react";

export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <section className="px-5 py-14 sm:px-8 sm:py-20"><div className="mx-auto max-w-3xl"><p className="rule-label text-forest">{eyebrow}</p><h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-0.04em] sm:text-6xl">{title}</h1><p className="mt-6 border-b-2 border-ink pb-8 text-lg leading-8 text-ink/60">{intro}</p><div className="prose-copy mt-0 space-y-8 border-b-2 border-ink bg-white px-1 py-8 sm:px-8">{children}</div></div></section>;
}
