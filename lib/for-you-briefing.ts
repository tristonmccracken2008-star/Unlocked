import { opportunityChangeLabel, opportunityChangeSummary, recentOpportunityChanges } from "@/data/opportunity-changelog";
import { getOpportunityIntelligence } from "@/data/opportunity-intelligence";
import type { Opportunity } from "@/data/opportunities";
import type { RecommendationViewModel } from "@/data/recommendation-service";
import type { StudentActivity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { ForYouBriefing, ForYouRadarEvent, ForYouRecommendationSnapshot } from "@/lib/advisor/types";

const terminalStatuses = new Set(["Rejected", "Completed"]);

function opportunityId(view: RecommendationViewModel) {
  return view.recommendation.relatedOpportunityId ?? view.opportunity?.id ?? "";
}

function pluralCategory(label: string, count: number) {
  if (count === 1) return label.replace(/s$/i, "");
  return label;
}

function sentenceList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
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
  const observation = !active.length
    ? "Your Journey is open. These picks can help you decide what is worth pursuing first."
    : categories.length === 1
      ? `Your active Journey is currently focused on ${pluralCategory(categories[0].label.toLowerCase(), categories[0].count)}.`
      : `Your active Journey currently spans ${sentenceList(categories.slice(0, 3).map((item) => item.label.toLowerCase()))}.`;
  return { total: tracked.length, active: active.length, categories, observation };
}

function whatThisAdds(view: RecommendationViewModel, portfolio: ReturnType<typeof portfolioBrief>) {
  const category = view.recommendation.portfolio?.canonicalCategory ?? view.opportunity?.category;
  if (!category) return undefined;
  const current = portfolio.categories.find((item) => item.label === category)?.count ?? 0;
  if (current === 0 && portfolio.active === 0) return `Introduces ${category.toLowerCase()} as a possible first direction in your Journey.`;
  if (current === 0) {
    const concentration = portfolio.categories[0];
    return concentration
      ? `Adds ${category.toLowerCase()} alongside your current ${concentration.label.toLowerCase()} opportunities.`
      : `Adds ${category.toLowerCase()} to your current opportunity mix.`;
  }
  return undefined;
}

function radarEvents(
  recommendations: RecommendationViewModel[],
  topPickIds: Set<string>,
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
  for (const view of recommendations) {
    const opportunity = view.opportunity;
    const id = opportunityId(view);
    if (!opportunity || !id) continue;
    const changes = recentOpportunityChanges(opportunity, 2);
    const reopened = changes.find((event) => event.changeType === "applications_reopened");
    const meaningful = changes.find((event) => event.importance !== "informational");
    if (reopened) add({ id: `radar:${reopened.id}`, type: "applications_reopened", label: "Applications reopened", detail: opportunityChangeSummary(reopened), opportunityId: id, href: view.href, occurredAt: reopened.detectedAt });
    else if (meaningful) add({ id: `radar:${meaningful.id}`, type: "meaningful_change", label: opportunityChangeLabel(meaningful), detail: opportunityChangeSummary(meaningful), opportunityId: id, href: view.href, occurredAt: meaningful.detectedAt });
    if (view.whyApplyNow?.urgency === "high") add({ id: `radar:deadline:${id}`, type: "deadline_soon", label: view.whyApplyNow.label, detail: view.whyApplyNow.detail, opportunityId: id, href: view.href, occurredAt: opportunity.application_deadline ?? undefined });
    if (priorSnapshot && !priorIds.has(id)) add({ id: `radar:new-match:${id}`, type: "new_match", label: "New strong match", detail: "This opportunity was not in your previous For You shortlist.", opportunityId: id, href: view.href, occurredAt: now.toISOString() });
    else if (view.freshnessLabel === "New this week" || view.freshnessLabel === "Recently added") add({ id: `radar:new-catalog:${id}`, type: "newly_added", label: "Newly added to UnlockED", detail: "This opportunity was added to the verified recommendation catalog recently.", opportunityId: id, href: view.href, occurredAt: opportunity.date_added });
    else if (view.freshnessLabel === "Recently verified") add({ id: `radar:verified:${id}`, type: "recently_verified", label: "Recently verified", detail: "UnlockED recently reviewed this opportunity against its official source.", opportunityId: id, href: view.href, occurredAt: opportunity.last_verified });
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
  opportunityById: Map<string, Opportunity>;
  priorSnapshot?: ForYouRecommendationSnapshot | null;
  now?: Date;
}): ForYouBriefing {
  const now = input.now ?? new Date();
  const recommendations = input.recommendations.filter((view) => Boolean(opportunityId(view)));
  const core = recommendations.filter((view) => view.recommendation.portfolio?.role !== "exploration" && view.recommendation.tier !== "explore");
  const topPicks = (core.length ? core : recommendations).slice(0, 3);
  const topPickIds = topPicks.map(opportunityId);
  const used = new Set(topPickIds);
  const dontMiss = recommendations.filter((view) => !used.has(opportunityId(view)) && ["high", "medium"].includes(view.whyApplyNow?.urgency ?? "")).slice(0, 2);
  dontMiss.forEach((view) => used.add(opportunityId(view)));
  const exploration = recommendations.filter((view) => !used.has(opportunityId(view)) && (view.recommendation.portfolio?.role === "exploration" || view.recommendation.tier === "explore")).slice(0, 2);
  exploration.forEach((view) => used.add(opportunityId(view)));
  const moreMatches = recommendations.filter((view) => !used.has(opportunityId(view)));
  const portfolio = portfolioBrief(input.activity, input.opportunityById);
  const insights = Object.fromEntries(recommendations.map((view) => {
    const id = opportunityId(view);
    const intelligence = view.opportunity ? getOpportunityIntelligence(view.opportunity) : null;
    return [id, {
      opportunityId: id,
      whyItFits: view.summaryReason ?? view.reasons[0] ?? "It passed UnlockED's eligibility, quality, and relevance checks.",
      whyNow: view.whyApplyNow ? `${view.whyApplyNow.label}. ${view.whyApplyNow.detail}` : undefined,
      whatItAdds: whatThisAdds(view, portfolio),
      estimatedApplicationTime: intelligence?.estimatedApplicationTime ?? "Unknown",
    }];
  }));
  const radar = radarEvents(recommendations, new Set(topPickIds), input.priorSnapshot ?? null, now);
  const urgentCount = recommendations.filter((view) => view.whyApplyNow?.urgency === "high").length;
  const title = recommendations.length === 1 ? "One opportunity deserves your attention." : `${recommendations.length} opportunities deserve your attention.`;
  const summaryParts = [
    `${topPickIds.length} top pick${topPickIds.length === 1 ? "" : "s"}`,
    radar.length ? `${radar.length} meaningful update${radar.length === 1 ? "" : "s"}` : "no new catalog changes",
    urgentCount ? `${urgentCount} approaching deadline${urgentCount === 1 ? "" : "s"}` : "",
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
  };
}
