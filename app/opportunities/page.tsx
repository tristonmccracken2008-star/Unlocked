import type { Metadata } from "next";
import { OpportunityFilter } from "@/components/opportunity-filter";

export const metadata: Metadata = { title: "Discover Opportunities", description: "Search verified student scholarships, benefits, AI tools, internships, research programs, fellowships, and competitions." };
export const dynamic="force-dynamic";
export default async function Page(){return <section className="bg-[radial-gradient(circle_at_top_left,rgba(231,216,189,.48),transparent_34rem),#f6f0e6] px-5 py-10 sm:px-8 sm:py-14"><div className="mx-auto max-w-[112rem]"><OpportunityFilter /></div></section>}
