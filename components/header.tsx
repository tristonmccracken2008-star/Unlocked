import Link from "next/link";
import { Logo } from "./logo";

export function Header() {
  return <header className="border-b-2 border-ink bg-paper">
    <div className="mx-auto flex max-w-7xl items-stretch justify-between px-5 sm:px-8">
      <Logo className="border-x border-ink/20 px-4 py-3.5 sm:px-6" />
      <nav className="flex items-stretch text-xs font-bold uppercase tracking-wider">
        <Link href="/student-discounts" className="hidden items-center border-l border-ink/15 px-5 hover:bg-white md:flex">Discounts</Link>
        <Link href="/free-student-software" className="hidden items-center border-l border-ink/15 px-5 hover:bg-white lg:flex">Software</Link>
        <Link href="/schools/university-of-michigan" className="hidden items-center border-l border-ink/15 px-5 hover:bg-white sm:flex">Directory</Link>
        <Link href="/submit-perk" className="flex items-center border-x border-ink/15 px-4 hover:bg-ink hover:text-white sm:px-5">Submit a perk</Link>
      </nav>
    </div>
  </header>;
}
