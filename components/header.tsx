import Link from "next/link";
import { Logo } from "./logo";

export function Header() {
  return <header className="border-b-2 border-ink bg-paper">
    <div className="mx-auto flex max-w-7xl items-stretch justify-between px-5 sm:px-8">
      <Logo className="border-x border-ink/20 px-4 py-3.5 sm:px-6" />
      <nav className="flex items-stretch text-xs font-bold uppercase tracking-wider">
        <Link href="/opportunities" className="hidden items-center border-l border-ink/15 px-5 hover:bg-white sm:flex">All Opportunities</Link>
        <Link href="/submit-perk" className="flex items-center border-x border-ink/15 px-4 hover:bg-ink hover:text-white sm:px-5">Submit</Link>
      </nav>
    </div>
    <nav aria-label="Primary sections" className="mx-auto flex max-w-7xl overflow-x-auto border-t border-ink/15 px-5 text-[11px] font-bold uppercase tracking-wider sm:px-8">{[["Home","/"],["AI","/ai"],["Career","/career"],["Research","/research"],["Scholarships","/scholarships"],["Software","/software"],["Financial","/financial"],["Local","/local"]].map(([label,href])=><Link key={href} href={href} className="shrink-0 border-r border-ink/15 px-4 py-2.5 first:border-l hover:bg-white hover:text-forest">{label}</Link>)}</nav>
  </header>;
}
