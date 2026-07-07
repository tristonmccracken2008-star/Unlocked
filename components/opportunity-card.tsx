import Link from "next/link";
import { deadlineLabel, type Opportunity } from "@/data/opportunities";
import { ArrowIcon } from "./icons";

export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const secondary = opportunity.type === "Career" || opportunity.type === "Research" ? deadlineLabel(opportunity) : opportunity.type === "Scholarship" ? opportunity.metadata.awardAmountLabel ?? "Amount varies" : opportunity.type === "Benefit" ? opportunity.metadata.valueLabel ?? "Value unknown" : opportunity.metadata.studentOffer ?? "See official source";
  const secondaryLabel = opportunity.type === "Career" || opportunity.type === "Research" ? "Deadline" : opportunity.type === "Scholarship" ? "Award amount" : opportunity.type === "Benefit" ? "Estimated value" : "Student access";
  return <article className="grid gap-4 border-b border-ink/20 bg-white p-5 md:grid-cols-[1fr_210px_130px] md:items-center">
    <div><div className="flex flex-wrap items-center gap-3"><span className="rule-label text-forest">{opportunity.type}</span><span className="rule-label border-l border-ink/20 pl-3 text-ink/40">{opportunity.category}</span><span className={`rule-label border-l border-ink/20 pl-3 ${opportunity.verification_status === "verified_recently" ? "text-trust" : "text-amber-700"}`}>{opportunity.verification_status === "verified_recently" ? "Verified Recently" : "Needs Review"}</span></div><h3 className="mt-2 font-editorial text-xl font-bold">{opportunity.title}</h3><p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/35">{opportunity.organization}</p><p className="mt-3 text-sm leading-6 text-ink/55">{opportunity.description}</p></div>
    <div className="border-l border-ink/15 pl-4"><p className="rule-label text-ink/35">{secondaryLabel}</p><p className="mt-2 text-sm font-bold text-forest">{secondary}</p><p className="mt-3 text-xs text-ink/40">{opportunity.school_scope} · {opportunity.location}</p></div>
    <Link href={`/opportunities/${opportunity.id}`} className="inline-flex items-center justify-end gap-2 text-xs font-bold uppercase tracking-wider hover:text-forest">Details <ArrowIcon /></Link>
  </article>;
}
