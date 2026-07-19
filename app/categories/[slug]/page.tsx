import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { benefits, categories, type Category } from "@/data/seed";
import { serializeJsonLd } from "@/lib/json-ld";

const categoryNames = categories.slice(1);
const toSlug = (name: string) => name.toLowerCase();
export function generateStaticParams() { return categoryNames.map((name) => ({ slug: toSlug(name) })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const slug = (await params).slug; const name = categoryNames.find((item) => toSlug(item) === slug); if (!name) return { title: "Category not found" }; const title = `${name} Student Benefits & Discounts`; const description = `Browse verified ${name.toLowerCase()} student benefits, discounts, eligibility details, and official claim sources.`; return { title, description, alternates: { canonical: `/categories/${slug}` }, openGraph: { title, description, url: `/categories/${slug}` } }; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const category = categoryNames.find((item) => toSlug(item) === slug) as Category | undefined;
  if (!category) notFound();
  const items = benefits.filter((item) => item.category === category);
  const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: `${category} Student Benefits & Discounts`, url: `https://www.unlockededu.com/categories/${slug}`, mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, url: `https://www.unlockededu.com/benefits/${item.slug}` })) } };
  const relatedCategories = categoryNames.filter((item) => item !== category).slice(0, 4);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} /><section className="border-b-2 border-ink bg-white px-5 py-12 sm:px-8 sm:py-16"><div className="mx-auto max-w-6xl"><p className="rule-label text-forest">Browse by category</p><h1 className="mt-3 font-editorial text-5xl font-bold tracking-tight sm:text-6xl">{category} student benefits</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-ink/55">Compare {items.length} verified offers with clear eligibility, documented value, official sources, and claim instructions.</p><p className="mt-3 text-xs font-semibold text-ink/40">Last updated: July 6, 2026</p></div></section><section className="px-5 py-12 sm:px-8 sm:py-16"><div className="mx-auto max-w-6xl"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map((item) => <Link key={item.slug} href={`/benefits/${item.slug}`} className="group flex flex-col border border-ink/20 bg-white p-5 hover:border-ink"><div className="flex items-center justify-between gap-3"><span className="rule-label text-ink/35">{item.scope === "national" ? "National" : "School-specific"}</span><StatusBadge status={item.status} /></div><h2 className="mt-5 font-editorial text-xl font-bold group-hover:text-forest">{item.name}</h2><p className="mt-2 text-sm leading-6 text-ink/55">{item.description}</p><div className="mt-auto flex items-end justify-between gap-3 pt-6"><p className="font-bold text-forest">{item.value}</p><ArrowIcon className="h-5 w-5 text-forest" /></div></Link>)}</div><nav className="mt-14 border-y-2 border-ink py-6" aria-label="Related benefit categories"><p className="rule-label text-ink/40">Related categories</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">{relatedCategories.map((item) => <Link key={item} href={`/categories/${toSlug(item)}`} className="border-b border-ink text-sm font-bold hover:border-forest hover:text-forest">{item} benefits</Link>)}</div></nav></div></section></>;
}
