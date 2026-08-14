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
    ["Lifecycle stale", report.totals.lifecycleStale],
    ["Lifecycle conflicts", report.totals.lifecycleConflicts],
    ["User reports", report.totals.lifecycleReports],
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
        <Coverage title="Lifecycle states" rows={Object.entries(report.totals.lifecycle) as [string, number][]} />
        <Coverage title="Coverage by category" rows={report.coverage.byCategory.slice(0, 18)} />
        <Coverage title="Coverage by class year" rows={report.coverage.byYear} />
        <Coverage title="Largest quality gaps" rows={report.gaps} />
        <Coverage title="Coverage by major" rows={report.coverage.byMajor.slice(0, 18)} />
      </div>
      <section className="mt-12 border-t border-ink/15 pt-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-editorial text-3xl font-bold">Acquisition queue</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/50">Official-source candidates prioritized by coverage impact, quality, maintenance cost, and verification effort. Rejected candidates stay visible so the same uncertainty is not researched repeatedly.</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink/45">{report.acquisition.totals.recommendationSafe} safe · {report.acquisition.totals.rejected} rejected · {report.acquisition.totals.sourceWatch} watched</p>
        </div>
        <div className="mt-5 divide-y divide-ink/10 border-y border-ink/15">{report.acquisition.queue.map((item) => <article key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-ink/45">{item.organization} · {item.type} · priority {item.priority} · {item.verificationEffort} effort</p><p className="mt-2 text-sm leading-6 text-ink/55">{item.dispositionReason}</p><p className="mt-2 text-xs text-ink/45">Coverage: {item.coverageGaps.join(", ")} · Students: {item.targetStudentGroups.join(", ")}</p>{item.sourceWatch?<p className="mt-2 text-xs font-bold text-amber-800">Recheck {item.sourceWatch.expectedReviewAt}: {item.sourceWatch.reason}</p>:null}</div><span className="w-fit rounded-sm border border-ink/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-forest">{item.status.replaceAll("_", " ")}</span></article>)}</div>
      </section>
      <section className="mt-12 border-t border-ink/15 pt-7">
        <h2 className="font-editorial text-3xl font-bold">Recommendation-safety queue</h2>
        <p className="mt-2 text-sm leading-6 text-ink/50">Prioritized by student coverage value, source readiness, lifecycle, and review effort. A queue position never implies that an unreviewed fact is safe.</p>
        <div className="mt-5 divide-y divide-ink/10 border-y border-ink/15">{report.recommendationSafety.queue.slice(0,20).map((item) => <article key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><Link href={`/opportunities/${item.id}`} className="font-bold hover:text-forest">{item.id}</Link><p className="mt-1 text-xs text-ink/45">Priority {item.priority} · {item.effort} effort · {item.sourceAuthority.replaceAll("_", " ")} source · {item.lifecycle.replaceAll("_", " ")}</p><p className="mt-2 text-sm text-ink/55">{item.blockers.map((blocker) => blocker.replaceAll("_", " ")).join(" · ")}</p>{item.missingEvidenceFields.length?<p className="mt-2 text-xs text-ink/45">Evidence to review: {item.missingEvidenceFields.map((field) => field.replaceAll("_", " ")).join(", ")}</p>:null}</div><Link href="/admin/content" className="text-xs font-bold uppercase tracking-wider text-forest">Review record</Link></article>)}</div>
      </section>
      <section className="mt-12 border-t border-ink/15 pt-7">
        <h2 className="font-editorial text-3xl font-bold">Lifecycle review</h2>
        <p className="mt-2 text-sm leading-6 text-ink/50">Ambiguous records remain non-actionable until an authorized review confirms current evidence. User reports are review signals and never change public state directly.</p>
        <div className="mt-5 divide-y divide-ink/10 border-y border-ink/15">{report.lifecycleReviewQueue.slice(0,20).map((item) => <article key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><Link href={`/opportunities/${item.id}`} className="font-bold hover:text-forest">{item.id}</Link><p className="mt-1 text-xs text-ink/45">{item.organization} · {item.state.replaceAll("_"," ")} · {item.confidence}</p><p className="mt-2 text-sm text-ink/55">{item.issues.map((issue) => issue.message).join(" · ") || "Current state is not confirmed."}</p>{item.reports?<p className="mt-2 text-xs font-bold text-amber-800">{item.reports.total} report{item.reports.total===1?"":"s"} from {item.reports.independentReporters} independent account{item.reports.independentReporters===1?"":"s"}</p>:null}</div><Link href="/admin/content" className="text-xs font-bold uppercase tracking-wider text-forest">Review record</Link></article>)}</div>
      </section>
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
