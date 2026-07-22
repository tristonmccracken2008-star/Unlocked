import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { getOpportunityCatalogReport } from "@/lib/opportunity-catalog-report";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Opportunity intelligence | UnlockED Admin", robots: { index: false, follow: false } };

export default async function OpportunityIntelligencePage() {
  const session = await getAdminSession();
  if (!session) redirect("/api/auth/google");
  const report = await getOpportunityCatalogReport();
  const metrics = [
    ["Catalog records", report.totals.records],
    ["Verified", report.totals.verified],
    ["Pro eligible", report.totals.recommendationEligible],
    ["Partially verified", report.totals.partiallyVerified],
    ["Needs review", report.totals.needsReview],
    ["Excluded", report.totals.excluded],
    ["Duplicate records", report.totals.duplicateRecords],
    ["Missing eligibility", report.totals.missingEligibility],
    ["Missing deadlines", report.totals.missingDeadlines],
    ["Missing logos", report.totals.missingLogos],
  ] as const;
  return <main className="px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-7xl">
      <p className="rule-label text-forest">Internal catalog health</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold sm:text-5xl">Opportunity intelligence</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-ink/55">A read-only view of confidence, eligibility, freshness, duplicate, enrichment, and coverage gaps. Scores are internal and never shown to students.</p>
      <dl className="mt-9 grid gap-px bg-ink/15 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(([label, value]) => <div key={label} className="bg-white p-5"><dt className="rule-label text-ink/35">{label}</dt><dd className="mt-3 font-editorial text-3xl font-bold">{value.toLocaleString()}</dd></div>)}
      </dl>
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <Coverage title="Coverage by category" rows={report.coverage.byCategory.slice(0, 18)} />
        <Coverage title="Coverage by class year" rows={report.coverage.byYear} />
        <Coverage title="Largest quality gaps" rows={report.gaps} />
        <Coverage title="Coverage by major" rows={report.coverage.byMajor.slice(0, 18)} />
      </div>
      <section className="mt-12 border-t border-ink/15 pt-7">
        <h2 className="font-editorial text-3xl font-bold">Duplicate review</h2>
        <p className="mt-2 text-sm leading-6 text-ink/50">Secondary records are suppressed from Discover and Pro recommendations while source metadata remains available for review.</p>
        {report.duplicateGroups.length ? <div className="mt-5 divide-y divide-ink/10 border-y border-ink/15">{report.duplicateGroups.map((group) => <article key={group.canonicalId} className="py-5">
          <p className="rule-label text-forest">Canonical record</p>
          <Link className="mt-2 inline-block font-bold hover:text-forest" href={`/opportunities/${group.canonicalId}`}>{group.canonicalId}</Link>
          <p className="mt-2 text-sm text-ink/50">{group.ids.length - 1} duplicate · {group.reasons.join(" · ")}</p>
        </article>)}</div> : <p className="mt-5 text-sm text-ink/45">No duplicate groups detected.</p>}
      </section>
      <p className="mt-10 text-xs text-ink/35">Platform {report.version} · Generated {new Date(report.generatedAt).toLocaleString()} · {report.totals.behaviorSamples.toLocaleString()} aggregate behavior samples</p>
    </div>
  </main>;
}

function Coverage({ title, rows }: { title: string; rows: [string, number][] }) {
  return <section className="border-t border-ink/15 pt-5"><h2 className="font-editorial text-2xl font-bold">{title}</h2><ol className="mt-4 divide-y divide-ink/10">{rows.map(([label, count]) => <li key={label} className="flex items-center justify-between gap-4 py-3 text-sm"><span>{label}</span><span className="font-mono text-xs text-ink/40">{count.toLocaleString()}</span></li>)}</ol></section>;
}
