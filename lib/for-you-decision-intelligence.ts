import { projectOpportunityTrust } from "@/data/opportunity-trust";
import type { Opportunity } from "@/data/opportunities";
import type { RecommendationViewModel } from "@/data/recommendation-service";
import type { StudentActivity } from "@/data/student-activity";
import type { ForYouComparisonProjection, ForYouDecisionFact, ForYouRecommendationInsight } from "@/lib/advisor/types";
import { projectOpportunityStrategyContribution, type OpportunityStrategyContext } from "./personal-opportunity-strategy";

export const forYouDecisionVersion = "for-you-decision-v1" as const;

function opportunityId(view: RecommendationViewModel) {
  return view.recommendation.relatedOpportunityId ?? view.opportunity?.id ?? "";
}

function valueLabel(view: RecommendationViewModel) {
  const opportunity = view.opportunity;
  if (!opportunity) return undefined;
  if (opportunity.metadata.awardAmountLabel) return opportunity.metadata.awardAmountLabel;
  if (opportunity.metadata.stipendAmount) return `$${opportunity.metadata.stipendAmount.toLocaleString("en-US")} stipend`;
  if (opportunity.paid === true) return opportunity.metadata.salaryEstimate || "Paid";
  if (opportunity.estimated_value && opportunity.estimated_value > 0) return view.recommendation.estimatedValueLabel;
  return undefined;
}

function effortFor(opportunity: Opportunity | null) {
  if (!opportunity?.metadata.verification?.applicationUrlVerified) return undefined;
  const requirements = opportunity.metadata.applicationRequirements?.map((item) => item.trim()).filter(Boolean) ?? [];
  if (!requirements.length) return undefined;
  const joined = requirements.join(" ").toLowerCase();
  const involved = requirements.length >= 4 || /(recommendation|nomination|essay|interview|team)/.test(joined);
  const label = involved ? "More involved" : requirements.length <= 2 ? "Light application" : "Moderate application";
  return { label, detail: requirements.join(" + "), rank: involved ? 3 : requirements.length <= 2 ? 1 : 2 };
}

function verifiedDeadline(opportunity: Opportunity | null, now: Date) {
  if (!opportunity?.application_deadline || opportunity.metadata.verification?.deadlineVerified !== true) return undefined;
  const deadline = new Date(`${opportunity.application_deadline}T23:59:59.999Z`);
  if (!Number.isFinite(deadline.getTime()) || deadline < now) return undefined;
  const days = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000));
  return { date: opportunity.application_deadline, days, label: days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days` };
}

function shortReason(view: RecommendationViewModel) {
  return view.summaryReason
    ?? view.reasons.find((reason) => /career goal|interest|major|first-year|freshman/i.test(reason))
    ?? view.reasons[0]
    ?? "It passed UnlockED's eligibility, source, and relevance checks.";
}

export function buildForYouDecisionInsights(input: {
  recommendations: RecommendationViewModel[];
  activity: StudentActivity;
  opportunityById: ReadonlyMap<string, Opportunity>;
  watchedIds: ReadonlySet<string>;
  priorRecommendationIds: ReadonlySet<string>;
  strategyContext?: OpportunityStrategyContext;
  now: Date;
}) {
  const insights: Record<string, ForYouRecommendationInsight> = {};
  const deadlineOrder: Array<{ id: string; time: number }> = [];
  const effortOrder: Array<{ id: string; rank: number }> = [];
  const curated: string[] = [];
  input.recommendations.forEach((view, index) => {
    const id = opportunityId(view);
    const opportunity = view.opportunity ?? null;
    if (!id || !opportunity) return;
    const deadline = verifiedDeadline(opportunity, input.now);
    const effort = effortFor(opportunity);
    const contribution = input.strategyContext ? projectOpportunityStrategyContribution(input.strategyContext, opportunity).line : undefined;
    const value = valueLabel(view);
    const facts: ForYouDecisionFact[] = [];
    if (deadline) facts.push({ kind: "deadline", label: deadline.label });
    else if (opportunity.metadata.deadlineType === "rolling") facts.push({ kind: "deadline", label: "Rolling applications" });
    if (value) facts.push({ kind: "value", label: value });
    if (opportunity.location && !/^varies|unknown$/i.test(opportunity.location)) facts.push({ kind: "location", label: opportunity.remote ? "Remote" : opportunity.location });
    if (effort) facts.push({ kind: "effort", label: effort.label, detail: effort.detail });
    if (contribution) facts.push({ kind: "journey", label: contribution });
    const priorityLabel = index === 0 ? "Best fit" : deadline && deadline.days <= 14 ? "Deadline soon" : contribution ? "Adds something new" : "Strong fit";
    const reason = shortReason(view);
    const factLine = facts.slice(0, 3).map((fact) => fact.label).join(" · ");
    const inJourney = Boolean(input.activity.tracked?.[id] || input.activity.saved.includes(id));
    insights[id] = {
      opportunityId: id,
      whyItFits: reason,
      whyNow: deadline?.label ?? (opportunity.metadata.deadlineType === "rolling" ? "Rolling applications" : undefined),
      whatItAdds: contribution,
      estimatedApplicationTime: opportunity.metadata.estimatedApplicationTime ?? "Unknown",
      priorityLabel,
      factLine,
      whyThisOne: contribution ?? reason,
      facts,
      comparison: {
        opportunityId: id,
        type: opportunity.type,
        organization: opportunity.organization,
        deadline: projectOpportunityTrust(opportunity).deadline.displayValue,
        eligibility: opportunity.eligibility || undefined,
        location: opportunity.remote ? "Remote" : opportunity.location || undefined,
        value,
        duration: opportunity.metadata.internshipDuration,
        effort: effort?.label,
        applicationRequirements: effort?.detail,
        matchReason: reason,
        journeyContribution: contribution,
      },
      state: {
        watched: input.watchedIds.has(id),
        inJourney,
        previouslySeen: input.activity.viewed.includes(id),
        newForYou: input.priorRecommendationIds.size > 0 && !input.priorRecommendationIds.has(id),
      },
    };
    curated.push(id);
    if (deadline) deadlineOrder.push({ id, time: Date.parse(`${deadline.date}T23:59:59.999Z`) });
    if (effort) effortOrder.push({ id, rank: effort.rank });
  });
  return {
    insights,
    priorityViews: {
      curated,
      deadline: deadlineOrder.sort((left, right) => left.time - right.time).map((item) => item.id),
      effort: effortOrder.sort((left, right) => left.rank - right.rank || curated.indexOf(left.id) - curated.indexOf(right.id)).map((item) => item.id),
    },
  };
}
