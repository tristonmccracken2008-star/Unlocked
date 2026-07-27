import type { Metadata } from "next";
import { NotificationCenter } from "@/components/notification-center";
import { requireCompletedOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Notifications",
  description: "Review timely UnlockED deadline reminders and Journey updates.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireCompletedOnboarding();
  return <NotificationCenter />;
}
