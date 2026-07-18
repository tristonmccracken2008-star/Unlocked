import Link from "next/link";
import type { Opportunity } from "@/data/opportunities";
import { listingDeadlineLabel as deadlineLabel } from "@/data/opportunity-listing";
import { ArrowIcon } from "./icons";
import { AddToJourneyButton } from "./opportunity-activity";
import { OrganizationLogo } from "./organization-logo";
import { StatusBadge } from "./status-badge";

function schoolRestrictionLabel(opportunity: Opportunity) {
  if (opportunity.school_scope === "National") return "Open broadly";
  const school = opportunity.schools[0];
  if (!school) return "School eligibility unclear";
  return `${school.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")} enrollment required`;
}

export function OpportunityCard({ opportunity, reasons }: { opportunity: Opportunity; reasons?: string[] }) {
  const secondary = opportunity.type === "Career" || opportunity.type === "Research" ? deadlineLabel(opportunity) : opportunity.type === "Scholarship" ? opportunity.metadata.awardAmountLabel ?? "Amount varies" : opportunity.type === "Benefit" ? opportunity.metadata.valueLabel ?? "See official source" : opportunity.metadata.studentOffer ?? "See official source";
  const secondaryLabel = opportunity.type === "Career" || opportunity.type === "Research" ? "Deadline" : opportunity.type === "Scholarship" ? "Award amount" : opportunity.type === "Benefit" ? "Estimated value" : "Student access";
  return <article className="flex h-full flex-col rounded-[1.5rem] bg-white/92 p-5 shadow-[0_16px_42px_rgba(43,33,26,.055)] ring-1 ring-ink/7 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_22px_55px_rgba(43,33,26,.095)] motion-reduce:hover:translate-y-0">
    <div className="flex flex-wrap items-center gap-2"><span className="rule-label text-forest">{opportunity.type}</span><StatusBadge status={opportunity.verification_status}/></div>
    <div className="mt-5 flex items-start gap-4"><OrganizationLogo opportunity={opportunity} size="md"/><div className="min-w-0 flex-1"><h3 className="font-editorial text-2xl font-bold leading-[1.08] tracking-[-.025em]"><Link href={`/opportunities/${opportunity.id}`} className="rounded-sm hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest/30">{opportunity.title}</Link></h3><p className="mt-2 text-xs font-bold uppercase tracking-[.08em] text-ink/35">{opportunity.organization}</p></div></div>
    <div className="mt-4 min-w-0 flex-1"><p className="line-clamp-3 text-sm leading-6 text-ink/58">{opportunity.description}</p>{reasons?.length ? <details className="mt-4 rounded-2xl bg-paper/70 px-4 py-3"><summary className="cursor-pointer text-xs font-bold text-ink/58">Why this matches</summary><ul className="mt-2 space-y-1 text-xs leading-5 text-ink/55">{reasons.map((reason)=><li key={reason}>{reason}</li>)}</ul></details> : null}</div>
    <div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div><p className="font-bold text-ink/35">{secondaryLabel}</p><p className="mt-1 font-black text-forest">{secondary}</p></div><div className="text-right"><p className="font-bold text-ink/35">Eligibility</p><p className="mt-1 font-black text-ink/65">{schoolRestrictionLabel(opportunity)}</p></div></div>
    <div className="mt-5 grid gap-3"><Link href={`/opportunities/${opportunity.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white shadow-[0_12px_26px_rgba(31,95,67,.14)] hover:bg-ink">Open Opportunity <ArrowIcon /></Link><AddToJourneyButton opportunityId={opportunity.id} className="rounded-xl border border-forest/30 bg-white px-4 text-forest hover:border-forest"/></div>
  </article>;
}
