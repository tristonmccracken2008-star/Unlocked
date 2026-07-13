import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { buildRecommendationDiagnosticReport } from "@/data/recommendation-engine";
import { opportunities } from "@/data/opportunities";
import { schools } from "@/data/seed";
import type { StudentActivity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import { inferApplicationsFromActivity } from "@/data/student-progress";
import { getAdminSession } from "@/lib/admin-auth";
import { eligibilitySchemaVersion } from "@/data/opportunity-eligibility-model";
import { recommendationRulesVersion } from "@/data/recommendation-config";
import { forYouCatalogVersion, forYouSnapshotEngineVersion } from "@/lib/for-you-snapshot";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recommendation Diagnostics | UnlockED Admin", robots: { index: false, follow: false } };

const school = schools.find((item) => item.slug === "university-of-chicago") ?? schools[0];
const fixtures: Array<{ id: string; label: string; profile: StudentProfile; activity: StudentActivity }> = [
  {
    id: "quant-freshman",
    label: "Freshman quantitative finance",
    profile: { firstName: "Avery", schoolSlug: school.slug, major: "Mathematics", minor: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Quantitative Finance", interests: "Finance, Data Science, Software", topics: ["Finance", "Data Science"], goals: ["Find an internship", "Build resume"], currentPriority: "Finding an internship", gpaStatus: "none_yet" },
    activity: { viewed: [], saved: [], claimed: [], tracked: {} },
  },
  {
    id: "premed-sophomore",
    label: "Sophomore pre-med research",
    profile: { firstName: "Jordan", schoolSlug: school.slug, major: "Biology / Pre-Med", graduationYear: "2029", year: "Second year", careerGoal: "Medicine", interests: "Healthcare, Research, Scholarships", topics: ["Healthcare", "Research"], goals: ["Join research", "Win scholarships"], currentPriority: "Join research", gpaStatus: "reported", gpa: 3.7 },
    activity: { viewed: [], saved: [], claimed: [], tracked: {} },
  },
];

export default async function Page() {
  const session = await getAdminSession();
  if (!session) redirect("/api/auth/google");
  const reports = fixtures.map((fixture) => {
    const progress = inferApplicationsFromActivity(fixture.activity, opportunities, { milestones: {}, applications: {} });
    const advisorProfile = createAdvisorProfile({ profile: fixture.profile, school, activity: fixture.activity, progress });
    return { fixture, report: buildRecommendationDiagnosticReport({ advisorProfile, progress, opportunities, limit: 8 }) };
  });
  return <main className="px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-7xl">
      <p className="rule-label text-forest">Internal diagnostics</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold sm:text-5xl">Recommendation diagnostics</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-ink/55">Admin-only inspection of recommendation score, reasoning, matched interests, career path, verification adjustment, timing adjustment, confidence, filters, and performance. These internals are not exposed to students.</p>
      <div className="mt-6"><DiagnosticBlock title="Active snapshot contract" value={{ engineVersion: forYouSnapshotEngineVersion, eligibilitySchemaVersion, catalogVersion: forYouCatalogVersion, recommendationRulesVersion }} /></div>
      <div className="mt-9 grid gap-6">
        {reports.map(({ fixture, report }) => <section key={fixture.id} className="rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-ink/8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <p className="rule-label text-forest">{fixture.label}</p>
              <h2 className="mt-2 font-editorial text-3xl font-bold">{report.topRecommendation?.title ?? "No recommendation"}</h2>
              <p className="mt-3 text-sm leading-6 text-ink/55">{report.topRecommendation?.reasons.slice(0, 4).join(" ") ?? "No eligible recommendation was generated."}</p>
            </div>
            <div className="rounded-2xl bg-paper p-4">
              <p className="rule-label text-ink/35">Performance</p>
              <p className="mt-2 font-editorial text-3xl font-bold">{report.performance.elapsedMs}ms</p>
              <p className="mt-2 text-xs text-ink/45">{report.performance.rankedCount} ranked · {report.performance.recommendedCount} shown</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <DiagnosticBlock title="Candidate funnel" value={report.funnel} />
            <DiagnosticBlock title="Final ranking" value={report.finalRankingOrder.slice(0, 8)} />
            <DiagnosticBlock title="Filtered" value={report.filteredRecommendations.slice(0, 8)} />
            <DiagnosticBlock title="Competing" value={report.competingOpportunities.slice(0, 8)} />
          </div>
        </section>)}
      </div>
    </div>
  </main>;
}

function DiagnosticBlock({ title, value }: { title: string; value: unknown }) {
  return <div className="rounded-2xl bg-paper/70 p-4">
    <p className="rule-label text-ink/35">{title}</p>
    <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink/55">{JSON.stringify(value, null, 2)}</pre>
  </div>;
}
