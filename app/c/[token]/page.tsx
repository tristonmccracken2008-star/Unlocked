import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readPublicCollection } from "@/lib/passport-public-store";
import { ArrowIcon } from "@/components/icons";
import styles from "@/components/opportunity-passport.module.css";
import { PassportCollectionSave } from "@/components/passport-collection-save";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const safeToken = /^[A-Za-z0-9_-]{24,80}$/;
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function PublicCollectionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; if (!safeToken.test(token)) notFound(); const record = await readPublicCollection(token); if (!record?.collection.sharingEnabled) notFound();
  return <main className={styles.publicCollection}><header><p>Opportunity collection</p><h1>{record.collection.title}</h1>{record.collection.description ? <span>{record.collection.description}</span> : null}<small>Curated by {record.curator} · {record.collection.opportunities.length} opportunities</small><PassportCollectionSave token={token}/></header><section>{record.collection.opportunities.map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><p>{item.type}</p><h2>{item.title}</h2><small>{item.organization}{item.deadline ? ` · Deadline ${item.deadline}` : ""}</small></div><Link href={`/discover/${encodeURIComponent(item.id)}?from=collection&share=${encodeURIComponent(token)}`}>Explore <ArrowIcon /></Link></article>)}</section><footer><p>Made with UnlockED</p><Link href="/">Find opportunities for you <ArrowIcon /></Link></footer></main>;
}
