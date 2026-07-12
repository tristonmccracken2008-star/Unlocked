import type { Metadata } from "next";
import { PersonalizedHome } from "@/components/personalized-home";

export const metadata: Metadata = {
  title: { absolute: "UnlockED — Journey" },
  description: "Manage your Journey, application progress, and real UnlockED milestones in one calm private workspace.",
};

export default function Home() {
  return <div data-unlocked-home="personalized-dashboard-v1"><PersonalizedHome /></div>;
}
