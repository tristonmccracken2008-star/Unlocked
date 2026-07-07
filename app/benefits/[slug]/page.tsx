import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon, CheckIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { OpportunityViewTracker } from "@/components/opportunity-activity";
import { benefits, getBenefit } from "@/data/seed";

export function generateStaticParams() { return benefits.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = getBenefit((await params).slug);
  if (!item) return { title: "Benefit not found" };
  const title = `${item.name} Student Benefit`;
  const description = `${item.description} See verified eligibility, official source, value, and step-by-step claim instructions.`;
  return { title, description, alternates: { canonical: `/benefits/${item.slug}` }, openGraph: { title, description, url: `/benefits/${item.slug}` } };
}

export default async function BenefitPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = getBenefit((await params).slug);
  if (!item) notFound();
  const related = benefits.filter((candidate) => candidate.category === item.category && candidate.slug !== item.slug).slice(0, 3);
  const externalClaim = item.claimUrl.startsWith("http");
  const itemGoal: [string,string] = item.scope === "school" ? ["My University","/university"] : ["Finance","Shopping","Streaming","Travel"].includes(item.category) ? ["Save Money","/save-money"] : ["Get Ahead","/get-ahead"];
  return (
    <>
      <OpportunityViewTracker opportunityId={item.opportunityId}/>
      <section className="border-b-2 border-ink bg-white px-5 py-12 sm:px-8 sm:py-16"><div className="mx-auto max-w-5xl"><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/40"><Link href="/">Dashboard</Link><span>/</span><Link href={itemGoal[1]} className="text-forest">{itemGoal[0]}</Link><span>/</span><Link href="/benefits">Benefits</Link></nav><div className="mt-8 grid gap-8 border-t border-ink/20 pt-8 md:grid-cols-[1fr_240px]"><div className="max-w-3xl"><div className="mb-4 flex flex-wrap items-center gap-4"><span className="rule-label text-forest">{item.category}</span><StatusBadge status={item.status} /></div><p className="text-sm font-bold uppercase tracking-widest text-ink/40">{item.provider}</p><h1 className="mt-2 font-editorial text-4xl font-bold tracking-tight sm:text-6xl">{item.name}</h1><p className="mt-5 text-lg leading-8 text-ink/60">{item.description}</p></div><div className="border-t-2 border-ink pt-5 md:border-l-2 md:border-t-0 md:pl-6 md:pt-0 md:text-right"><p className="rule-label text-ink/45">Verified offer value</p><p className="mt-3 font-editorial text-3xl font-bold text-forest">{item.value}</p></div></div></div></section>
      <section className="px-5 py-12 sm:px-8 sm:py-16"><div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8"><div className="border-y-2 border-ink bg-white p-6 sm:p-8"><h2 className="font-editorial text-2xl font-bold">How to claim it</h2><ol className="mt-6 divide-y divide-ink/15">{item.claimSteps.map((step, index) => <li key={step} className="grid grid-cols-[34px_1fr] gap-4 py-4"><span className="font-mono text-xs font-bold text-forest">0{index + 1}</span><p className="text-sm leading-6 text-ink/70">{step}</p></li>)}</ol></div><div className="border-y border-ink/20 bg-white p-6 sm:p-8"><h2 className="font-editorial text-2xl font-bold">Renewal and expiration</h2><p className="mt-4 leading-7 text-ink/60">{item.renewalNotes}</p></div></div>
        <aside className="space-y-4"><div className="bg-ink p-6 text-white"><h2 className="font-editorial text-lg font-bold">Offer details</h2><dl className="mt-5 divide-y divide-white/15 text-sm"><div className="pb-4"><dt className="text-white/45">Availability</dt><dd className="mt-1 font-semibold">{item.scope === "national" ? "National student benefit" : "School-specific benefit"}</dd></div><div className="py-4"><dt className="text-white/45">Eligibility</dt><dd className="mt-1 font-semibold leading-6">{item.eligibility}</dd></div><div className="py-4"><dt className="text-white/45">Verification method</dt><dd className="mt-1 font-semibold leading-6">{item.verificationMethod}</dd></div><div className="pt-4"><dt className="text-white/45">Last Verified</dt><dd className="mt-1 font-semibold">{item.verified}</dd></div></dl><a href={item.claimUrl} target={externalClaim ? "_blank" : undefined} rel={externalClaim ? "noreferrer" : undefined} className="mt-6 flex w-full items-center justify-center gap-2 bg-lime px-5 py-3.5 font-black text-ink hover:bg-white">{externalClaim ? "Claim this perk" : "Check availability"} <ArrowIcon /></a><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 block text-center text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white">Official Source</a></div><Link href={`/contact?benefit=${encodeURIComponent(item.name)}`} className="flex w-full items-center justify-center border border-ink/20 bg-white px-5 py-3 text-sm font-bold text-ink/65 hover:border-forest hover:text-forest">Report Outdated Information</Link><p className="px-2 text-xs leading-5 text-ink/40">Offer details can change. Confirm eligibility and pricing on the provider’s website before completing enrollment.</p></aside>
      </div></section>
      <section className="border-t-2 border-ink bg-white px-5 py-12 sm:px-8 sm:py-16"><div className="mx-auto max-w-5xl"><h2 className="font-editorial text-2xl font-bold">Related {item.category.toLowerCase()} perks</h2><div className="mt-6 grid border-y border-ink/20 md:grid-cols-3">{related.map((candidate) => <Link key={candidate.slug} href={`/benefits/${candidate.slug}`} className="group border-b border-ink/20 p-5 hover:bg-paper md:border-b-0 md:border-r md:last:border-r-0"><StatusBadge status={candidate.status} /><h3 className="mt-4 font-bold group-hover:text-forest">{candidate.name}</h3><p className="mt-2 text-sm text-ink/45">{candidate.value}</p><span className="mt-5 flex items-center gap-2 text-sm font-bold text-forest">View details <ArrowIcon /></span></Link>)}</div></div></section>
    </>
  );
}
