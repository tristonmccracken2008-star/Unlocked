import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getManagedOpportunity } from "@/lib/content-store";
import { ArrowIcon } from "@/components/icons";
import styles from "@/components/opportunity-passport.module.css";
import { recordPublicOpportunityClick } from "@/lib/passport-public-store";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> { const item = await getManagedOpportunity((await params).id, { includeArchived: true }); return item ? { title: item.title, description: item.description, alternates: { canonical: `/discover/${item.id}` } } : { title: "Opportunity unavailable" }; }

export default async function PublicOpportunityPreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; share?: string }> }) {
  const item = await getManagedOpportunity((await params).id, { includeArchived: true }); if (!item) notFound();
  const attribution = await searchParams; if ((attribution.from === "passport" || attribution.from === "collection") && typeof attribution.share === "string" && /^[A-Za-z0-9_-]{24,80}$/.test(attribution.share)) await recordPublicOpportunityClick(attribution.share, attribution.from);
  const lifecycle = item.metadata.lifecycle; const open = lifecycle?.state === "open" || lifecycle?.state === "rolling" || item.metadata.eligibilityRules?.availability === "open" || item.metadata.eligibilityRules?.availability === "rolling";
  return <main className={styles.publicOpportunity}><nav><Link href="/">UnlockED</Link><span>/</span><span>Opportunity preview</span></nav><header><p>{item.type} · {item.category}</p><h1>{item.title}</h1><h2>{item.organization}</h2><div><span>{item.location}</span><span>{item.metadata.compensation || (item.paid === true ? "Paid" : item.paid === false ? "Unpaid" : "Compensation varies")}</span><span>{open ? "Applications known to be open" : lifecycle?.state ? lifecycle.state.replaceAll("_", " ") : "Check the official source for availability"}</span></div></header><div className={styles.opportunityBody}><article><section><p>About</p><h3>What this opportunity is</h3><span>{item.description}</span></section><section><p>Eligibility</p><h3>Who it is for</h3><span>{item.eligibility}</span></section>{item.application_deadline ? <section><p>Deadline</p><h3>{item.application_deadline}</h3><span>Always confirm the current date with the official provider.</span></section> : null}</article><aside><p>Verified source</p><strong>{item.verification_status === "verified" ? "Reviewed by UnlockED" : "Verify current details"}</strong><small>Last checked {item.last_verified}</small><a href={item.official_source_url} target="_blank" rel="noopener noreferrer">Open official source <ArrowIcon /></a><Link href={`/join?returnTo=${encodeURIComponent(`/opportunities/${item.id}`)}`}>Start your Journey <ArrowIcon /></Link><small>You can understand this opportunity before creating an account.</small></aside></div></main>;
}
