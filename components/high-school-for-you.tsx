"use client";

import Link from "next/link";
import { useState } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import type {
  HighSchoolForYouModel,
  HighSchoolForYouOpportunity,
} from "@/lib/high-school-for-you";
import { ArrowIcon, CalendarIcon, CheckCircleIcon, SparkIcon } from "./icons";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: string) {
  return dateFormat.format(new Date(`${date}T12:00:00Z`));
}

function OpportunityFeedback({
  item,
  onHide,
}: {
  item: HighSchoolForYouOpportunity;
  onHide: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = async (feedbackType: "not-interested" | "dismissed") => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const id = item.opportunity.id;
      const response = await authenticatedFetch("/api/advisor/feedback", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: `recommendation-opportunity-${id}`,
          actionId: `opportunity:${id}`,
          requestId: crypto.randomUUID(),
          signal: `category:${item.opportunity.category}`,
          feedbackType,
          reason:
            feedbackType === "dismissed"
              ? "Student already knew about this opportunity."
              : "Student is not interested in this opportunity.",
        }),
      });
      if (!response.ok) throw new Error("Feedback could not be saved.");
      onHide();
    } catch {
      setError("Could not save that just now.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-ink/40">
      <button
        type="button"
        disabled={pending}
        onClick={() => void save("not-interested")}
        className="rounded-md py-1 transition hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/35 disabled:opacity-50"
      >
        Not interested
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => void save("dismissed")}
        className="rounded-md py-1 transition hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/35 disabled:opacity-50"
      >
        Already knew about this
      </button>
      {error ? <span role="alert" className="text-red-700">{error}</span> : null}
    </div>
  );
}

function OpportunityCard({
  item,
  featured = false,
  onHide,
}: {
  item: HighSchoolForYouOpportunity;
  featured?: boolean;
  onHide: () => void;
}) {
  const opportunity = item.opportunity;
  const highSchool = opportunity.metadata.highSchool;
  const eligibilityTone =
    item.eligibility.state === "eligible"
      ? "bg-forest/[.08] text-forest"
      : "bg-amber-600/[.09] text-amber-800 dark:text-amber-300";

  return (
    <article
      className={`group relative overflow-hidden border border-ink/10 bg-[var(--unlocked-surface)] transition duration-300 hover:border-forest/20 hover:shadow-soft ${featured ? "rounded-[1.75rem] p-6 sm:p-8" : "rounded-2xl p-5 sm:p-6"}`}
    >
      {featured ? (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-forest/45 to-transparent" />
      ) : null}
      <div className={featured ? "grid gap-7 md:grid-cols-[1fr_auto] md:items-start" : ""}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[.14em] text-forest/70">
              {opportunity.category}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${eligibilityTone}`}>
              {item.eligibility.label}
            </span>
          </div>
          <h3 className={`${featured ? "mt-4 max-w-2xl text-3xl sm:text-[2rem]" : "mt-3 text-xl"} font-editorial font-semibold leading-tight text-[var(--unlocked-text)]`}>
            {opportunity.title}
          </h3>
          <p className="mt-2 text-sm font-semibold text-ink/48">
            {opportunity.organization}
          </p>
          <p className={`${featured ? "mt-5 max-w-2xl" : "mt-4"} text-sm leading-6 text-ink/58`}>
            {opportunity.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-ink/48">
            {opportunity.application_deadline ? (
              <span>Closes {formatDate(opportunity.application_deadline)}</span>
            ) : null}
            <span>{highSchool?.format}</span>
            <span>{highSchool?.cost.label}</span>
          </div>
          <div className="mt-5 border-l border-forest/25 pl-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-ink/38">
              Why it is here
            </p>
            <ul className="mt-2 space-y-1.5 text-sm leading-5 text-ink/60">
              {item.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
              {!item.reasons.length ? <li>{item.eligibility.summary}</li> : null}
            </ul>
          </div>
        </div>
        <div className={`${featured ? "md:w-48 md:pt-8" : "mt-5"} flex flex-col items-start gap-3`}>
          <Link
            href={`/opportunities/${opportunity.id}`}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white transition hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/35 focus-visible:ring-offset-2"
          >
            View opportunity <ArrowIcon />
          </Link>
          <OpportunityFeedback item={item} onHide={onHide} />
        </div>
      </div>
    </article>
  );
}

export function HighSchoolForYou({ model }: { model: HighSchoolForYouModel }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const topPicks = model.topPicks.filter(
    (item) => !hidden.includes(item.opportunity.id),
  );
  const explorations = model.explorations.filter(
    (item) => !hidden.includes(item.opportunity.id),
  );
  const hide = (id: string) => setHidden((items) => [...items, id]);

  return (
    <main className="min-h-[calc(100vh-5rem)] px-5 pb-28 pt-10 sm:px-8 sm:pt-14 lg:pb-16">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="rule-label text-forest">For {model.firstName}</p>
          <h1 className="mt-4 font-editorial text-4xl font-semibold leading-[1.04] text-[var(--unlocked-text)] sm:text-6xl">
            A few things worth seeing right now.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink/52">
            Chosen from your recorded interests, eligibility facts, and what you are already working on.
          </p>
        </header>

        {model.profilePrompt ? (
          <section className="mt-9 flex flex-col gap-4 rounded-2xl border border-ink/10 bg-mint/45 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--unlocked-text)]">What are you curious about?</p>
              <p className="mt-1 text-sm text-ink/50">{model.profilePrompt} “Not sure yet” is a perfectly useful answer.</p>
            </div>
            <Link href="/profile#profile" className="inline-flex min-h-11 shrink-0 items-center font-bold text-forest">
              Add an interest →
            </Link>
          </section>
        ) : null}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,.75fr)] lg:items-start">
          <div>
            <div className="flex items-end justify-between gap-4 border-b border-ink/10 pb-4">
              <div>
                <p className="rule-label text-ink/40">Top picks</p>
                <h2 className="mt-2 font-editorial text-2xl font-semibold">Opportunity discovery</h2>
              </div>
              <Link href="/opportunities" className="hidden text-sm font-bold text-forest sm:block">Explore all →</Link>
            </div>
            <div className="mt-5 space-y-4">
              {topPicks.length ? (
                topPicks.map((item, index) => (
                  <OpportunityCard key={item.opportunity.id} item={item} featured={index === 0} onHide={() => hide(item.opportunity.id)} />
                ))
              ) : (
                <div className="rounded-[1.75rem] border border-ink/10 bg-[var(--unlocked-surface)] p-7">
                  <h3 className="font-editorial text-2xl font-semibold">Nothing strong enough to recommend yet.</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-ink/52">UnlockED will not fill this page with weak matches. Add an interest or browse the verified catalog while your profile takes shape.</p>
                  <Link href="/opportunities" className="mt-5 inline-flex min-h-11 items-center font-bold text-forest">Browse opportunities →</Link>
                </div>
              )}
              {model.pro && explorations.length ? (
                <div className="pt-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-ink/38">Also worth a look</p>
                  <div className="space-y-3">
                    {explorations.map((item) => (
                      <OpportunityCard key={item.opportunity.id} item={item} onHide={() => hide(item.opportunity.id)} />
                    ))}
                  </div>
                </div>
              ) : null}
              {!model.pro ? (
                <div className="rounded-2xl border border-ink/10 bg-ink/[.025] p-5">
                  <p className="text-sm font-bold">Your first recommendation is included.</p>
                  <p className="mt-1 text-sm leading-6 text-ink/48">Pro opens the full shortlist, watch signals, timing context, and cross-workspace suggestions.</p>
                  <Link href="/upgrade" className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-forest">See Pro →</Link>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28">
            <section className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5 sm:p-6">
              <div className="flex items-center gap-2 text-forest"><CalendarIcon className="h-4 w-4" /><p className="rule-label">Coming up</p></div>
              {model.comingUp.length ? (
                <ol className="mt-5 divide-y divide-ink/8">
                  {model.comingUp.map((item) => (
                    <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                      <Link href={item.href} className="group block">
                        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-forest/65">{formatDate(item.date)} · {item.kind}</p>
                        <p className="mt-1.5 text-sm font-bold leading-5 group-hover:text-forest">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-ink/45">{item.detail}</p>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm leading-6 text-ink/48">No verified or student-created dates are coming up yet.</p>
              )}
            </section>

            {model.nextAction ? (
              <section className="rounded-2xl bg-ink p-5 text-white sm:p-6">
                <div className="flex items-center gap-2 text-mint"><CheckCircleIcon className="h-4 w-4" /><p className="rule-label">Next in Journey</p></div>
                <h2 className="mt-4 font-editorial text-xl font-semibold leading-tight">{model.nextAction.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">{model.nextAction.detail}</p>
                <Link href={model.nextAction.href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-mint">Continue <ArrowIcon /></Link>
              </section>
            ) : null}

            {model.satAction ? (
              <section className="rounded-2xl border border-forest/15 bg-mint/30 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-forest"><SparkIcon className="h-4 w-4" /><p className="rule-label">SAT preparation</p></div>
                <h2 className="mt-4 font-editorial text-xl font-semibold leading-tight">{model.satAction.title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/52">{model.satAction.detail}</p>
                <Link href={model.satAction.href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest">Continue SAT <ArrowIcon /></Link>
              </section>
            ) : null}

            {model.collegeDiscovery ? (
              <section className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-forest"><SparkIcon className="h-4 w-4" /><p className="rule-label">College discovery</p></div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">{model.collegeDiscovery.label}</p>
                <h2 className="mt-2 font-editorial text-xl font-semibold">{model.collegeDiscovery.college.name}</h2>
                <p className="mt-2 text-xs font-semibold text-ink/45">{model.collegeDiscovery.college.city}, {model.collegeDiscovery.college.state}</p>
                <p className="mt-4 text-sm leading-6 text-ink/52">{model.collegeDiscovery.reason}</p>
                <Link href={`/colleges/${model.collegeDiscovery.college.slug}`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest">See why it is different <ArrowIcon /></Link>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
