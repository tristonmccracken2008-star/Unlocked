import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { isProUser } from "@/lib/billing";
import { checkoutSessionBelongsToUser, retrieveCheckoutSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing Success", description: "UnlockED Pro checkout confirmation.", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  const pro = isProUser(session?.data.billing);
  const candidate = session && params.session_id ? await retrieveCheckoutSession(params.session_id).catch(() => null) : null;
  const checkout = candidate && session && checkoutSessionBelongsToUser(candidate, session.user.id) ? candidate : null;
  return <main className="min-h-[70vh] bg-paper px-5 py-16 sm:px-8">
    <section className="mx-auto max-w-3xl rounded-[2rem] bg-white/82 p-8 shadow-soft ring-1 ring-ink/8">
      <p className="rule-label text-forest">UnlockED Pro</p>
      <h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.045em]">{pro ? "Welcome to UnlockED Pro" : "Payment is being finalized"}</h1>
      <p className="mt-4 text-sm leading-7 text-ink/58">{pro ? "Your subscription is active and your personalized experience is ready." : "Stripe accepted the checkout session. We are waiting for webhook-confirmed access before unlocking Pro. This usually takes a moment."}</p>
      {checkout?.id && <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-xs font-bold text-ink/45">Checkout session verified. Access is controlled by Stripe webhook confirmation.</p>}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/advisor" className="inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">Open For You</Link>
        <Link href="/profile" className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/15 px-6 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Open billing</Link>
      </div>
    </section>
  </main>;
}
