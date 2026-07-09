"use client";

import Link from "next/link";
import { Logo } from "./logo";

const version = "v0.1.0";
const links=[["About","/about"],["Help","/help"],["Contact","/contact"],["Privacy","/privacy"],["Terms","/terms"]];
export function Footer(){return <footer className="border-t border-ink/20 bg-paper"><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"><div><Logo/><p className="mt-3 max-w-md text-sm leading-6 text-ink/55">A maintained directory of student opportunities, checked against official sources.</p></div><nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-ink/65">{links.map(([label,href])=><Link key={href} href={href} className="hover:text-forest">{label}</Link>)}</nav></div><div className="mt-7 flex flex-col gap-2 border-t border-ink/15 pt-5 text-xs text-ink/45 sm:flex-row sm:justify-between"><p>© 2026 UnlockED · {version}</p><p>Always confirm current terms with the official provider.</p></div></div></footer>}
