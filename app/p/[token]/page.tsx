import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PassportDocument } from "@/components/passport-view";
import { readPublicPassport } from "@/lib/passport-public-store";
import styles from "@/components/opportunity-passport.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const safeToken = /^[A-Za-z0-9_-]{24,80}$/;

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params; const record = safeToken.test(token) ? await readPublicPassport(token, false) : null;
  if (!record) return { title: "Passport unavailable", robots: { index: false, follow: false } };
  return { title: `${record.passport.identity.name} — Opportunity Passport`, description: record.passport.identity.headline || "A college journey, recorded with UnlockED.", robots: { index: false, follow: false }, openGraph: { title: `${record.passport.identity.name} — Opportunity Passport`, description: record.passport.identity.headline || "A college journey, recorded with UnlockED.", type: "profile" } };
}

export default async function PublicPassportPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ moment?: string }> }) {
  const { token } = await params; if (!safeToken.test(token)) notFound();
  const record = await readPublicPassport(token); if (!record?.passport.sharingEnabled) notFound();
  const moment = (await searchParams).moment;
  return <main className={styles.publicPage}><PassportDocument model={record.passport} publicView featuredId={moment}/><p className={styles.viewCount}>{record.views === 1 ? "First view" : `${record.views.toLocaleString()} views`} · No visitor identity is collected</p></main>;
}
