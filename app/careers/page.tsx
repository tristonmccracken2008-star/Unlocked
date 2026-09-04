import type { Metadata } from "next";
import { CareerExplorer } from "@/components/career-explorer";
import { requireCompletedOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Explore Careers", description: "Compare more than 100 career paths, including pay, entry routes, work-life tradeoffs, and AI outlook.", robots: { index: false, follow: false } };

export default async function CareersPage() {
  await requireCompletedOnboarding();
  return <CareerExplorer />;
}
