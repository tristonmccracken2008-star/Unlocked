import type { Metadata } from "next";
import { NotificationCenter } from "@/components/notification-center";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { normalizeGuidanceState } from "@/lib/guidance";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Notifications",
  description: "Review timely UnlockED deadline reminders and Journey updates.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = await requireCompletedOnboarding();
  return <NotificationCenter guidanceState={normalizeGuidanceState(session.data.guidance)} />;
}
