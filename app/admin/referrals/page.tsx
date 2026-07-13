import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminReferrals } from "@/components/admin-referrals";
import { getAdminSession } from "@/lib/admin-auth";
import { getReferralAdminSummary } from "@/lib/auth-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Referrals | UnlockED Admin", robots: { index: false, follow: false } };

export default async function Page() {
  const session = await getAdminSession();
  if (!session) redirect("/api/auth/google");
  const summary = await getReferralAdminSummary();
  return <main className="px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-7xl">
      <p className="rule-label text-forest">Internal referrals</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold sm:text-5xl">Referral health</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-ink/55">Read-only referral activity, rewards, pending completions, and abuse signals. Admin access is protected by the existing admin email allowlist.</p>
      <div className="mt-9"><AdminReferrals summary={summary} /></div>
    </div>
  </main>;
}
