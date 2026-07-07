import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BenefitBrowser } from "@/components/benefit-browser";
import { SchoolPersonalizedRecommendations } from "@/components/school-personalized-recommendations";
import { formatValueTotal, getSchool, getSchoolBenefits, schools } from "@/data/seed";
import { opportunities, type Opportunity } from "@/data/opportunities";

export function generateStaticParams() { return schools.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const school = getSchool((await params).slug);
  if (!school) return { title: "School not found" };
  const schoolBenefits = getSchoolBenefits(school);
  const title = `${school.name} Student Hub — Opportunities, Benefits & Resources`;
  const description = `Explore verified internships, research, scholarships, AI tools, student benefits, and university resources for ${school.name} students.`;
  return { title, description, alternates: { canonical: `/schools/${school.slug}` }, openGraph: { title, description, url: `/schools/${school.slug}` } };
}

export default async function SchoolPage({ params }: { params: Promise<{ slug: string }> }) {
  const school = getSchool((await params).slug);
  if (!school) notFound();
  const schoolBenefits = getSchoolBenefits(school);
  const totalValue = schoolBenefits.reduce((sum, item) => sum + item.annualValue, 0);
  const nationalCount = schoolBenefits.filter((item) => item.scope === "national").length;
  const schoolSpecificCount = schoolBenefits.filter((item) => item.scope === "school").length;
  const lastUpdated = [...schoolBenefits].sort((a,b)=>b.verifiedAt.localeCompare(a.verifiedAt))[0]?.verifiedAt ?? "2026-07-06";
  const eligibleOpportunities = opportunities.filter((item)=>item.verification_status!=="expired"&&(item.school_scope==="National"||item.schools.includes(school.slug)));
  const schoolSpecific = eligibleOpportunities.filter((item)=>item.school_scope==="School Specific");
  const upcoming = eligibleOpportunities.filter((item)=>item.application_deadline).sort((a,b)=>(a.application_deadline??"").localeCompare(b.application_deadline??"")).slice(0,5);
  const hiddenGems = eligibleOpportunities.filter((item)=>item.hidden_gem).slice(0,5);
  const localDiscounts = schoolBenefits.filter((item)=>item.scope==="school"&&["Campus","Shopping","Travel","Other"].includes(item.category));
  const opportunityGroups = [
    ["Internships",eligibleOpportunities.filter((item)=>item.type==="Career"&&item.category==="Internships"),"/career"],
    ["Research",eligibleOpportunities.filter((item)=>item.type==="Research"),"/research"],
    ["Scholarships",eligibleOpportunities.filter((item)=>item.type==="Scholarship"),"/scholarships"],
    ["Competitions",eligibleOpportunities.filter((item)=>item.type==="Career"&&item.category==="Competitions"),"/career"],
    ["AI tools",eligibleOpportunities.filter((item)=>item.type==="AI"),"/ai"],
    ["Benefits",eligibleOpportunities.filter((item)=>item.type==="Benefit"),"/benefits"],
  ] as [string,Opportunity[],string][];
  const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: `${school.name} Student Discounts & .edu Benefits`, description: `National student benefits available to eligible ${school.name} students plus school-specific benefits verified from official university sources.`, url: `https://unlocked.education/schools/${school.slug}`, mainEntity: { "@type": "ItemList", numberOfItems: schoolBenefits.length, itemListElement: schoolBenefits.slice(0, 10).map((item, index) => ({ "@type": "ListItem", position: index + 1, url: `https://unlocked.education/benefits/${item.slug}`, name: item.name })) } };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink/40 sm:px-8"><Link href="/">Dashboard</Link><span>/</span><Link href="/university" className="text-forest">My University</Link><span>/</span><span>{school.name}</span></nav>
      <section className="border-b border-ink/15 bg-white">
        <div className="mx-auto grid max-w-7xl sm:grid-cols-[120px_1fr_260px]">
          <span className="grid min-h-28 place-items-center border-b border-ink/20 bg-ink font-editorial text-3xl font-bold text-white sm:border-b-0 sm:border-r">{school.initials}</span>
          <div className="border-b border-ink/15 px-5 py-10 sm:border-b-0 sm:px-8"><p className="rule-label text-forest">Verified university student hub · {school.domain}</p><h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.03em] sm:text-5xl">{school.name}</h1><p className="mt-4 text-sm leading-6 text-ink/45">{school.location} · {nationalCount} national benefits · {schoolSpecificCount} school-specific benefits</p><p className="mt-2 text-xs font-bold text-ink/35">Last updated {lastUpdated}</p></div>
          <div className="border-t border-ink/20 px-5 py-7 sm:border-l sm:border-t-0 sm:text-right"><p className="rule-label text-ink/40">Documented annual savings</p><p className="mt-2 font-editorial text-4xl font-bold text-forest">{formatValueTotal(totalValue)}</p><p className="mt-1 text-[11px] text-ink/35">Fixed-value offers only</p></div>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 sm:py-14"><div className="mx-auto max-w-7xl">
        <section className="grid gap-8 border-b border-ink/15 pb-12 lg:grid-cols-[.8fr_1.2fr]" aria-labelledby="school-overview"><div><p className="rule-label text-forest">School overview</p><h2 id="school-overview" className="mt-2 font-editorial text-3xl font-bold">About {school.name}</h2><p className="mt-4 max-w-xl text-sm leading-7 text-ink/50">UnlockED currently indexes verified national opportunities available to eligible students and {schoolSpecific.length} listing{schoolSpecific.length===1?"":"s"} supported by an official source specific to {school.name}.</p></div><dl className="grid sm:grid-cols-2"><Fact label="Location" value={school.location}/><Fact label="Official domain" value={school.domain}/><Fact label="Student population" value="Not documented in the current verified school record."/><div className="py-4 sm:px-5"><dt className="rule-label text-ink/35">Official links</dt><dd className="mt-2"><a href={`https://${school.domain}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-forest hover:underline">University website ↗</a></dd></div></dl></section>

        <section className="py-12" aria-labelledby="student-opportunities"><p className="rule-label text-forest">Student opportunities</p><h2 id="student-opportunities" className="mt-2 font-editorial text-3xl font-bold">Explore opportunities for {school.name} students</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-ink/45">Counts include verified national listings available broadly and school-specific listings only when supported by an official source.</p><div className="mt-7 grid gap-x-8 border-y border-ink/15 sm:grid-cols-2 lg:grid-cols-3">{opportunityGroups.map(([title,items,href])=><Link key={title} href={href} className="group flex items-center justify-between gap-4 border-b border-ink/10 py-5"><div><h3 className="font-editorial text-xl font-bold group-hover:text-forest">{title}</h3><p className="mt-1 text-sm text-ink/40">{items.length} verified listing{items.length===1?"":"s"}</p></div><span aria-hidden="true" className="text-sm text-ink/30">→</span></Link>)}</div></section>

        <SchoolPersonalizedRecommendations school={school}/>

        <section className="grid gap-10 border-y border-ink/15 py-12 lg:grid-cols-2"><div><p className="rule-label text-forest">University resources</p><h2 className="mt-2 font-editorial text-3xl font-bold">Campus offices and resources</h2><p className="mt-3 text-sm leading-6 text-ink/45">UnlockED does not yet have verified direct links for these offices. Use the official university website rather than an inferred URL.</p><dl className="mt-6 divide-y divide-ink/10">{["Career center","Library","Student organizations","Innovation / startup center","Undergraduate research office"].map((label)=><div key={label} className="flex items-center justify-between gap-4 py-3"><dt className="font-bold">{label}</dt><dd className="text-xs text-ink/40">Link not documented</dd></div>)}</dl><a href={`https://${school.domain}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center bg-ink px-5 text-xs font-bold uppercase tracking-wider text-white">Open official university site</a></div><div><p className="rule-label text-forest">Local student discounts</p><h2 className="mt-2 font-editorial text-3xl font-bold">Verified campus and local offers</h2>{localDiscounts.length?<div className="mt-6 divide-y divide-ink/10">{localDiscounts.map((item)=><Link key={item.slug} href={`/benefits/${item.slug}`} className="block py-3"><p className="font-bold hover:text-forest">{item.name}</p><p className="mt-1 text-xs text-ink/40">{item.value} · School-specific</p></Link>)}</div>:<Empty text={`No verified local discounts specific to ${school.name} are published yet.`}/>}</div></section>

        <section className="grid gap-10 py-12 lg:grid-cols-2"><div><p className="rule-label text-forest">Upcoming deadlines</p><h2 className="mt-2 font-editorial text-3xl font-bold">Dates worth watching</h2>{upcoming.length?<OpportunityList items={upcoming}/>:<Empty text="No future application deadlines are documented in the current verified listings."/>}</div><div><p className="rule-label text-forest">Featured hidden gems</p><h2 className="mt-2 font-editorial text-3xl font-bold">Opportunities students may overlook</h2>{hiddenGems.length?<OpportunityList items={hiddenGems}/>:<Empty text="No opportunities in the current verified catalog are marked as hidden gems yet."/>}</div></section>

        <section className="pt-6" aria-labelledby="benefit-directory"><p className="rule-label text-forest">Complete benefit index</p><h2 id="benefit-directory" className="mt-2 mb-7 font-editorial text-3xl font-bold">Benefits available to eligible {school.name} students</h2><BenefitBrowser benefits={schoolBenefits} schoolName={school.name}/></section>
      </div></section>
    </>
  );
}

function Fact({label,value}:{label:string;value:string}){return <div className="py-4 sm:px-5"><dt className="rule-label text-ink/35">{label}</dt><dd className="mt-2 text-sm font-bold leading-6">{value}</dd></div>}
function Empty({text}:{text:string}){return <p className="mt-6 bg-paper px-4 py-5 text-sm leading-6 text-ink/45">{text}</p>}
function OpportunityList({items}:{items:Opportunity[]}){return <div className="mt-6 divide-y divide-ink/10 border-y border-ink/10">{items.map((item)=><Link key={item.id} href={`/opportunities/${item.id}`} className="block py-3"><p className="font-bold hover:text-forest">{item.title}</p><p className="mt-1 text-xs text-ink/40">{item.organization}{item.application_deadline?` · ${item.application_deadline}`:""}</p></Link>)}</div>}
