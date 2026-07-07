import type { Metadata } from "next";
import { OpportunityFilter } from "@/components/opportunity-filter";

export const metadata: Metadata = { title: "Student opportunity directory", description: "Search verified student benefits, AI tools, internships, research programs, hackathons, fellowships, and competitions." };
export default function Page(){return <section className="px-5 py-10 sm:px-8 sm:py-14"><div className="mx-auto max-w-7xl"><p className="rule-label text-forest">Verified student opportunity directory</p><h1 className="mt-3 font-editorial text-4xl font-bold sm:text-5xl">Find the next opportunity worth your time.</h1><p className="mt-4 max-w-3xl text-base leading-7 text-ink/55 sm:text-lg">Search benefits, AI tools, internships, research programs, and scholarships with official sources and clear eligibility details.</p><div className="mt-8"><OpportunityFilter/></div></div></section>}
