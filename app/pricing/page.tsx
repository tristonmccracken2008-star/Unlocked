import type { Metadata } from "next";
import Link from "next/link";
import { proPricing } from "@/lib/billing";

export const metadata: Metadata = {
  title: "UnlockED Pro",
  description: "Compare UnlockED Free and Pro plans for personalized student opportunity recommendations.",
  alternates: { canonical: "/pricing" },
};

export default function Page() {
  return <main className="bg-[radial-gradient(circle_at_top_left,rgba(231,216,189,.45),transparent_34rem),#f6f0e6] px-5 py-14 sm:px-8">
    <section className="mx-auto max-w-6xl">
      <p className="rule-label text-forest">UnlockED Pro</p>
      <h1 className="mt-4 max-w-4xl font-editorial text-5xl font-bold leading-[.98] tracking-[-.055em] text-ink sm:text-7xl">Never miss the right opportunity.</h1>
      <p className="mt-6 max-w-2xl text-base leading-8 text-ink/58">Free stays useful. Pro unlocks the full personalized feed, deeper explanations, premium Journey Card themes, and premium appearance options.</p>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <PlanCard planId="pro_monthly" />
        <PlanCard planId="pro_annual" highlight />
      </div>
      <div className="mt-10 grid gap-5 rounded-[1.5rem] bg-white/72 p-6 ring-1 ring-ink/8 lg:grid-cols-2">
        <section><h2 className="font-editorial text-2xl font-bold">Free includes</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-ink/58"><li>Discover, search, filters, and opportunity pages</li><li>Add to Journey and manage your Journey Board</li><li>Standard Journey Card export and sharing</li><li>Limited For You preview</li></ul></section>
        <section><h2 className="font-editorial text-2xl font-bold">Pro unlocks</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-ink/58"><li>Full personalized For You feed</li><li>Recommendation explanations</li><li>Premium Journey Card themes and customization</li><li>Dark mode and premium appearance</li></ul></section>
      </div>
      <p className="mt-6 max-w-3xl text-xs leading-6 text-ink/45">Subscriptions renew automatically until canceled in Stripe Billing. You can manage or cancel from your Billing settings. Taxes, if applicable, depend on Stripe account configuration. See <Link href="/terms" className="font-bold text-forest">Terms</Link> and <Link href="/privacy" className="font-bold text-forest">Privacy</Link>.</p>
    </section>
  </main>;
}

function PlanCard({ planId, highlight = false }: { planId: keyof typeof proPricing; highlight?: boolean }) {
  const plan = proPricing[planId];
  return <article className={`rounded-[1.75rem] p-6 shadow-[0_18px_60px_rgba(43,33,26,.06)] ring-1 ${highlight ? "bg-forest text-white ring-forest" : "bg-white/86 text-ink ring-ink/8"}`}>
    <p className={`rule-label ${highlight ? "text-white/70" : "text-forest"}`}>{plan.label}</p>
    <h2 className="mt-3 font-editorial text-4xl font-bold">UnlockED Pro</h2>
    <p className={`mt-3 text-3xl font-black ${highlight ? "text-white" : "text-forest"}`}>{plan.displayPrice}</p>
    {highlight && <p className="mt-2 text-sm font-bold text-white/70">Best value for students using UnlockED all year.</p>}
    <form action="/api/billing/checkout" method="post" className="mt-6">
      <input type="hidden" name="planId" value={planId} />
      <button className={`min-h-12 w-full rounded-full px-5 text-sm font-bold ${highlight ? "bg-white text-forest hover:bg-paper" : "bg-forest text-white hover:bg-ink"}`}>Upgrade to {plan.label}</button>
    </form>
    <p className={`mt-4 text-xs leading-5 ${highlight ? "text-white/65" : "text-ink/45"}`}>Recurring billing. Cancel anytime in the Stripe customer portal.</p>
  </article>;
}
