import type { Metadata } from "next";
import Link from "next/link";
import { getColleges, collegeSizeLabel } from "@/lib/colleges";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { cdsFactorLabels, derivedRate, latestCollegeCds } from "@/lib/college-admissions-insights";
import { collegeApplicationPlanLabels, verifiedCollegeAdmissions, verifiedCollegeTestingPolicies } from "@/data/college-admissions";
import type { CdsAdmissionFactor } from "@/data/college-cds";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare Colleges", robots: { index: false, follow: false } };
const number = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const display = (value: number | null, type: "number" | "money" | "percent" = "number") => value === null ? "Not reported" : type === "money" ? money.format(value) : type === "percent" ? `${Math.round(value * 100)}%` : number.format(value);
const cdsValue = (collegeId: string, get: (snapshot: NonNullable<ReturnType<typeof latestCollegeCds>>) => string) => { const snapshot = latestCollegeCds(collegeId); return snapshot ? `${get(snapshot)} · CDS ${snapshot.academicYear}` : "Not reported"; };

export default async function CompareCollegesPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await requireHighSchoolStage();
  const ids = (await searchParams).ids?.split(",").filter(Boolean).slice(0, 4) ?? [];
  const colleges = getColleges(ids);
  if (colleges.length < 2) return <main className="min-h-screen px-5 py-16 sm:px-8"><div className="mx-auto max-w-3xl text-center"><p className="rule-label text-forest">Compare</p><h1 className="mt-4 font-editorial text-5xl font-semibold">Choose 2–4 colleges.</h1><p className="mt-4 text-ink/50">Comparison is most useful when you begin from the explorer.</p><Link href="/colleges" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-bold text-white">Open College Explorer</Link></div></main>;
  const rows: Array<[string, (college: (typeof colleges)[number]) => string]> = [
    ["Location", (college) => `${college.city}, ${college.state}`], ["Institution", (college) => college.ownership], ["Setting", (college) => college.setting ?? "Not reported"],
    ["Undergraduate size", (college) => `${display(college.undergraduateEnrollment)} · ${collegeSizeLabel(college)}`], ["Acceptance rate", (college) => college.openAdmissions ? "Open admissions" : display(college.acceptanceRate, "percent")],
    ["SAT reading", (college) => college.satReadingRange.every((value) => value !== null) ? college.satReadingRange.join("–") : "Not reported"],
    ["SAT math", (college) => college.satMathRange.every((value) => value !== null) ? college.satMathRange.join("–") : "Not reported"], ["ACT composite", (college) => college.actRange.every((value) => value !== null) ? college.actRange.join("–") : "Not reported"],
    ["CDS applicants", (college) => cdsValue(college.id, (snapshot) => snapshot.admissions?.applicants === undefined ? "Not reported" : number.format(snapshot.admissions.applicants))],
    ["CDS admitted", (college) => cdsValue(college.id, (snapshot) => snapshot.admissions?.admitted === undefined ? "Not reported" : number.format(snapshot.admissions.admitted))],
    ["CDS enrollment yield", (college) => cdsValue(college.id, (snapshot) => { const result = derivedRate(snapshot.admissions?.enrolled, snapshot.admissions?.admitted); return result === undefined ? "Not reported" : `${Math.round(result * 1000) / 10}%`; })],
    ["Reported as Very Important", (college) => cdsValue(college.id, (snapshot) => Object.entries(snapshot.factors ?? {}).filter(([, importance]) => importance === "very_important").map(([factor]) => cdsFactorLabels[factor as CdsAdmissionFactor]).join(", ") || "None reported")],
    ["CDS test ranges", (college) => cdsValue(college.id, (snapshot) => { const tests = snapshot.testing; if (!tests) return "Not reported"; return [tests.satComposite ? `SAT ${tests.satComposite.join("–")}` : null, tests.actComposite ? `ACT ${tests.actComposite.join("–")}` : null].filter(Boolean).join(" · ") || "Not reported"; })],
    ["Current testing policy", (college) => { const policy = verifiedCollegeTestingPolicies[college.id]; return policy ? `${policy.label} · ${policy.cycle}` : "Needs verification"; }],
    ["Current application plans", (college) => verifiedCollegeAdmissions[college.id]?.validPlans.map((plan) => collegeApplicationPlanLabels[plan]).join(", ") || "Not verified"],
    ["Recommendation requirements", (college) => verifiedCollegeAdmissions[college.id]?.requirements.filter((item) => /recommend|teacher evaluation|counselor/i.test(item.title)).map((item) => item.title).join(", ") || "Not verified"],
    ["Class rank reporting", (college) => cdsValue(college.id, (snapshot) => snapshot.classRank ? `${snapshot.classRank.reportingPercent}% reported rank` : "Not reported")],
    ["Published annual cost", (college) => display(college.publishedTotalCost, "money")], ["Average net price", (college) => display(college.averageNetPrice, "money")], ["Graduation rate", (college) => display(college.graduationRate, "percent")],
    ["Popular fields", (college) => college.programs.slice(0, 4).map((program) => program.label).join(", ") || "Not reported"], ["Median earnings", (college) => display(college.medianEarnings10Years, "money")],
  ];
  return <main className="min-h-screen overflow-x-hidden px-5 pb-28 pt-12 sm:px-8"><div className="mx-auto max-w-7xl"><p className="rule-label text-forest">Difference first</p><h1 className="mt-3 font-editorial text-5xl font-semibold text-[var(--unlocked-text)]">Compare colleges</h1><p className="mt-4 max-w-2xl text-base leading-7 text-ink/52">See factual differences side by side. There is no winner—only the shape of each option.</p>
    <section className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">{colleges.map((college) => <div key={college.id} className="bg-[var(--unlocked-surface)] p-5"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">{college.city}, {college.state}</p><Link href={`/colleges/${college.slug}`} className="mt-2 block font-editorial text-2xl font-semibold leading-tight text-[var(--unlocked-text)] hover:text-forest">{college.name}</Link><p className="mt-4 text-sm leading-6 text-ink/50">{college.ownership} · {college.setting ?? "setting not reported"}<br />{collegeSizeLabel(college)} undergraduate population</p></div>)}</section>
    <p className="mt-8 text-xs leading-5 text-ink/40">College Scorecard and CDS values are historical and may reflect different cohorts. CDS factor categories are institutional labels, not scores or rankings. Confirm current requirements with each institution.</p>
    <div className="mt-5 divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] shadow-soft sm:hidden">{rows.map(([label, format]) => { const values = colleges.map(format); const differs = new Set(values).size > 1; return <section key={label} className={differs ? "bg-mint/20 p-4" : "p-4"}><h2 className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/45">{label}{differs ? <span className="ml-2 text-forest">Differs</span> : null}</h2><dl className="mt-3 grid gap-3">{colleges.map((college, index) => <div key={college.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-3 text-sm"><dt className="font-bold leading-5 text-[var(--unlocked-text)]">{college.name}</dt><dd className="leading-5 text-ink/60">{values[index]}</dd></div>)}</dl></section>; })}</div>
    <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] shadow-soft sm:block"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="border-b border-ink/10"><th className="w-44 p-4 text-[10px] uppercase tracking-[.12em] text-ink/40">Dimension</th>{colleges.map((college) => <th key={college.id} className="p-4 text-sm font-bold text-[var(--unlocked-text)]">{college.name}</th>)}</tr></thead><tbody>{rows.map(([label, format]) => { const values = colleges.map(format); const differs = new Set(values).size > 1; return <tr key={label} className={`border-t border-ink/8 ${differs ? "bg-mint/25" : ""}`}><th className="p-4 text-xs font-bold text-ink/50">{label}{differs ? <span className="ml-2 text-[9px] uppercase tracking-[.1em] text-forest">Differs</span> : null}</th>{colleges.map((college, index) => <td key={college.id} className="p-4 text-sm leading-6 text-ink/65">{values[index]}</td>)}</tr>; })}</tbody></table></div>
    <Link href="/colleges" className="mt-7 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-forest hover:bg-mint/60">← Back to explorer</Link>
  </div></main>;
}
