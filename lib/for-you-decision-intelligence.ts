import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import { projectOpportunityTrust } from "@/data/opportunity-trust";
import type { Opportunity } from "@/data/opportunities";
import type { RecommendationReasonDetail, RecommendationViewModel } from "@/data/recommendation-service";
import type { StudentActivity } from "@/data/student-activity";
import type {
  ForYouComparisonProjection,
  ForYouDecisionFact,
  ForYouExplanationLine,
  ForYouMeaningfulDate,
  ForYouRecommendationInsight,
} from "@/lib/advisor/types";
import { projectOpportunityStrategyContribution, type OpportunityStrategyContext } from "./personal-opportunity-strategy";

export const forYouDecisionVersion = "for-you-decision-v2" as const;

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

function applicationRequirements(opportunity: Opportunity | null) {
  if (!opportunity?.metadata.verification?.applicationUrlVerified) return undefined;
  const items = opportunity.metadata.applicationRequirements?.map((item) => item.trim()).filter(Boolean) ?? [];
  if (!items.length) return undefined;
  return {
    count: items.length,
    label: `${items.length} known application ${items.length === 1 ? "component" : "components"}`,
    detail: items.join(" + "),
  };
}

function verifiedDeadline(opportunity: Opportunity | null, now: Date) {
  if (!opportunity?.application_deadline || opportunity.metadata.verification?.deadlineVerified !== true) return undefined;
  const deadline = new Date(`${opportunity.application_deadline}T23:59:59.999Z`);
  if (!Number.isFinite(deadline.getTime()) || deadline < now) return undefined;
  const days = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000));
  return { date: opportunity.application_deadline, days, label: days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days` };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`));
}

function meaningfulDate(opportunity: Opportunity, now: Date): ForYouMeaningfulDate | undefined {
  const lifecycle = resolveOpportunityLifecycle(opportunity, now);
  const opening = lifecycle.openingDate?.normalizedValue?.slice(0, 10);
  if (lifecycle.state === "upcoming" && opening && !lifecycle.openingDate?.estimated) {
    return { kind: "opens", label: `Opens ${formatDate(opening)}` };
  }
  const deadline = verifiedDeadline(opportunity, now);
  if (deadline) return { kind: "deadline", label: `Deadline ${formatDate(deadline.date)}` };
  if (lifecycle.state === "rolling" && lifecycle.confidence !== "unknown") return { kind: "rolling", label: "Rolling applications" };
  return undefined;
}

function concise(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function firstReason(reasons: RecommendationReasonDetail[], kinds: RecommendationReasonDetail["kind"][]) {
  return reasons.find((reason) => kinds.includes(reason.kind));
}

function explanationLines(input: {
  view: RecommendationViewModel;
  contribution?: string;
  exploration: boolean;
}) {
  const reasons = input.view.whyThisOpportunity ?? [];
  const eligibility = firstReason(reasons, ["eligibility"]);
  const goal = firstReason(reasons, ["career", "interest", "major"]);
  const behavior = firstReason(reasons, ["behavior"]);
  const primary: ForYouExplanationLine | undefined = eligibility
    ? { kind: "eligibility", label: eligibility.label, text: concise(eligibility.detail) }
    : goal
      ? { kind: "goal", label: goal.label, text: concise(goal.detail) }
      : behavior
        ? { kind: "behavior", label: behavior.label, text: concise(behavior.detail) }
        : undefined;
  const contextual: ForYouExplanationLine | undefined = input.contribution
    ? { kind: "strategy", label: "Your current pursuits", text: concise(input.contribution) }
    : input.exploration && goal
      ? { kind: "exploration", label: "Worth exploring", text: concise(goal.detail) }
      : undefined;
  const fallback = input.view.summaryReason ?? input.view.reasons[0];
  return [primary, contextual]
    .filter((line): line is ForYouExplanationLine => Boolean(line))
    .filter((line, index, lines) => lines.findIndex((candidate) => candidate.text === line.text) === index)
    .concat(!primary && !contextual && fallback ? [{ kind: "goal" as const, label: "Why it appeared", text: concise(fallback) }] : [])
    .slice(0, 2);
}

function freshnessFor(input: {
  watched: boolean;
  inJourney: boolean;
  hasPriorSnapshot: boolean;
  priorRecommendationIds: ReadonlySet<string>;
  id: string;
  view: RecommendationViewModel;
  activity: StudentActivity;
}): ForYouRecommendationInsight["freshness"] {
  if (input.watched) return "watching";
  if (input.inJourney) return "in_journey";
  if (input.hasPriorSnapshot && !input.priorRecommendationIds.has(input.id)) return "new_for_you";
  if (input.view.freshnessLabel === "New this week" || input.view.freshnessLabel === "Recently added") return "new_to_unlocked";
  if (input.activity.viewed.includes(input.id) || /viewed|previously recommended/i.test(input.view.historyLabel ?? "")) return "previously_seen";
  return "current";
}

export function buildForYouDecisionInsights(input: {
  recommendations: RecommendationViewModel[];
  activity: StudentActivity;
  opportunityById: ReadonlyMap<string, Opportunity>;
  watchedIds: ReadonlySet<string>;
  priorRecommendationIds: ReadonlySet<string>;
  hasPriorSnapshot?: boolean;
  strategyContext?: OpportunityStrategyContext;
  now: Date;
}) {
  const insights: Record<string, ForYouRecommendationInsight> = {};
  const deadlineOrder: Array<{ id: string; time: number }> = [];
  const requirementOrder: Array<{ id: string; count: number; order: number }> = [];
  const curated: string[] = [];

  input.recommendations.forEach((view, index) => {
    const id = opportunityId(view);
    const opportunity = view.opportunity ?? null;
    if (!id || !opportunity) return;
    const deadline = verifiedDeadline(opportunity, input.now);
    const requirements = applicationRequirements(opportunity);
    let contribution: string | undefined;
    if (input.strategyContext) {
      try {
        contribution = projectOpportunityStrategyContribution(input.strategyContext, opportunity).line;
      } catch {
        contribution = undefined;
      }
    }
    const date = meaningfulDate(opportunity, input.now);
    const value = valueLabel(view);
    const facts: ForYouDecisionFact[] = [];
    if (date) facts.push({ kind: "deadline", label: date.label });
    if (value) facts.push({ kind: "value", label: value });
    if (opportunity.location && !/^varies|unknown$/i.test(opportunity.location)) facts.push({ kind: "location", label: opportunity.remote ? "Remote" : opportunity.location });
    if (requirements) facts.push({ kind: "requirements", label: requirements.label, detail: requirements.detail });
    if (contribution) facts.push({ kind: "journey", label: contribution });

    const inJourney = Boolean(input.activity.tracked?.[id] || input.activity.saved.includes(id));
    const watched = input.watchedIds.has(id);
    const exploration = view.recommendation.portfolio?.role === "exploration" || view.recommendation.tier === "explore";
    const explanations = explanationLines({ view, contribution, exploration });
    const reason = explanations[0]?.text ?? "It passed UnlockED's eligibility, source, and relevance checks.";
    const freshness = freshnessFor({ watched, inJourney, hasPriorSnapshot: Boolean(input.hasPriorSnapshot), priorRecommendationIds: input.priorRecommendationIds, id, view, activity: input.activity });
    const priorityLabel = index === 0 ? "Best fit" : deadline && deadline.days <= 14 ? "Deadline soon" : contribution ? "Adds something new" : "Strong fit";

    insights[id] = {
      opportunityId: id,
      explanations,
      meaningfulDate: date,
      freshness,
      whyItFits: reason,
      whyNow: date?.label,
      whatItAdds: contribution,
      estimatedApplicationTime: opportunity.metadata.estimatedApplicationTime ?? "Unknown",
      priorityLabel,
      factLine: facts.slice(0, 2).map((fact) => fact.label).join(" · "),
      whyThisOne: explanations.map((line) => line.text).join(" "),
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
        effort: requirements?.label,
        applicationRequirements: requirements?.detail,
        matchReason: reason,
        journeyContribution: contribution,
      },
      state: {
        watched,
        inJourney,
        previouslySeen: freshness === "previously_seen",
        newForYou: freshness === "new_for_you",
      },
    };
    curated.push(id);
    if (deadline) deadlineOrder.push({ id, time: Date.parse(`${deadline.date}T23:59:59.999Z`) });
    if (requirements) requirementOrder.push({ id, count: requirements.count, order: index });
  });

  return {
    insights,
    priorityViews: {
      curated,
      deadline: deadlineOrder.sort((left, right) => left.time - right.time).map((item) => item.id),
      requirements: requirementOrder.sort((left, right) => left.count - right.count || left.order - right.order).map((item) => item.id),
    },
  };
}
