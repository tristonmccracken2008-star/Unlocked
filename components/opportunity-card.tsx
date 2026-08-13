import Link from "next/link";
import type { Opportunity } from "@/data/opportunities";
import { listingDeadlineLabel as deadlineLabel, type OpportunityListing } from "@/data/opportunity-listing";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import { projectOpportunityTrust } from "@/data/opportunity-trust";
import { ArrowIcon } from "./icons";
import { AddToJourneyButton } from "./opportunity-activity";
import { DiscoverOpportunityLink } from "./discover-opportunity-link";
import { OrganizationLogo } from "./organization-logo";
import { LifecycleBadge } from "./status-badge";

function eligibilityLabel(opportunity: Opportunity) {
  if (projectOpportunityTrust(opportunity).eligibility.state !== "verified") return "Not fully confirmed";
  if (opportunity.school_scope === "National") {
    const years = opportunity.academic_years.filter((year) => year !== "Any Year");
    return years.length ? years.slice(0, 2).join(", ") : "Open broadly";
  }
  const school = opportunity.schools[0];
  if (!school) return "School eligibility unclear";
  return `${school.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")} enrollment required`;
}

export function OpportunityCard({ opportunity, reasons, source }: { opportunity: OpportunityListing; reasons?: string[]; source?: "discover" | "for_you" }) {
  return <OpportunityCardContent opportunity={opportunity} reasons={reasons} source={source} />;
}

export function OpportunityCardContent({ opportunity, reasons, source }: { opportunity: OpportunityListing; reasons?: string[]; source?: "discover" | "for_you" }) {
  const resolved = opportunity.lifecyclePresentation ?? resolveOpportunityLifecycle(opportunity);
  const trust = projectOpportunityTrust(opportunity);
  const publishedDeadline = trust.deadline.state === "verified" ? deadlineLabel(opportunity) : trust.deadline.displayValue;
  const deadline = resolved.state === "rolling"
    ? "Rolling"
    : ["closed", "temporarily_closed", "canceled"].includes(resolved.state)
      ? resolved.label
      : publishedDeadline;
  const value = opportunity.type === "Scholarship"
    ? opportunity.metadata.awardAmountLabel ?? opportunity.estimated_value_note
    : opportunity.type === "Benefit"
      ? opportunity.metadata.valueLabel ?? "See official source"
      : opportunity.metadata.compensation ?? opportunity.metadata.studentOffer ?? "See official source";
  const format = opportunity.remote === true ? "Remote" : opportunity.remote === false ? opportunity.location || "In person" : opportunity.location || "Format varies";
  const cardType = opportunity.type === "Career" || opportunity.type === "Benefit" ? opportunity.category : opportunity.type;
  const detailHref = `/opportunities/${opportunity.id}`;
  const titleClass = "rounded-sm hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest/30";
  return <article data-ui-card="" data-discover-opportunity={source === "discover" ? opportunity.id : undefined} style={{ color: "var(--unlocked-text)", background: "var(--unlocked-surface)", borderColor: "var(--unlocked-border)" }} className="group flex h-full flex-col rounded-[1.25rem] border p-5 shadow-[0_14px_40px_rgba(43,33,26,.05)] transition duration-200 hover:border-forest/25 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(43,33,26,.085)] focus-within:border-forest/35 focus-within:shadow-[0_20px_48px_rgba(43,33,26,.085)] motion-reduce:hover:translate-y-0">
    <div className="flex flex-wrap items-center gap-2"><span className="rule-label text-forest">{cardType}</span><LifecycleBadge state={resolved.displayState} confidence={resolved.confidence} label={resolved.label}/></div>
    <div className="mt-5 flex items-start gap-4"><OrganizationLogo opportunity={opportunity} size="md"/><div className="min-w-0 flex-1"><h3 className="font-editorial text-2xl font-bold leading-[1.08]">{source === "discover" ? <DiscoverOpportunityLink href={detailHref} opportunityId={opportunity.id} category={opportunity.category} className={titleClass}>{opportunity.title}</DiscoverOpportunityLink> : <Link href={detailHref} className={titleClass}>{opportunity.title}</Link>}</h3><p className="mt-2 text-xs font-bold uppercase tracking-[.08em] text-ink/35">{opportunity.organization}</p></div></div>
    <div className="mt-4 min-w-0 flex-1"><p style={{ color: "var(--unlocked-muted)" }} className="line-clamp-2 text-sm leading-6">{opportunity.description}</p>{reasons?.length ? <details className="mt-4 rounded-xl bg-paper/70 px-4 py-3"><summary className="cursor-pointer text-xs font-bold text-ink/60">Why this matches</summary><ul className="mt-2 space-y-1 text-xs leading-5 text-ink/55">{reasons.map((reason)=><li key={reason}>{reason}</li>)}</ul></details> : null}</div>
    <dl className="mt-5 grid gap-x-4 gap-y-3 border-t border-ink/10 pt-4 text-xs sm:grid-cols-2">
      <CardFact label="Deadline" value={deadline} emphasis />
      <CardFact label="Value" value={value} />
      <CardFact label="Eligibility" value={eligibilityLabel(opportunity)} />
      <CardFact label="Format" value={format} />
    </dl>
    <div className="mt-5 grid gap-3">{source === "discover" ? <DiscoverOpportunityLink href={detailHref} opportunityId={opportunity.id} category={opportunity.category} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(31,95,67,.13)] hover:bg-ink">Open Opportunity <ArrowIcon /></DiscoverOpportunityLink> : <Link href={detailHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(31,95,67,.13)] hover:bg-ink">Open Opportunity <ArrowIcon /></Link>}<AddToJourneyButton opportunityId={opportunity.id} className="rounded-xl border border-forest/30 bg-white px-4 text-forest hover:border-forest"/></div>
  </article>;
}

function CardFact({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="min-w-0"><dt className="font-bold text-ink/35">{label}</dt><dd className={`mt-1 line-clamp-2 font-bold leading-5 ${emphasis ? "text-forest" : "text-ink/65"}`}>{value}</dd></div>;
}
