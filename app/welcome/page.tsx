import type { Metadata } from "next";
import { FirstLaunchWalkthrough } from "@/components/first-launch-walkthrough";
import { isProUser } from "@/lib/billing";
import { requireFirstLaunchSession } from "@/lib/onboarding";
import { publicAccountSession } from "@/lib/public-account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Welcome to UnlockED",
  description: "A short introduction to Discover, For You, and Journey.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = await requireFirstLaunchSession();
  return <FirstLaunchWalkthrough initialSession={publicAccountSession(session)} pro={isProUser(session.data.billing)} />;
}
