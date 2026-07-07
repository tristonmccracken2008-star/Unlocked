import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BenefitBrowser } from "@/components/benefit-browser";
import { SchoolSeoSections } from "@/components/school-seo-sections";
import { formatValueTotal, getSchool, getSchoolBenefits, schools } from "@/data/seed";

export function generateStaticParams() { return schools.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const school = getSchool((await params).slug);
  if (!school) return { title: "School not found" };
  const schoolBenefits = getSchoolBenefits(school);
  const title = `${school.name} Student Discounts & .edu Benefits`;
  const description = `Discover national student benefits available to eligible ${school.name} students plus school-specific benefits verified from official university sources.`;
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
  const relatedSchools = schools.filter((item) => item.slug !== school.slug).slice(0, 4);
  const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: `${school.name} Student Discounts & .edu Benefits`, description: `National student benefits available to eligible ${school.name} students plus school-specific benefits verified from official university sources.`, url: `https://unlocked.education/schools/${school.slug}`, mainEntity: { "@type": "ItemList", numberOfItems: schoolBenefits.length, itemListElement: schoolBenefits.slice(0, 10).map((item, index) => ({ "@type": "ListItem", position: index + 1, url: `https://unlocked.education/benefits/${item.slug}`, name: item.name })) } };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="border-b-2 border-ink bg-white">
        <div className="mx-auto grid max-w-7xl border-x border-ink/20 sm:grid-cols-[120px_1fr_260px]">
          <span className="grid min-h-28 place-items-center border-b border-ink/20 bg-ink font-editorial text-3xl font-bold text-white sm:border-b-0 sm:border-r">{school.initials}</span>
          <div className="border-b border-ink/20 px-5 py-8 sm:border-b-0 sm:px-8"><p className="rule-label text-forest">Verified university benefit index · {school.domain}</p><h1 className="mt-3 font-editorial text-4xl font-bold tracking-tight sm:text-5xl">{school.name}</h1><p className="mt-3 text-sm leading-6 text-ink/50">{school.location} · {nationalCount} national benefits · {schoolSpecificCount} school-specific benefits</p><p className="mt-1 text-xs font-bold text-ink/40">Last updated {lastUpdated}</p></div>
          <div className="border-t border-ink/20 px-5 py-7 sm:border-l sm:border-t-0 sm:text-right"><p className="rule-label text-ink/40">Documented annual savings</p><p className="mt-2 font-editorial text-4xl font-bold text-forest">{formatValueTotal(totalValue)}</p><p className="mt-1 text-[11px] text-ink/35">Fixed-value offers only</p></div>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 sm:py-14"><div className="mx-auto max-w-7xl"><BenefitBrowser benefits={schoolBenefits} schoolName={school.name} /><SchoolSeoSections school={school} benefits={schoolBenefits} relatedSchools={relatedSchools} /></div></section>
    </>
  );
}
