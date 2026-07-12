import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Checkout Canceled", description: "UnlockED Pro checkout was canceled.", robots: { index: false, follow: false } };

export default function Page() {
  return <main className="min-h-[70vh] bg-paper px-5 py-16 sm:px-8">
    <section className="mx-auto max-w-3xl rounded-[2rem] bg-white/82 p-8 shadow-soft ring-1 ring-ink/8">
      <p className="rule-label text-forest">Checkout canceled</p>
      <h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.045em]">No subscription was started.</h1>
      <p className="mt-4 text-sm leading-7 text-ink/58">Your UnlockED account and Journey are unchanged. You can keep using Free or return to pricing whenever you are ready.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">Back to pricing</Link>
        <Link href="/opportunities" className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/15 px-6 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Continue with Free</Link>
      </div>
    </section>
  </main>;
}
