import Link from "next/link";
import type { College } from "@/lib/colleges";
import { collegeSizeLabel, collegeTypeLabel } from "@/lib/colleges";
import { ArrowIcon } from "./icons";
import { CollegeSaveButton } from "./college-save-button";
import { CollegeAdmissionsInsights } from "./college-admissions-insights";

const number = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (value: number | null) => value === null ? "Not reported" : `${Math.round(value * 100)}%`;
const amount = (value: number | null) => value === null ? "Not reported" : money.format(value);

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="border-t border-ink/10 py-4"><dt className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">{label}</dt><dd className="mt-1 text-lg font-semibold text-[var(--unlocked-text)]">{value}</dd>{note ? <p className="mt-1 text-xs leading-5 text-ink/42">{note}</p> : null}</div>;
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="grid gap-6 border-t border-ink/10 py-10 md:grid-cols-[15rem_minmax(0,1fr)] md:py-14"><div><p className="rule-label text-forest">{eyebrow}</p><h2 className="mt-2 font-editorial text-3xl font-semibold text-[var(--unlocked-text)]">{title}</h2></div><div>{children}</div></section>;
}

function identityNotes(college: College) {
  const notes = [`${collegeSizeLabel(college)} undergraduate population`, `${college.setting?.toLowerCase() ?? "location setting not reported"}`];
  if (college.hbcu) notes.push("federally identified HBCU");
  if (college.hsi) notes.push("federally identified Hispanic-serving institution");
  if (college.womensCollege) notes.push("women’s college");
  if (college.openAdmissions) notes.push("open admissions reported");
  return notes;
}

export function CollegeDetail({ college, similar, saved }: { college: College; similar: Array<{ college: College; reasons: string[] }>; saved: boolean }) {
  const cost = college.publishedTotalCost ?? college.tuitionInState;
  return <main className="min-h-screen px-5 pb-24 pt-10 sm:px-8 sm:pt-14"><div className="mx-auto max-w-6xl">
    <nav aria-label="Breadcrumb" className="text-xs font-bold text-ink/40"><Link href="/colleges" className="hover:text-forest">Colleges</Link><span className="px-2">/</span><span>{college.name}</span></nav>
    <header className="relative mt-7 overflow-hidden rounded-[2rem] border border-ink/10 bg-[var(--unlocked-surface)] px-6 py-10 shadow-soft sm:px-10 sm:py-12">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-forest/45 to-transparent" />
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-forest">{college.city}, {college.state}</p><h1 className="mt-3 max-w-4xl font-editorial text-4xl font-semibold leading-[1.03] text-[var(--unlocked-text)] sm:text-6xl">{college.name}</h1><p className="mt-5 text-base text-ink/55">{collegeTypeLabel(college)}{college.setting ? ` · ${college.setting}` : ""} · {number.format(college.undergraduateEnrollment)} undergraduates</p></div><div className="flex flex-wrap gap-2"><CollegeSaveButton collegeId={college.id} initialSaved={saved} />{college.website ? <a href={college.website} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white transition hover:bg-forest">Official website <ArrowIcon /></a> : null}</div></div>
      <dl className="mt-10 grid gap-x-8 border-y border-ink/10 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Admissions" value={college.openAdmissions ? "Open admissions" : pct(college.acceptanceRate)} note="Historical federal data" /><Fact label="Published annual cost" value={amount(cost)} note="Before grants and scholarships" /><Fact label="Average net price" value={amount(college.averageNetPrice)} note="After grants and scholarships, on average" /><Fact label="Graduation rate" value={pct(college.graduationRate)} note="Federal completion cohort" /></dl>
      <p className="mt-5 text-xs leading-5 text-ink/42">Federal measures can represent different reporting years. Confirm current admissions requirements and costs with the college.</p>
    </header>

    <Section eyebrow="At a glance" title="The shape of the institution"><div className="grid gap-x-8 sm:grid-cols-2"><Fact label="Institution" value={college.ownership} /><Fact label="Campus setting" value={college.setting ?? "Not reported"} /><Fact label="Undergraduate size" value={number.format(college.undergraduateEnrollment)} /><Fact label="Students per faculty member" value={college.studentFacultyRatio?.toString() ?? "Not reported"} /><Fact label="Full-time retention" value={pct(college.retentionRate)} /><Fact label="Region" value={college.region ?? "Not reported"} /></div><p className="mt-5 text-sm leading-7 text-ink/55">In the federal record, this is a {identityNotes(college).join(", ")}.</p></Section>

    <Section eyebrow="Academics" title="What students study"><p className="max-w-2xl text-sm leading-7 text-ink/55">These fields show the distribution of recent credentials in federal data. They describe what students studied—not program quality.</p>{college.programs.length ? <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 sm:grid-cols-2">{college.programs.slice(0, 12).map((program) => <Link key={program.id} href={`/colleges?program=${program.id}`} className="flex min-h-14 items-center justify-between bg-[var(--unlocked-surface)] px-4 text-sm font-bold text-[var(--unlocked-text)] hover:bg-mint/60"><span>{program.label}</span><span className="text-xs font-semibold text-ink/35">{Math.round(program.share * 100)}%</span></Link>)}</div> : <p className="mt-6 text-sm text-ink/45">Academic field distribution is not reported in this record.</p>}</Section>

    <CollegeAdmissionsInsights college={college} />

    <Section eyebrow="Cost & aid" title="Sticker price is not the whole story"><div className="grid gap-x-8 sm:grid-cols-2"><Fact label="In-state tuition" value={amount(college.tuitionInState)} /><Fact label="Out-of-state tuition" value={amount(college.tuitionOutOfState)} /><Fact label="Housing & food" value={amount(college.roomAndBoard)} /><Fact label="Published annual cost" value={amount(college.publishedTotalCost)} /><Fact label="Average net price" value={amount(college.averageNetPrice)} note="Average price after grants and scholarships in the federal dataset" /></div><p className="mt-5 max-w-2xl text-sm leading-7 text-ink/55">Published cost is the sticker price and may not reflect what a family pays. Net price subtracts grants and scholarships, but your amount can differ.</p>{college.priceCalculatorUrl ? <a href={college.priceCalculatorUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-forest/20 px-4 text-sm font-bold text-forest hover:bg-mint/60">Open official Net Price Calculator <ArrowIcon /></a> : null}</Section>

    <Section eyebrow="Environment & outcomes" title="Context for the experience"><div className="grid gap-x-8 sm:grid-cols-2"><Fact label="Setting" value={college.setting ?? "Not reported"} /><Fact label="Undergraduate enrollment" value={number.format(college.undergraduateEnrollment)} /><Fact label="Graduation rate" value={pct(college.graduationRate)} note="Completion varies by student circumstances and program" /><Fact label="Median earnings" value={amount(college.medianEarnings10Years)} note="Measured after entry; not caused solely by attendance" /></div><div className="mt-6 border-l-2 border-forest/30 pl-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-forest">General size tradeoff</p><p className="mt-2 max-w-2xl text-sm leading-7 text-ink/55">{collegeSizeLabel(college) === "Small" ? "Smaller institutions can offer closer academic communities, while often providing fewer programs and organizations. This is general guidance, not a school-specific judgment." : "Larger institutions can offer broad program and organization choices, while sometimes requiring more self-navigation. This is general guidance, not a school-specific judgment."}</p></div></Section>

    <Section eyebrow="Related exploration" title="Similar colleges"><div className="divide-y divide-ink/10 border-y border-ink/10">{similar.map((item) => <Link key={item.college.id} href={`/colleges/${item.college.slug}`} className="group flex items-center justify-between gap-5 py-5"><span><strong className="block font-editorial text-xl text-[var(--unlocked-text)] group-hover:text-forest">{item.college.name}</strong><small className="mt-1 block text-xs leading-5 text-ink/45">{item.college.city}, {item.college.state} · {item.reasons.join(" · ")}</small></span><ArrowIcon className="h-4 w-4 shrink-0 text-forest" /></Link>)}</div><p className="mt-4 text-xs leading-5 text-ink/40">Related colleges are selected deterministically from institution type, setting, size, region, and overlapping popular fields. There is no similarity score or ranking.</p></Section>

    <Section eyebrow="Sources & data" title="Where these facts come from"><div className="rounded-xl border border-ink/10 p-5"><p className="text-sm font-bold text-[var(--unlocked-text)]">U.S. Department of Education College Scorecard</p><p className="mt-2 text-sm leading-6 text-ink/50">Institution-level federal data released May 19, 2025. Individual measures may come from different reporting years and may be suppressed or unavailable.</p><a href="https://collegescorecard.ed.gov/data/" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-bold text-forest">View source and documentation →</a></div></Section>
  </div></main>;
}
