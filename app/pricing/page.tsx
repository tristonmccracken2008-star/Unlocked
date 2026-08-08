import Link from "next/link";
import { BillingCheckoutButton } from "@/components/billing-checkout-button";
import { isProUser, proPricing } from "@/lib/billing";
import { publicPageMetadata } from "@/lib/public-metadata";
import { stripeCheckoutConfigured } from "@/lib/stripe";
import { getServerSessionForProduct } from "@/lib/onboarding";

export const metadata = publicPageMetadata("UnlockED Pro", "Compare UnlockED Free and Pro plans for personalized student opportunity recommendations.", "/pricing");
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSessionForProduct();
  const signedIn = Boolean(session);
  const pro = isProUser(session?.data.billing);
  const currentInterval = session?.data.billing.billingInterval;
  return <main className="bg-paper px-5 py-14 sm:px-8">
    <section className="mx-auto max-w-6xl">
      <p className="rule-label text-forest">UnlockED Pro</p>
      <h1 className="mt-4 max-w-4xl font-editorial text-5xl font-bold leading-[.98] text-ink sm:text-7xl">Never miss the right opportunity.</h1>
      <p className="mt-6 max-w-2xl text-base leading-8 text-ink/58">Free stays useful. Pro unlocks the full personalized feed, deeper explanations, and premium appearance options.</p>
      {pro ? <div className="mt-7 flex max-w-2xl flex-col gap-3 rounded-[1.25rem] border border-forest/20 bg-white/75 p-5 sm:flex-row sm:items-center sm:justify-between" role="status"><p className="text-sm font-bold text-forest">UnlockED Pro is active on this account.</p><Link href="/profile#billing" className="inline-flex min-h-11 items-center text-sm font-bold text-forest hover:text-ink">Manage billing</Link></div> : null}
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <PlanCard planId="pro_monthly" configured={stripeCheckoutConfigured("pro_monthly")} signedIn={signedIn} pro={pro} current={pro && currentInterval === "month"} />
        <PlanCard planId="pro_annual" configured={stripeCheckoutConfigured("pro_annual")} signedIn={signedIn} pro={pro} current={pro && currentInterval === "year"} highlight />
      </div>
      <div className="mt-10 grid gap-5 rounded-[1.5rem] bg-white/72 p-6 ring-1 ring-ink/8 lg:grid-cols-2">
        <section><h2 className="font-editorial text-2xl font-bold">Free includes</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-ink/58"><li>Discover, search, filters, and opportunity pages</li><li>Add opportunities and update progress in Journey</li><li>Journey Card image export and sharing</li><li>Limited For You preview</li></ul></section>
        <section><h2 className="font-editorial text-2xl font-bold">Pro unlocks</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-ink/58"><li>Full personalized For You feed</li><li>Recommendation explanations</li><li>Deeper recommendation context</li><li>Dark mode and premium appearance</li></ul></section>
      </div>
      <p className="mt-6 max-w-3xl text-xs leading-6 text-ink/45">Subscriptions renew automatically until canceled in Stripe Billing. You can manage or cancel from your Billing settings. Taxes, if applicable, depend on Stripe account configuration. See <Link href="/terms" className="font-bold text-forest">Terms</Link> and <Link href="/privacy" className="font-bold text-forest">Privacy</Link>.</p>
    </section>
  </main>;
}

function PlanCard({ planId, configured, signedIn, pro, current = false, highlight = false }: { planId: keyof typeof proPricing; configured: boolean; signedIn: boolean; pro: boolean; current?: boolean; highlight?: boolean }) {
  const plan = proPricing[planId];
  return <article className={`rounded-[1.75rem] p-6 shadow-[0_18px_60px_rgba(43,33,26,.06)] ring-1 ${highlight ? "bg-forest text-white ring-forest" : "bg-white/86 text-ink ring-ink/8"}`}>
    <div className="flex items-center justify-between gap-3"><p className={`rule-label ${highlight ? "text-white/70" : "text-forest"}`}>{plan.label}</p>{current ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${highlight ? "bg-white/15 text-white" : "bg-forest/10 text-forest"}`}>Current plan</span> : null}</div>
    <h2 className="mt-3 font-editorial text-4xl font-bold">UnlockED Pro</h2>
    <p className={`mt-3 text-3xl font-black ${highlight ? "text-white" : "text-forest"}`}>{plan.displayPrice}</p>
    {highlight && <p className="mt-2 text-sm font-bold text-white/70">Best value for students using UnlockED all year.</p>}
    <div className="mt-6">{pro ? current ? <Link href="/profile#billing" className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-bold ${highlight ? "bg-white text-forest hover:bg-paper" : "bg-forest text-white hover:bg-ink"}`}>Manage current plan</Link> : <p className={`flex min-h-12 items-center text-sm font-bold ${highlight ? "text-white/75" : "text-ink/50"}`}>Your current Pro cadence is shown above.</p> : signedIn ? <BillingCheckoutButton planId={planId} configured={configured} source="pricing" className={`min-h-12 w-full rounded-full px-5 text-sm font-bold disabled:cursor-wait disabled:opacity-65 ${highlight ? "bg-white text-forest hover:bg-paper" : "bg-forest text-white hover:bg-ink"}`}>Upgrade to {plan.label}</BillingCheckoutButton> : <a href="/api/auth/google" className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-bold ${highlight ? "bg-white text-forest hover:bg-paper" : "bg-forest text-white hover:bg-ink"}`}>Sign in to choose {plan.label.toLowerCase()}</a>}</div>
    <p className={`mt-4 text-xs leading-5 ${highlight ? "text-white/65" : "text-ink/45"}`}>Recurring billing. Cancel anytime in the Stripe customer portal.</p>
  </article>;
}
