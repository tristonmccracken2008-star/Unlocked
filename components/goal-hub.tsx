import Link from "next/link";
import { ArrowIcon } from "./icons";

export type GoalLink = { title: string; href: string; description: string };

export function GoalHub({ icon, title, purpose, links }: { icon: string; title: string; purpose: string; links: GoalLink[] }) {
  return <main className="px-5 py-12 sm:px-8 sm:py-20"><div className="mx-auto max-w-5xl"><nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/35"><Link href="/" className="hover:text-forest">Dashboard</Link><span>/</span><span>{title}</span></nav><header className="mt-12 max-w-3xl"><p className="rule-label text-forest">Student goal · {icon}</p><h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.04em] sm:text-6xl">{title}</h1><p className="mt-6 text-lg leading-8 text-ink/50">{purpose}</p></header><section className="mt-16"><p className="rule-label text-ink/35">Choose where to begin</p><div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">{links.map((item)=><Link key={`${item.title}-${item.href}`} href={item.href} className="group grid gap-4 py-6 sm:grid-cols-[220px_1fr_auto] sm:items-center"><h2 className="font-editorial text-2xl font-bold group-hover:text-forest">{item.title}</h2><p className="text-sm leading-7 text-ink/45">{item.description}</p><ArrowIcon className="h-4 w-4 text-ink/25 group-hover:text-forest"/></Link>)}</div></section></div></main>;
}
