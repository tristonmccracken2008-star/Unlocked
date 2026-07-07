import type { Metadata } from "next";
import { OpportunityFilter } from "@/components/opportunity-filter";

export const metadata: Metadata = { title: "Student opportunity directory", description: "Search verified student benefits, AI tools, internships, research programs, hackathons, fellowships, and competitions." };
export default function Page(){return <section className="px-5 py-12 sm:px-8 sm:py-16"><div className="mx-auto max-w-7xl"><p className="rule-label text-forest">Unified Opportunity Engine</p><h1 className="mt-3 font-editorial text-5xl font-bold">Every opportunity, one directory.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-ink/55">Filter benefits, AI tools, and career programs through the same verified data model.</p><div className="mt-10"><OpportunityFilter/></div></div></section>}
