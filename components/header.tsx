import Link from "next/link";
import { Logo } from "./logo";

export function Header() {
  const destinations = [["Dashboard","/"],["Get Ahead","/get-ahead"],["Build Your Career","/build-career"],["Save Money","/save-money"],["My University","/university"],["Profile","/profile"]];
  return <header className="border-b border-ink/20 bg-paper">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
      <Logo className="py-3.5" />
      <nav aria-label="Primary navigation" className="scrollbar-none hidden overflow-x-auto text-[11px] font-bold uppercase tracking-[.08em] md:flex">{destinations.map(([label,href])=><Link key={href} href={href} className="flex min-h-14 shrink-0 items-center border-b-2 border-transparent px-3 text-ink/65 hover:border-gold hover:text-ink lg:px-4">{label}</Link>)}</nav>
    </div>
    <nav aria-label="Goal navigation" className="scrollbar-none mx-auto flex max-w-7xl overflow-x-auto border-t border-ink/10 px-5 text-[11px] font-bold uppercase tracking-[.08em] md:hidden">{destinations.map(([label,href])=><Link key={href} href={href} className="flex min-h-11 shrink-0 items-center px-3.5 text-ink/65 hover:text-forest">{label}</Link>)}</nav>
  </header>;
}
