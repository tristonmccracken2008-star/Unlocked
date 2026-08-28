import { opportunityChangeLabel, recentOpportunityChanges } from "@/data/opportunity-changelog";
import { getOpportunityIntelligence } from "@/data/opportunity-intelligence";
import type { Opportunity } from "@/data/opportunities";
import type { RecommendationViewModel } from "@/data/recommendation-service";
import type { StudentActivity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { ForYouBriefing, ForYouRadarEvent, ForYouRecommendationSnapshot } from "@/lib/advisor/types";
import { buildForYouDecisionInsights, forYouDecisionVersion } from "@/lib/for-you-decision-intelligence";
import type { AccountData } from "./account-types";
import { createOpportunityStrategyContext } from "./personal-opportunity-strategy";

const terminalStatuses = new Set(["Rejected", "Completed"]);

function opportunityId(view: RecommendationViewModel) {
  return view.recommendation.relatedOpportunityId ?? view.opportunity?.id ?? "";
}

function pluralCategory(label: string, count: number) {
  if (count === 1) return label.replace(/s$/i, "");
  return label;
}

function portfolioBrief(activity: StudentActivity, opportunityById: Map<string, Opportunity>) {
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
  const observation = "";
  return { total: tracked.length, active: active.length, categories, observation };
}

function whatThisAdds(view: RecommendationViewModel, portfolio: ReturnType<typeof portfolioBrief>) {
  const category = view.recommendation.portfolio?.canonicalCategory ?? view.opportunity?.category;
  if (!category) return undefined;
  const current = portfolio.categories.find((item) => item.label === category)?.count ?? 0;
  if (current === 0 && portfolio.active === 0) return undefined;
  if (current === 0) {
    const concentration = portfolio.categories[0];
    return concentration
      ? `You’ve mostly added ${pluralCategory(concentration.label.toLowerCase(), concentration.count)}. This is ${category.toLowerCase()}.`
      : undefined;
  }
  return undefined;
}

function radarEvents(
  recommendations: RecommendationViewModel[],
  topPickIds: Set<string>,
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
    if (seen.has(key) || topPickIds.has(event.opportunityId)) return;
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
  return events.sort((left, right) => (right.occurredAt ?? "").localeCompare(left.occurredAt ?? "") || left.label.localeCompare(right.label)).slice(0, 4);
}

function profileSignals(profile: StudentProfile) {
  return [profile.major, profile.year || profile.graduationYear, profile.careerGoal]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
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
  const recommendations = input.recommendations.filter((view) => Boolean(opportunityId(view)));
  const watchedIds = new Set(input.watchedOpportunityIds ?? []);
  const uncommitted = recommendations.filter((view) => !watchedIds.has(opportunityId(view)));
  const core = uncommitted.filter((view) => view.recommendation.portfolio?.role !== "exploration" && view.recommendation.tier !== "explore");
  const topPicks = (core.length ? core : uncommitted).slice(0, 3);
  const topPickIds = topPicks.map(opportunityId);
  const used = new Set(topPickIds);
  const dontMiss = uncommitted.filter((view) => !used.has(opportunityId(view)) && ["high", "medium"].includes(view.whyApplyNow?.urgency ?? "")).slice(0, 2);
  dontMiss.forEach((view) => used.add(opportunityId(view)));
  const exploration = uncommitted.filter((view) => !used.has(opportunityId(view)) && (view.recommendation.portfolio?.role === "exploration" || view.recommendation.tier === "explore")).slice(0, 2);
  exploration.forEach((view) => used.add(opportunityId(view)));
  const moreMatches = uncommitted.filter((view) => !used.has(opportunityId(view)));
  const portfolio = portfolioBrief(input.activity, input.opportunityById);
  const priorIds = new Set((input.priorSnapshot?.recommendations ?? []).map(opportunityId));
  const strategyContext = input.account ? createOpportunityStrategyContext({ account: input.account, opportunities: [...input.opportunityById.values()], now }) : undefined;
  const decisions = buildForYouDecisionInsights({ recommendations, activity: input.activity, opportunityById: input.opportunityById, watchedIds, priorRecommendationIds: priorIds, strategyContext, now });
  const insights = decisions.insights;
  for (const view of recommendations) {
    const id = opportunityId(view);
    if (insights[id] && !insights[id].whatItAdds) insights[id].whatItAdds = whatThisAdds(view, portfolio);
  }
  const radar = radarEvents(recommendations, new Set(topPickIds), watchedIds, input.opportunityById, input.priorSnapshot ?? null, now);
  const urgentCount = recommendations.filter((view) => view.whyApplyNow?.urgency === "high").length;
  const newCount = radar.filter((event) => event.type === "new_match" || event.type === "newly_added").length;
  const reopenedCount = radar.filter((event) => event.type === "applications_reopened").length;
  const otherUpdateCount = radar.length - newCount - reopenedCount;
  const title = "Top picks for you";
  const summaryParts = [
    newCount ? `${newCount} new match${newCount === 1 ? "" : "es"}` : "",
    reopenedCount ? `${reopenedCount} application${reopenedCount === 1 ? "" : "s"} reopened` : "",
    urgentCount ? `${urgentCount} deadline${urgentCount === 1 ? "" : "s"} soon` : "",
    otherUpdateCount ? `${otherUpdateCount} update${otherUpdateCount === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return {
    version: "for-you-briefing-v1",
    generatedAt: now.toISOString(),
    title,
    summary: summaryParts.join(" · "),
    topPickIds,
    dontMissIds: dontMiss.map(opportunityId),
    explorationIds: exploration.map(opportunityId),
    moreMatchIds: moreMatches.map(opportunityId),
    insights,
    radar,
    portfolio,
    profileSignals: profileSignals(input.profile),
    decisionVersion: forYouDecisionVersion,
    watchingIds: [...watchedIds],
    watchingItems: [...watchedIds].flatMap((id) => {
      const opportunity = input.opportunityById.get(id);
      return opportunity ? [{ opportunityId: id, title: opportunity.title, organization: opportunity.organization, href: `/opportunities/${id}` }] : [];
    }),
    comingUpIds: decisions.priorityViews.deadline.slice(0, 4),
    priorityViews: {
      curated: decisions.priorityViews.curated.filter((id) => !watchedIds.has(id)),
      deadline: decisions.priorityViews.deadline.filter((id) => !watchedIds.has(id)),
      effort: decisions.priorityViews.effort.filter((id) => !watchedIds.has(id)),
    },
  };
}
