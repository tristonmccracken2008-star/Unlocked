import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminReview } from "@/components/admin-review";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Opportunity review | UnlockED Admin", robots: { index: false, follow: false } };
export default async function Page() { const session = await getAdminSession(); if (!session) redirect("/api/auth/google"); return <main className="px-5 py-10 sm:px-8 sm:py-14"><div className="mx-auto max-w-7xl"><p className="rule-label text-forest">Internal maintenance</p><h1 className="mt-3 font-editorial text-4xl font-bold sm:text-5xl">Opportunity review</h1><p className="mt-4 max-w-3xl text-base leading-7 text-ink/55">Review stale, expiring, incomplete, and recently verified records. Automated flags are calculated from the canonical opportunity catalog.</p><div className="mt-9"><AdminReview /></div></div></main>; }
