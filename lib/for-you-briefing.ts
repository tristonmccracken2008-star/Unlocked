import { opportunityChangeLabel, recentOpportunityChanges } from "@/data/opportunity-changelog";
import { getOpportunityIntelligence } from "@/data/opportunity-intelligence";
import type { Opportunity } from "@/data/opportunities";
import type { RecommendationViewModel } from "@/data/recommendation-service";
import type { StudentActivity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { ForYouBriefing, ForYouRadarEvent, ForYouRecommendationSnapshot } from "@/lib/advisor/types";
import { buildForYouDecisionInsights, forYouDecisionVersion } from "@/lib/for-you-decision-intelligence";
import type { AccountData } from "./account-types";
import { createOpportunityStrategyContext, type OpportunityStrategyContext } from "./personal-opportunity-strategy";

const terminalStatuses = new Set(["Rejected", "Completed"]);
const maximumTopPicks = 3;
const maximumAdditionalMatches = 4;
const maximumExplorationMatches = 1;

function opportunityId(view: RecommendationViewModel) {
  return view.recommendation.relatedOpportunityId ?? view.opportunity?.id ?? "";
}

function portfolioBrief(activity: StudentActivity, opportunityById: ReadonlyMap<string, Opportunity>) {
  const tracked = Object.values(activity.tracked ?? {});
  const active = tracked.filter((record) => !terminalStatuses.has(record.status));
  const counts = new Map<string, number>();
  for (const record of active) {
    const opportunity = opportunityById.get(record.id);
    if (!opportunity) continue;
    const category = getOpportunityIntelligence(opportunity).category;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const categories = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label, count }));
  return { total: tracked.length, active: active.length, categories, observation: "" };
}

function boundedStrategyContext(input: {
  account?: AccountData;
  activity: StudentActivity;
  recommendations: RecommendationViewModel[];
  opportunityById: ReadonlyMap<string, Opportunity>;
  watchedIds: ReadonlySet<string>;
  now: Date;
}): OpportunityStrategyContext | undefined {
  if (!input.account) return undefined;
  const ids = new Set([
    ...input.recommendations.map(opportunityId),
    ...Object.keys(input.activity.tracked ?? {}),
    ...input.activity.saved,
    ...input.account.savedOpportunities.map((record) => record.opportunityId),
    ...input.watchedIds,
  ]);
  const candidates = [...ids].flatMap((id) => input.opportunityById.get(id) ?? []);
  try {
    return createOpportunityStrategyContext({ account: input.account, opportunities: candidates, now: input.now });
  } catch {
    return undefined;
  }
}

function radarEvents(
  recommendations: RecommendationViewModel[],
  visibleRecommendationIds: ReadonlySet<string>,
  watchedIds: ReadonlySet<string>,
  opportunityById: ReadonlyMap<string, Opportunity>,
  priorSnapshot: ForYouRecommendationSnapshot | null,
  now: Date,
) {
  const priorIds = new Set((priorSnapshot?.recommendations ?? []).map(opportunityId));
  const events: ForYouRadarEvent[] = [];
  const seen = new Set<string>();
  const add = (event: ForYouRadarEvent) => {
    const key = `${event.type}:${event.opportunityId}`;
    if (seen.has(key) || visibleRecommendationIds.has(event.opportunityId)) return;
    seen.add(key);
    events.push(event);
  };
  const recommendationById = new Map(recommendations.map((view) => [opportunityId(view), view]));
  const candidates = [...new Set([...recommendationById.keys(), ...watchedIds])];
  for (const id of candidates) {
    const view = recommendationById.get(id);
    const opportunity = view?.opportunity ?? opportunityById.get(id);
    if (!opportunity || !id) continue;
    const source = watchedIds.has(id) ? "watched" as const : "recommendation" as const;
    const href = view?.href ?? `/opportunities/${id}`;
    const changes = recentOpportunityChanges(opportunity, 2);
    const reopened = changes.find((event) => event.changeType === "applications_reopened");
    const meaningful = changes.find((event) => event.importance !== "informational");
    if (reopened) add({ id: `radar:${reopened.id}`, type: "applications_reopened", label: "Applications reopened", detail: opportunity.title, opportunityId: id, href, occurredAt: reopened.detectedAt, source });
    else if (meaningful) add({ id: `radar:${meaningful.id}`, type: "meaningful_change", label: opportunityChangeLabel(meaningful), detail: opportunity.title, opportunityId: id, href, occurredAt: meaningful.detectedAt, source });
    if (view?.whyApplyNow?.urgency === "high") add({ id: `radar:deadline:${id}`, type: "deadline_soon", label: view.whyApplyNow.label, detail: opportunity.title, opportunityId: id, href, occurredAt: opportunity.application_deadline ?? undefined, source });
    if (view && priorSnapshot && !priorIds.has(id)) add({ id: `radar:new-match:${id}`, type: "new_match", label: "New for you", detail: opportunity.title, opportunityId: id, href, occurredAt: now.toISOString(), source });
    else if (view && (view.freshnessLabel === "New this week" || view.freshnessLabel === "Recently added")) add({ id: `radar:new-catalog:${id}`, type: "newly_added", label: "New to UnlockED", detail: opportunity.title, opportunityId: id, href, occurredAt: opportunity.date_added, source });
    else if (view?.freshnessLabel === "Recently verified") add({ id: `radar:verified:${id}`, type: "recently_verified", label: "Recently verified", detail: opportunity.title, opportunityId: id, href, occurredAt: opportunity.last_verified, source });
  }
  return events
    .sort((left, right) => (right.occurredAt ?? "").localeCompare(left.occurredAt ?? "") || left.label.localeCompare(right.label))
    .slice(0, 2);
}

function profileSignals(profile: StudentProfile) {
  return [profile.major, profile.year || profile.graduationYear, profile.careerGoal]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
}

function presentationOrder(ids: string[], insights: ReturnType<typeof buildForYouDecisionInsights>["insights"]) {
  const fresh = ids.filter((id) => !["previously_seen", "watching", "in_journey"].includes(insights[id]?.freshness ?? "current"));
  const seen = ids.filter((id) => !fresh.includes(id));
  return [...fresh, ...seen];
}

export function buildForYouBriefing(input: {
  recommendations: RecommendationViewModel[];
  totalMatches: number;
  profile: StudentProfile;
  activity: StudentActivity;
  account?: AccountData;
  opportunityById: Map<string, Opportunity>;
  priorSnapshot?: ForYouRecommendationSnapshot | null;
  watchedOpportunityIds?: string[];
  now?: Date;
}): ForYouBriefing {
  const now = input.now ?? new Date();
  const recommendations = input.recommendations.filter((view) => Boolean(opportunityId(view)) && Boolean(view.opportunity));
  const watchedIds = new Set(input.watchedOpportunityIds ?? []);
  const priorIds = new Set((input.priorSnapshot?.recommendations ?? []).map(opportunityId));
  const strategyContext = boundedStrategyContext({
    account: input.account,
    activity: input.activity,
    recommendations,
    opportunityById: input.opportunityById,
    watchedIds,
    now,
  });
  const decisions = buildForYouDecisionInsights({
    recommendations,
    activity: input.activity,
    opportunityById: input.opportunityById,
    watchedIds,
    priorRecommendationIds: priorIds,
    hasPriorSnapshot: Boolean(input.priorSnapshot),
    strategyContext,
    now,
  });
  const available = recommendations.filter((view) => {
    const insight = decisions.insights[opportunityId(view)];
    return insight && !insight.state.watched && !insight.state.inJourney;
  });
  const coreIds = available
    .filter((view) => view.recommendation.portfolio?.role !== "exploration" && view.recommendation.tier !== "explore")
    .map(opportunityId);
  const orderedCoreIds = presentationOrder(coreIds, decisions.insights);
  const topPickIds = (orderedCoreIds.length ? orderedCoreIds : presentationOrder(available.map(opportunityId), decisions.insights)).slice(0, maximumTopPicks);
  const used = new Set(topPickIds);
  const explorationIds = presentationOrder(available
    .filter((view) => !used.has(opportunityId(view)) && (view.recommendation.portfolio?.role === "exploration" || view.recommendation.tier === "explore"))
    .map(opportunityId), decisions.insights).slice(0, maximumExplorationMatches);
  explorationIds.forEach((id) => used.add(id));
  const additionalMatchIds = presentationOrder(available.filter((view) => !used.has(opportunityId(view))).map(opportunityId), decisions.insights)
    .slice(0, maximumAdditionalMatches);
  const visibleIds = new Set([...topPickIds, ...explorationIds, ...additionalMatchIds]);
  const radar = radarEvents(recommendations, visibleIds, watchedIds, input.opportunityById, input.priorSnapshot ?? null, now);
  const primaryIds = [...topPickIds, ...explorationIds, ...additionalMatchIds];
  const newCount = primaryIds.filter((id) => ["new_for_you", "new_to_unlocked"].includes(decisions.insights[id]?.freshness ?? "")).length;
  const summary = newCount > 0
    ? `${newCount} new ${newCount === 1 ? "match" : "matches"}`
    : `${primaryIds.length} current ${primaryIds.length === 1 ? "match" : "matches"}`;

  return {
    version: "for-you-briefing-v2",
    generatedAt: now.toISOString(),
    title: "For You",
    summary,
    topPickIds,
    additionalMatchIds,
    explorationIds,
    insights: decisions.insights,
    radar,
    portfolio: portfolioBrief(input.activity, input.opportunityById),
    profileSignals: profileSignals(input.profile),
    decisionVersion: forYouDecisionVersion,
    watchingIds: [...watchedIds],
    watchingItems: [...watchedIds].flatMap((id) => {
      const opportunity = input.opportunityById.get(id);
      return opportunity ? [{ opportunityId: id, title: opportunity.title, organization: opportunity.organization, href: `/opportunities/${id}` }] : [];
    }),
    comingUpIds: decisions.priorityViews.deadline.filter((id) => visibleIds.has(id)).slice(0, 3),
    priorityViews: {
      curated: decisions.priorityViews.curated.filter((id) => visibleIds.has(id)),
      deadline: decisions.priorityViews.deadline.filter((id) => visibleIds.has(id)),
      requirements: decisions.priorityViews.requirements.filter((id) => visibleIds.has(id)),
    },
  };
}
