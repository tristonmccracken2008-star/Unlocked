import type { ReactNode } from "react";

export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <section className="px-5 py-10 sm:px-8 sm:py-14"><div className="mx-auto max-w-3xl"><p className="rule-label text-forest">{eyebrow}</p><h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-0.03em] sm:text-5xl">{title}</h1><p className="mt-5 border-b border-ink/20 pb-7 text-lg leading-8 text-ink/60">{intro}</p><div className="prose-copy space-y-8 py-8 sm:px-1">{children}</div></div></section>;
}
