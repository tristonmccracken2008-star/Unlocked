import type { Metadata } from "next";
import { OpportunityFilter } from "@/components/opportunity-filter";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { HighSchoolOpportunityDiscovery } from "@/components/high-school-opportunity-discovery";
import { highSchoolOpportunities } from "@/data/high-school-opportunities";
import { highSchoolCatalog } from "@/lib/high-school-opportunities";

export const metadata: Metadata = { title: "Discover Opportunities", description: "Search verified student scholarships, benefits, AI tools, internships, research programs, fellowships, and competitions." };
export const dynamic="force-dynamic";
export default async function Page(){
  const session = await requireCompletedOnboarding();
  if (session.data.educationalStage === "high_school") {
    return <HighSchoolOpportunityDiscovery opportunities={highSchoolCatalog(highSchoolOpportunities)} profile={session.data.profile} />;
  }
  return <section data-visual-page="discover" className="px-5 py-10 sm:px-8 sm:py-14"><div className="mx-auto max-w-[112rem]"><OpportunityFilter /></div></section>;
}
