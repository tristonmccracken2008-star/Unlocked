import Link from "next/link";
import { Logo } from "./logo";
import { GlobalSearch } from "./global-search";

export function Header() {
  const destinations = [["Dashboard","/"],["Get Ahead","/get-ahead"],["Build Your Career","/build-career"],["Save Money","/save-money"],["My University","/university"],["Profile","/profile"]];
  return <header className="border-b border-ink/20 bg-paper">
    <div className="mx-auto grid max-w-7xl gap-x-5 px-5 sm:px-8 md:grid-cols-[auto_minmax(180px,224px)_1fr] md:items-center">
      <Logo className="py-3.5" />
      <div className="pb-3 md:py-2"><GlobalSearch/></div>
      <nav aria-label="Primary navigation" className="scrollbar-none -mx-5 flex overflow-x-auto border-t border-ink/10 px-5 text-[11px] font-bold uppercase tracking-[.08em] sm:-mx-8 sm:px-8 md:mx-0 md:justify-end md:border-t-0 md:px-0">{destinations.map(([label,href])=><Link key={href} href={href} className="flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3.5 text-ink/65 hover:border-gold hover:text-ink md:min-h-14 md:px-2 lg:px-3">{label}</Link>)}</nav>
    </div>
  </header>;
}
