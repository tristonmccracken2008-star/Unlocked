import Link from "next/link";
import { ArrowIcon } from "@/components/icons";

export default function NotFound() {
  return <main className="px-5 py-16 sm:px-8 sm:py-24">
    <section className="mx-auto max-w-4xl border-y border-ink/20 bg-white px-5 py-12 sm:px-10">
      <p className="rule-label text-forest">Page not found</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.03em] sm:text-6xl">This opportunity path does not exist.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-ink/55">The page may have moved, the listing may have been retired, or the link may be mistyped. Start with the verified directory or return home.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/opportunities" className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-forest">Browse opportunities <ArrowIcon /></Link>
        <Link href="/" className="inline-flex min-h-12 items-center justify-center border border-ink/20 px-5 text-xs font-bold uppercase tracking-wider text-ink/65 hover:border-forest hover:text-forest">Return home</Link>
      </div>
    </section>
  </main>;
}
