"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Opportunity } from "@/data/opportunities";
import type { StudentProfile } from "@/data/student-profile";
import { evaluateHighSchoolEligibility } from "@/lib/high-school-opportunities";
import { SearchIcon } from "./icons";

function deadlineLabel(item: Opportunity) {
  if (item.application_deadline)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${item.application_deadline}T12:00:00Z`));
  if (item.metadata.deadlineType === "rolling") return "Rolling";
  if (item.metadata.deadlineType === "current_cycle_closed") return "Cycle closed";
  return "Date not announced";
}

export function HighSchoolOpportunityDiscovery({
  opportunities,
  profile,
}: {
  opportunities: Opportunity[];
  profile: StudentProfile | null;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All types");
  const [format, setFormat] = useState("All formats");
  const types = useMemo(() => ["All types", ...new Set(opportunities.map((item) => item.metadata.highSchool!.opportunityType))], [opportunities]);
  const formats = useMemo(() => ["All formats", ...new Set(opportunities.map((item) => item.metadata.highSchool!.format))], [opportunities]);
  const shown = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return opportunities.filter((item) => {
      const highSchool = item.metadata.highSchool!;
      if (type !== "All types" && highSchool.opportunityType !== type) return false;
      if (format !== "All formats" && highSchool.format !== format) return false;
      const haystack = `${item.title} ${item.organization} ${item.description} ${item.tags.join(" ")} ${item.eligibility} ${highSchool.activities.join(" ")}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [format, opportunities, query, type]);

  return (
    <main className="min-h-screen px-5 pb-28 pt-10 sm:px-8 sm:pb-16 sm:pt-14">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="rule-label text-forest">Opportunities</p>
          <h1 className="mt-3 font-editorial text-5xl font-semibold leading-[1.02] sm:text-6xl">Find something worth doing.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink/55">Verified programs, competitions, scholarships, research, and real experiences for high school students.</p>
        </header>
        <div className="mt-9 rounded-[1.75rem] border border-ink/10 bg-[var(--unlocked-surface)] p-3 shadow-soft sm:p-4">
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/55 px-4 ring-1 ring-ink/8 focus-within:ring-forest/35">
            <SearchIcon className="h-5 w-5 shrink-0 text-ink/35" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-base outline-none placeholder:text-ink/35" placeholder="Try “summer coding,” “art portfolio,” or “Texas aerospace”…" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {types.map((item) => <button key={item} type="button" onClick={() => setType(item)} aria-pressed={type === item} className={`min-h-10 rounded-full px-4 text-xs font-bold capitalize transition ${type === item ? "bg-forest text-white" : "bg-ink/[.045] text-ink/55 hover:bg-ink/[.08]"}`}>{item}</button>)}
            <span className="mx-1 hidden h-10 w-px bg-ink/10 sm:block" />
            {formats.map((item) => <button key={item} type="button" onClick={() => setFormat(item)} aria-pressed={format === item} className={`min-h-10 rounded-full px-4 text-xs font-bold transition ${format === item ? "bg-ink text-white" : "bg-ink/[.045] text-ink/55 hover:bg-ink/[.08]"}`}>{item}</button>)}
          </div>
        </div>
        <div className="mt-8 flex items-end justify-between gap-4">
          <div><p className="rule-label text-ink/38">Verified catalog</p><h2 className="mt-2 font-editorial text-3xl font-semibold">{shown.length} {shown.length === 1 ? "opportunity" : "opportunities"}</h2></div>
          <p className="hidden max-w-xs text-right text-xs leading-5 text-ink/42 sm:block">Eligibility labels use only facts in your profile and official program rules.</p>
        </div>
        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {shown.map((item) => {
            const detail = item.metadata.highSchool!;
            const eligibility = evaluateHighSchoolEligibility(item, profile);
            return (
              <Link key={item.id} href={`/opportunities/${item.id}`} className="group flex min-h-[19rem] flex-col rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-[0_18px_45px_rgba(43,33,26,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 sm:p-7">
                <div className="flex items-start justify-between gap-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest">{detail.opportunityType} · {detail.format}</p><span className="rounded-full bg-ink/[.045] px-3 py-1 text-[11px] font-bold text-ink/52">{deadlineLabel(item)}</span></div>
                <h3 className="mt-5 font-editorial text-2xl font-semibold leading-tight group-hover:text-forest">{item.title}</h3>
                <p className="mt-2 text-xs font-semibold text-ink/42">{item.organization}</p>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-ink/58">{item.description}</p>
                <div className="mt-auto grid gap-3 border-t border-ink/8 pt-5 sm:grid-cols-2">
                  <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/35">Cost / value</p><p className="mt-1 text-xs font-semibold leading-5">{detail.cost.label}{item.metadata.awardAmountLabel ? ` · ${item.metadata.awardAmountLabel}` : ""}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/35">Your eligibility</p><p className={`mt-1 text-xs font-semibold leading-5 ${eligibility.state === "not_eligible" ? "text-red-700" : "text-forest"}`}>{eligibility.label}</p></div>
                </div>
              </Link>
            );
          })}
        </section>
        {!shown.length ? <div className="mt-5 rounded-2xl border border-dashed border-ink/15 p-10 text-center"><h2 className="font-editorial text-2xl font-semibold">No verified matches yet.</h2><p className="mt-2 text-sm text-ink/50">Try a broader interest or clear one of the filters.</p></div> : null}
      </div>
    </main>
  );
}
