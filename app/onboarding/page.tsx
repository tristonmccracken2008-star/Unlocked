import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { requireOnboardingSession } from "@/lib/onboarding";
import { publicAccountSession } from "@/lib/public-account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Personalize UnlockED",
  description: "Complete your one-time UnlockED onboarding profile.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = await requireOnboardingSession();
  return <OnboardingFlow session={publicAccountSession(session)} initialProfile={session.data.profile} />;
}
