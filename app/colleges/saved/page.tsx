import type { Metadata } from "next";
import Link from "next/link";
import { CollegeSaveButton } from "@/components/college-save-button";
import { ArrowIcon } from "@/components/icons";
import { getColleges } from "@/lib/colleges";
import { requireHighSchoolStage } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved Colleges", robots: { index: false, follow: false } };
const number = new Intl.NumberFormat("en-US");

export default async function SavedCollegesPage() {
  const session = await requireHighSchoolStage();
  const records = [...(session.data.savedColleges ?? [])].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const colleges = getColleges(records.map((item) => item.collegeId));
  return <main className="min-h-screen px-5 pb-28 pt-12 sm:px-8 sm:pt-16"><div className="mx-auto max-w-5xl">
    <p className="rule-label text-forest">Your exploration</p><div className="mt-3 flex flex-wrap items-end justify-between gap-5"><div><h1 className="font-editorial text-5xl font-semibold text-[var(--unlocked-text)]">Saved colleges</h1><p className="mt-4 max-w-xl text-base leading-7 text-ink/52">Places you want to understand more deeply. Saving does not start an application.</p></div><Link href="/colleges" className="inline-flex min-h-11 items-center rounded-full border border-ink/10 px-4 text-sm font-bold text-forest hover:bg-mint/60">Explore colleges</Link></div>
    {colleges.length ? <div className="mt-10 overflow-hidden rounded-[1.75rem] border border-ink/10 bg-[var(--unlocked-surface)] px-5 shadow-soft sm:px-8">{colleges.map((college) => <article key={college.id} className="group flex flex-col justify-between gap-5 border-t border-ink/10 py-6 first:border-t-0 sm:flex-row sm:items-center"><Link href={`/colleges/${college.slug}`} className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">{college.city}, {college.state} · {college.ownership}{college.setting ? ` · ${college.setting}` : ""}</p><h2 className="mt-2 flex items-center gap-2 font-editorial text-2xl font-semibold text-[var(--unlocked-text)] group-hover:text-forest">{college.name}<ArrowIcon className="h-4 w-4" /></h2><p className="mt-2 text-sm text-ink/48">{number.format(college.undergraduateEnrollment)} undergraduates · {college.programs.slice(0, 2).map((item) => item.label).join(" · ")}</p></Link><CollegeSaveButton collegeId={college.id} initialSaved compact /></article>)}</div> : <div className="mt-12 rounded-[1.75rem] border border-dashed border-ink/15 p-10 text-center sm:p-16"><h2 className="font-editorial text-3xl font-semibold text-[var(--unlocked-text)]">Start with curiosity.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/50">Save a college when you want to return to it—not because you have decided to apply.</p><Link href="/colleges" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-bold text-white">Open College Explorer</Link></div>}
  </div></main>;
}
