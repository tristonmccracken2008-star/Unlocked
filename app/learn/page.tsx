import type { Metadata } from "next";
import { LearnUnlocked } from "@/components/learn-unlocked";
import { requireCompletedOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Learn UnlockED",
  description: "A concise guide to Discover, Explore, Collections, For You, Paths, Planner, Journey, Applications, Materials, Resume Lab, Accomplishments, deadlines, notifications, and profile controls.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireCompletedOnboarding();
  return <LearnUnlocked />;
}
