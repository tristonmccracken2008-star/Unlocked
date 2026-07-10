import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdvisorReviewCases } from "@/lib/advisor/review";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Advisor review | UnlockED Admin", robots: { index: false, follow: false } };

export default async function AdvisorReviewPage() {
  const session = await getAdminSession();
  if (!session) redirect("/api/auth/google");
  const cases = getAdvisorReviewCases();
  return <main className="px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-7xl">
      <p className="rule-label text-forest">Internal maintenance</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold sm:text-5xl">Advisor review</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-ink/55">Inspect deterministic Advisor output for realistic student fixtures. This page is admin-only and is not linked from the public product navigation.</p>
      <div className="mt-9 grid gap-5">
        {cases.map((item) => <section key={item.id} className="rounded-[1.5rem] bg-paper px-5 py-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <p className="rule-label text-forest">{item.careerId.replace("career.", "").replaceAll("-", " ")}</p>
              <h2 className="mt-2 font-editorial text-2xl font-bold tracking-[-.02em]">{item.label}</h2>
              {item.finalRecommendation ? <>
                <p className="mt-4 text-sm font-bold text-ink/70">Final recommendation</p>
                <p className="mt-2 text-sm leading-6 text-ink/55">{item.finalRecommendation.coaching.recommendation}</p>
                <p className="mt-2 text-xs leading-5 text-ink/45"><span className="font-bold">Why now:</span> {item.finalRecommendation.coaching.whyNow}</p>
                <p className="mt-1 text-xs leading-5 text-ink/45"><span className="font-bold">Ranked above alternatives:</span> {item.finalRecommendation.coaching.whyRankedAboveAlternatives}</p>
                <p className="mt-1 text-xs leading-5 text-ink/45"><span className="font-bold">Evidence:</span> {item.finalRecommendation.coaching.evidenceProduced}</p>
              </> : <p className="mt-4 text-sm text-ink/50">No final recommendation generated.</p>}
            </div>
            <div className="rounded-2xl bg-white px-4 py-4">
              <p className="rule-label text-ink/35">Confidence</p>
              <p className="mt-2 font-editorial text-3xl font-bold">{item.confidence}%</p>
              <p className="mt-2 text-xs leading-5 text-ink/45">{item.confidenceExplanation}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <ReviewBlock title="Normalized profile" value={item.normalizedProfile} />
            <ReviewBlock title="Rules fired" value={item.rulesFired} />
            <ReviewBlock title="Candidates" value={item.recommendationCandidates} />
            <ReviewBlock title="Alternatives" value={item.alternatives} />
            <ReviewBlock title="Source IDs" value={item.sourceIds} />
            <ReviewBlock title="Suppressed" value={item.suppressedRecommendations} />
            <ReviewBlock title="Opportunity matches" value={item.opportunityMatches.slice(0, 3)} />
            <ReviewBlock title="Feedback effects" value={item.feedbackEffects} />
            <ReviewBlock title="Recommendation chain" value={item.recommendationChain} />
          </div>
        </section>)}
      </div>
    </div>
  </main>;
}

function ReviewBlock({ title, value }: { title: string; value: unknown }) {
  return <div className="rounded-2xl bg-white px-4 py-4">
    <p className="rule-label text-ink/35">{title}</p>
    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink/55">{JSON.stringify(value, null, 2)}</pre>
  </div>;
}
