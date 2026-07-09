import type { Metadata } from "next";
import { OpportunityFilter } from "@/components/opportunity-filter";
import { listPublishedOpportunities } from "@/lib/content-store";

export const metadata: Metadata = { title: "Discover Opportunities", description: "Search verified student scholarships, benefits, AI tools, internships, research programs, fellowships, and competitions." };
export const dynamic="force-dynamic";
export default async function Page(){const opportunities=await listPublishedOpportunities();return <section className="bg-white px-5 py-12 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><p className="rule-label text-forest">Discover</p><h1 className="mt-4 max-w-4xl font-editorial text-5xl font-bold leading-[1] tracking-[-.05em] sm:text-7xl">Browse verified opportunities without the noise.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-ink/55 sm:text-lg">Search once, then narrow by category, school relevance, major, deadline, and value. Every listing keeps the official source close.</p><div className="mt-10"><OpportunityFilter opportunities={opportunities}/></div></div></section>}
