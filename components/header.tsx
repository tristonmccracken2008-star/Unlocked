import Link from "next/link";
import { Logo } from "./logo";

export function Header() {
  const destinations = [["🏠 Dashboard","/"],["🚀 Get Ahead","/get-ahead"],["💼 Build Your Career","/build-career"],["💰 Save Money","/save-money"],["🏫 My University","/university"]];
  return <header className="border-b-2 border-ink bg-paper">
    <div className="mx-auto flex max-w-7xl items-stretch justify-between px-5 sm:px-8">
      <Logo className="border-x border-ink/20 px-4 py-3.5 sm:px-6" />
      <nav aria-label="Primary navigation" className="scrollbar-none flex overflow-x-auto text-[11px] font-bold uppercase tracking-wider">{destinations.map(([label,href])=><Link key={href} href={href} className="hidden shrink-0 items-center border-l border-ink/15 px-3 hover:bg-white md:flex lg:px-4">{label}</Link>)}</nav>
    </div>
    <nav aria-label="Goal navigation" className="scrollbar-none mx-auto flex max-w-7xl overflow-x-auto border-t border-ink/15 px-5 text-[11px] font-bold uppercase tracking-wider md:hidden">{destinations.map(([label,href])=><Link key={href} href={href} className="flex min-h-11 shrink-0 items-center border-r border-ink/15 px-4 first:border-l hover:bg-white hover:text-forest">{label}</Link>)}</nav>
  </header>;
}
