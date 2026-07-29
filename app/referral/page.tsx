import type { Metadata } from "next";
import { ReferralPage } from "@/components/referral-page";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { publicAccountSession } from "@/lib/public-account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Referrals",
  description: "Invite classmates to UnlockED and see referral rewards from your account.",
  alternates: { canonical: "/referral" },
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = await requireCompletedOnboarding();
  return <ReferralPage initialSession={publicAccountSession(session)} />;
}
