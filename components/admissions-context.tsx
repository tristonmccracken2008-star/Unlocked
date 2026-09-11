import Link from "next/link";
import type { AdmissionsIntelligenceModel } from "@/lib/admissions-intelligence";

const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const dateLabel = (value: string) => date.format(new Date(`${value}T12:00:00Z`));

function RecordLine({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="border-t border-ink/10 py-4 first:border-t-0 first:pt-0"><dt className="text-[10px] font-bold uppercase tracking-[.13em] text-ink/38">{label}</dt><dd className="mt-1.5 text-base font-semibold text-[var(--unlocked-text)]">{value}</dd>{note ? <p className="mt-1 text-xs leading-5 text-ink/45">{note}</p> : null}</div>;
}

export function AdmissionsContext({ model }: { model: AdmissionsIntelligenceModel }) {
  return <section id="your-admissions-context" className="border-t border-ink/10 py-10 md:py-14">
    <div className="grid gap-7 md:grid-cols-[15rem_minmax(0,1fr)]">
      <div>
        <p className="rule-label text-forest">Private · saved college</p>
        <h2 className="mt-2 font-editorial text-3xl font-semibold text-[var(--unlocked-text)]">Your admissions context</h2>
        <p className="mt-3 text-xs leading-5 text-ink/44">Official institution evidence and your own recorded information, kept distinct. No score or admission prediction.</p>
      </div>
      <div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-3">
          <div className="bg-[var(--unlocked-surface)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-forest">College reports</p><p className="mt-2 text-xs leading-5 text-ink/50">Official current guidance and institution-reported Common Data Set evidence.</p></div>
          <div className="bg-[var(--unlocked-surface)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-forest">Your record</p><p className="mt-2 text-xs leading-5 text-ink/50">Private information you recorded in Academics, Testing, and Experiences.</p></div>
          <div className="bg-[var(--unlocked-surface)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-forest">UnlockED context</p><p className="mt-2 text-xs leading-5 text-ink/50">Deterministic connections between those sources, without judging them.</p></div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="flex items-baseline justify-between gap-4"><h3 className="font-editorial text-2xl font-semibold text-[var(--unlocked-text)]">Your academic record</h3><Link href="/academics" className="shrink-0 text-xs font-bold text-forest hover:underline">Open Academics →</Link></div>
            {model.reports.academicFactors.length ? <p className="mt-4 text-xs leading-5 text-ink/48"><strong className="font-bold text-forest">College reports</strong> · {model.reports.academicFactors.map((item) => `${item.label} — ${item.importance}`).join(" · ")}</p> : null}
            <dl className="mt-5 border-y border-ink/10 py-4">
              <RecordLine label="GPA" value={model.academics.gpas.join(" · ") || "No GPA recorded"} note="Shown on the scale you recorded; scales are not converted." />
              <RecordLine label="Coursework" value={model.academics.coursework} note={model.academics.courseDetail.join(" · ") || "No advanced-course labels recorded"} />
              <RecordLine label="Class rank" value={model.academics.classRank} />
              <RecordLine label="Best recorded official testing" value={[model.academics.bestSat ? `SAT ${model.academics.bestSat}` : "", model.academics.bestAct ? `ACT ${model.academics.bestAct}` : ""].filter(Boolean).join(" · ") || "No SAT or ACT recorded"} note="The historical range visualization above uses this record where institutional data exists." />
            </dl>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-4"><h3 className="font-editorial text-2xl font-semibold text-[var(--unlocked-text)]">Current application</h3><Link href={`/colleges/${model.college.slug}/application`} className="sr-only">Open application</Link></div>
            <dl className="mt-5 border-y border-ink/10 py-4">
              <RecordLine label="Plan" value={model.application.plan} note={`Status: ${model.application.status}`} />
              <RecordLine label="Next verified deadline" value={model.application.deadline ? dateLabel(model.application.deadline.date) : "No deadline verified for this plan"} note={model.application.deadline ? `${model.application.deadline.label} · ${model.application.deadline.cycle}` : undefined} />
              <RecordLine label="Current testing policy" value={model.reports.testingPolicy?.label ?? "Needs verification"} note={model.reports.testingPolicy ? `${model.reports.testingPolicy.cycle} · verified ${dateLabel(model.reports.testingPolicy.verifiedAt)}` : "A historical CDS is not used as current policy."} />
            </dl>
          </div>
        </div>

        {model.factors.length ? <div className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-forest">Reported factors × your record</p><h3 className="mt-2 font-editorial text-2xl font-semibold text-[var(--unlocked-text)]">What the college considers</h3></div><Link href="/build" className="text-xs font-bold text-forest hover:underline">View Experiences →</Link></div>
          <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">{model.factors.map((item) => <article key={item.factor} className="grid gap-4 py-5 sm:grid-cols-[minmax(11rem,.7fr)_minmax(0,1.3fr)] sm:gap-8">
            <div><h4 className="text-sm font-bold text-[var(--unlocked-text)]">{item.label}</h4><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-forest">College reports · {item.importanceLabel}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">{item.recordLabel}</p>{item.recordItems.length ? <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm leading-6 text-ink/62">{item.recordItems.map((record, index) => <li key={`${record}-${index}`}>{record}{index < item.recordItems.length - 1 ? <span className="ml-2 text-ink/20">·</span> : null}</li>)}</ul> : <p className="mt-2 text-sm leading-6 text-ink/52">{item.recordEmpty}</p>}</div>
          </article>)}</div>
        </div> : null}

        <div className="mt-12 grid gap-8 border-t border-ink/10 pt-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,.65fr)]">
          <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-forest">Current requirements</p><h3 className="mt-2 font-editorial text-2xl font-semibold text-[var(--unlocked-text)]">Application evidence</h3>{model.application.requirements.length ? <div className="mt-4 divide-y divide-ink/10">{model.application.requirements.map((requirement) => <div key={requirement.id} className="flex items-start justify-between gap-5 py-3 text-sm"><span className="font-semibold text-[var(--unlocked-text)]">{requirement.title}<small className="mt-1 block text-[10px] font-bold uppercase tracking-[.1em] text-ink/35">{requirement.verified ? "Official verified requirement" : "Student added"}</small></span><span className="shrink-0 text-right text-ink/52">{requirement.status}</span></div>)}</div> : model.application.officialRequirements.length ? <div className="mt-4 divide-y divide-ink/10">{model.application.officialRequirements.map((requirement) => <div key={requirement.id} className="flex items-start justify-between gap-5 py-3 text-sm"><span className="font-semibold text-[var(--unlocked-text)]">{requirement.title}</span><span className="shrink-0 text-ink/45">Not yet tracked</span></div>)}</div> : <p className="mt-4 text-sm leading-6 text-ink/52">Current application requirements have not been verified in UnlockED.</p>}<Link href={`/colleges/${model.college.slug}/application`} className="mt-4 inline-flex min-h-10 items-center rounded-full border border-forest/20 px-4 text-sm font-bold text-forest hover:bg-mint/60">Open application workspace →</Link></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-ink/38">What we don’t know yet</p>{model.unknowns.length ? <ul className="mt-3 space-y-2">{model.unknowns.map((unknown) => <li key={unknown} className="border-l border-ink/15 pl-3 text-xs leading-5 text-ink/50">{unknown}</li>)}</ul> : <p className="mt-3 text-xs leading-5 text-ink/50">No material gaps are identified in the connected evidence.</p>}</div>
        </div>

        <div className="mt-10 rounded-2xl bg-mint/45 px-5 py-6 sm:px-7"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-forest">What this means</p><p className="mt-3 max-w-3xl font-editorial text-xl leading-8 text-[var(--unlocked-text)]">{model.summary}</p></div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] leading-5 text-ink/42"><span>Private to your account</span>{model.reports.academicYear ? <span>Admissions factors · CDS {model.reports.academicYear}</span> : null}{model.reports.cohortLabel ? <span>{model.reports.cohortLabel}</span> : null}{model.application.cycle ? <span>Application guidance · {model.application.cycle}</span> : null}{model.reports.sourceUrl ? <a href={model.reports.sourceUrl} target="_blank" rel="noreferrer" className="font-bold text-forest hover:underline">Open CDS source</a> : null}{model.application.sourceUrl ? <a href={model.application.sourceUrl} target="_blank" rel="noreferrer" className="font-bold text-forest hover:underline">Open current admissions source</a> : null}</div>
      </div>
    </div>
  </section>;
}
