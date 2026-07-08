import type { Metadata } from "next";
import { MyOpportunitiesPage } from "@/components/my-opportunities-page";

export const metadata: Metadata = {
  title: "My Opportunities",
  description: "Track saved student opportunities, application progress, deadlines, and completed benefits in UnlockED.",
  alternates: { canonical: "/my-opportunities" },
};

export default function Page() {
  return <MyOpportunitiesPage />;
}
