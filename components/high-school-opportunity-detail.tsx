import Link from "next/link";
import type { Opportunity } from "@/data/opportunities";
import type { OpportunityTrackerStatus } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import { deadlineLabel } from "@/data/opportunities";
import { evaluateHighSchoolEligibility } from "@/lib/high-school-opportunities";
import { OpportunityDecisionActions } from "./opportunity-decision-actions";

export function HighSchoolOpportunityDetail({
  opportunity,
  profile,
  authenticated,
  initialAdded,
  initialWatched,
  pro,
  status,
}: {
  opportunity: Opportunity;
  profile: StudentProfile | null;
  authenticated: boolean;
  initialAdded: boolean;
  initialWatched: boolean;
  pro: boolean;
  status: OpportunityTrackerStatus | null;
}) {
  const detail = opportunity.metadata.highSchool!;
  const eligibility = evaluateHighSchoolEligibility(opportunity, profile);
  const eligibleForExperienceBank = status === "Accepted" || status === "Completed";
  const officialActionAllowed = opportunity.verification_status === "verified" && opportunity.metadata.verification?.sourceReachable !== false;

  return (
    <main className="min-h-screen px-5 pb-28 pt-8 sm:px-8 sm:pb-16 sm:pt-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/opportunities" className="inline-flex min-h-10 items-center text-sm font-bold text-forest">← All opportunities</Link>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <article>
            <header className="rounded-[2rem] border border-ink/10 bg-[var(--unlocked-surface)] p-7 shadow-soft sm:p-10">
              <p className="rule-label text-forest">{detail.opportunityType} · {detail.format}</p>
              <h1 className="mt-4 max-w-4xl font-editorial text-4xl font-semibold leading-[1.04] sm:text-6xl">{opportunity.title}</h1>
              <p className="mt-4 text-sm font-semibold text-ink/45">{opportunity.organization}</p>
              <p className="mt-6 max-w-3xl text-base leading-7 text-ink/60">{opportunity.description}</p>
              <dl className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-ink/10 sm:grid-cols-3">
                <div className="bg-paper/85 p-4"><dt className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">When</dt><dd className="mt-2 text-sm font-semibold leading-5">{deadlineLabel(opportunity)}</dd></div>
                <div className="bg-paper/85 p-4"><dt className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">Where</dt><dd className="mt-2 text-sm font-semibold leading-5">{opportunity.location}</dd></div>
                <div className="bg-paper/85 p-4"><dt className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">Cost / value</dt><dd className="mt-2 text-sm font-semibold leading-5">{detail.cost.label}{opportunity.metadata.awardAmountLabel ? ` · ${opportunity.metadata.awardAmountLabel}` : ""}</dd></div>
              </dl>
            </header>

            <section className="mt-6 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6 sm:p-8">
              <p className="rule-label text-forest">The experience</p>
              <h2 className="mt-3 font-editorial text-3xl font-semibold">What you’ll actually do</h2>
              <ul className="mt-5 grid gap-3">
                {detail.activities.map((activity) => <li key={activity} className="flex gap-3 text-sm leading-6 text-ink/62"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />{activity}</li>)}
              </ul>
              <div className="mt-6 border-t border-ink/10 pt-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-ink/38">Schedule</p><p className="mt-2 text-sm leading-6">{detail.schedule}</p>{detail.programDates ? <p className="mt-1 text-sm leading-6 text-ink/52">{detail.programDates}</p> : null}</div>
            </section>

            <section className="mt-6 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6 sm:p-8">
              <p className="rule-label text-forest">Eligibility</p>
              <h2 className="mt-3 font-editorial text-3xl font-semibold">{eligibility.label}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/55">{eligibility.summary}</p>
              <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
                {eligibility.checks.map((check) => <div key={`${check.label}-${check.detail}`} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><p className={`text-xs font-bold ${check.state === "met" ? "text-forest" : check.state === "not_met" ? "text-red-700" : "text-amber-700"}`}>{check.state === "met" ? "Meets" : check.state === "not_met" ? "Does not meet" : "Needs info"} · {check.label}</p><p className="text-sm leading-6 text-ink/58">{check.detail}</p></div>)}
              </div>
              <p className="mt-5 text-sm leading-6 text-ink/58"><strong>Official eligibility:</strong> {opportunity.eligibility}</p>
              {authenticated && eligibility.state === "needs_information" ? <Link href="/profile#profile" className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-forest">Add missing profile details →</Link> : null}
            </section>

            <section className="mt-6 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6 sm:p-8">
              <p className="rule-label text-forest">Application</p>
              <h2 className="mt-3 font-editorial text-3xl font-semibold">What you’ll need</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">{detail.requirements.map((requirement) => <li key={requirement} className="rounded-xl bg-ink/[.035] p-4 text-sm leading-6">{requirement}</li>)}</ul>
              {detail.cost.financialAid ? <p className="mt-5 rounded-xl bg-mint/45 p-4 text-sm leading-6 text-forest"><strong>Cost support:</strong> {detail.cost.financialAid}</p> : null}
            </section>

            <section className="mt-6 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6 sm:p-8">
              <p className="rule-label text-ink/38">Source &amp; freshness</p>
              <p className="mt-3 text-sm leading-6 text-ink/55">Verified from the official provider on {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${opportunity.last_verified}T12:00:00Z`))}. UnlockED does not infer admissions impact, prestige, or selectivity.</p>
              <a href={opportunity.official_source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-forest">Review the official source →</a>
            </section>
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5 shadow-soft">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-ink/38">Your next step</p>
              <p className="mt-3 text-sm leading-6 text-ink/55">Watch follows verified changes. Add to Journey when you intend to pursue it.</p>
              {authenticated ? <div className="mt-5"><OpportunityDecisionActions opportunityId={opportunity.id} action={initialAdded ? { kind: "open_journey", label: "Open in Journey", href: "/admissions#opportunity-pursuits" } : { kind: "add_to_journey", label: "Add to Journey" }} initialAdded={initialAdded} initialWatched={initialWatched} pro={pro} officialSource={opportunity.official_source_url} officialLabel="Open official opportunity" officialActionAllowed={officialActionAllowed} /></div> : <div className="mt-5 grid gap-3"><Link href="/join" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-forest px-5 text-sm font-bold text-white">Create an account to save</Link><a href={opportunity.official_source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/15 px-5 text-sm font-bold">Open official opportunity</a></div>}
              {authenticated && initialAdded && !["Accepted", "Completed"].includes(status ?? "") ? <Link href={`/applications/${encodeURIComponent(opportunity.id)}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-ink/15 px-5 text-sm font-bold text-ink/70 hover:border-forest hover:text-forest">Open application workspace</Link> : null}
            </div>
            {eligibleForExperienceBank ? <Link href={`/build?sourceOpportunity=${encodeURIComponent(opportunity.id)}`} className="mt-4 block rounded-2xl border border-forest/15 bg-mint/45 p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest">Experience Bank</p><h2 className="mt-2 font-editorial text-xl font-semibold">Capture what you actually did</h2><p className="mt-2 text-xs leading-5 text-ink/50">Start from this opportunity, then confirm your role, actions, and results yourself.</p><span className="mt-4 inline-flex text-sm font-bold text-forest">Add experience →</span></Link> : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
