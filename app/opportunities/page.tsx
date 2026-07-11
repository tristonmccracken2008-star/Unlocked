import type { Metadata } from "next";
import { OpportunityFilter } from "@/components/opportunity-filter";

export const metadata: Metadata = { title: "Discover Opportunities", description: "Search verified student scholarships, benefits, AI tools, internships, research programs, fellowships, and competitions." };
export const dynamic="force-dynamic";
export default async function Page(){return <section className="bg-white px-5 py-12 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><p className="rule-label text-forest">Discover</p><h1 className="mt-4 max-w-4xl font-editorial text-5xl font-bold leading-[1] tracking-[-.05em] sm:text-7xl">Find the right opportunity.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-ink/55 sm:text-lg">Start with a search. Use filters only when you need them.</p><div className="mt-10"><OpportunityFilter /></div></div></section>}
