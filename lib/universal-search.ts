import "server-only";

import type { Opportunity } from "@/data/opportunities";
import type { UniversalSearchPayload, UniversalSearchResult } from "@/data/universal-search";
import { buildDiscoverCatalog } from "./discover-catalog";
import type { AccountData, AuthUser } from "./account-types";
import { buildJourneyCommandCenterModel, type JourneyCommandRecord } from "./journey-command-center";

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function matchScore(query: string, values: readonly string[]) {
  const normalized = normalize(query);
  if (!normalized) return 0;
  const tokens = normalized.split(" ");
  let best = 0;
  for (const value of values) {
    const candidate = normalize(value);
    if (!candidate) continue;
    if (candidate === normalized) best = Math.max(best, 1_000);
    else if (candidate.startsWith(normalized)) best = Math.max(best, 760);
    else if (candidate.includes(normalized)) best = Math.max(best, 620);
    else if (tokens.every((token) => candidate.split(" ").some((part) => part === token || part.startsWith(token)))) best = Math.max(best, 430);
  }
  return best;
}

function trackedIds(account: AccountData) {
  return [...new Set([
    ...Object.keys(account.tracker ?? {}),
    ...Object.keys(account.activity?.tracked ?? {}),
    ...(account.activity?.saved ?? []),
    ...(account.savedOpportunities ?? []).map((record) => record.opportunityId),
  ])];
}

function journeyHref(record: JourneyCommandRecord) {
  const query = new URLSearchParams({ q: record.title });
  return `/?${query.toString()}#journey-record-${encodeURIComponent(record.id)}`;
}

function journeyResults(records: readonly JourneyCommandRecord[], query: string): UniversalSearchResult[] {
  return records.flatMap((record) => {
    const score = matchScore(query, [record.title, record.organization, record.category, record.stageLabel, record.statusDetail]);
    if (!score) return [];
    const progress = record.applicationWorkspace?.totalCount
      ? ` · ${record.applicationWorkspace.completedCount}/${record.applicationWorkspace.totalCount} tasks complete`
      : "";
    return [{
      id: `journey:${record.id}`,
      kind: "journey" as const,
      group: "Your Journey" as const,
      title: record.title,
      subtitle: `${record.stageLabel}${progress}`,
      href: journeyHref(record),
      score: score + 260,
    }];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);
}

function deadlineIntent(query: string) {
  return /\b(calendar|deadline|deadlines|due|upcoming|this week)\b/i.test(query);
}

function applicationIntent(query: string) {
  return /\b(application|applications|task|tasks|resume|résumé|essay|transcript|recommendation)\b/i.test(query);
}

function supportedConceptQuery(query: string) {
  return /^(scholarships?|grants?|funding|internships?|research|ai tools?|software|engineering|finance|quant|freshman opportunities?|first year opportunities?|remote opportunities?|student benefits?)$/i.test(query.trim());
}

export function buildUniversalSearch(input: {
  user: Pick<AuthUser, "id" | "name">;
  account: AccountData;
  opportunities: readonly Opportunity[];
  query: string;
  now?: Date;
}): UniversalSearchPayload {
  const query = input.query.trim().slice(0, 120);
  if (!query) return { query: "", results: [], totalOpportunityMatches: 0 };
  const ids = new Set(trackedIds(input.account));
  const trackedOpportunities = input.opportunities.filter((item) => ids.has(item.id));
  const model = buildJourneyCommandCenterModel({
    user: input.user,
    account: input.account,
    opportunities: trackedOpportunities,
    now: input.now,
    activeLimit: 100,
    historyLimit: 100,
  });
  const records = [...model.activeRecords, ...model.historyGroups.flatMap((group) => group.records)];
  const personal = journeyResults(records, query);

  const upcoming = model.calendar.items.flatMap((item): UniversalSearchResult[] => {
    if (item.urgency === "overdue" || item.statusAwarePassed) return [];
    const score = deadlineIntent(query) ? 700 : matchScore(query, [item.title, item.opportunityTitle ?? "", item.organization ?? ""]);
    if (!score) return [];
    return [{
      id: `deadline:${item.id}`,
      kind: "deadline",
      group: "Upcoming",
      title: item.opportunityTitle ?? item.title,
      subtitle: `${item.timingLabel} · ${item.title}`,
      href: "/#journey-upcoming-heading",
      score: score + (item.urgency === "today" || item.urgency === "tomorrow" ? 90 : 0),
    }];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 3);

  const tasks = records.flatMap((record) => record.applicationWorkspace?.tasks.flatMap((task): UniversalSearchResult[] => {
    if (task.completed) return [];
    const directScore = matchScore(query, [task.title, record.title, record.organization]);
    const score = directScore || (applicationIntent(query) ? 220 : 0);
    if (!score) return [];
    return [{
      id: `task:${record.id}:${task.id}`,
      kind: "task",
      group: "Application tasks",
      title: task.title,
      subtitle: `${record.title}${task.dueDate ? ` · Due ${task.dueDate}` : ""}`,
      href: journeyHref(record),
      score,
    }];
  }) ?? []).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 3);

  const catalog = buildDiscoverCatalog(input.opportunities, {
    query,
    type: "All",
    category: "All",
    major: "All",
    school: "All",
    paid: "All",
    remote: "All",
    difficulty: "All",
    freshmanFriendly: false,
    deadline: "All",
    sort: "Relevant",
    limit: 6,
  });
  const preciseCatalog = catalog.opportunities.filter((item) => supportedConceptQuery(query) || matchScore(query, [
    item.title,
    item.organization,
    `${item.title} ${item.organization} ${item.category} ${item.tags.join(" ")} ${item.majors.join(" ")}`,
  ]) > 0);
  const opportunities = preciseCatalog.map((item, index): UniversalSearchResult => ({
    id: `opportunity:${item.id}`,
    kind: "opportunity",
    group: "Opportunities",
    title: item.title,
    subtitle: `${item.organization} · ${item.category}`,
    href: `/opportunities/${encodeURIComponent(item.id)}`,
    score: 520 - index,
  }));

  return {
    query,
    results: [...personal, ...upcoming, ...tasks, ...opportunities],
    totalOpportunityMatches: preciseCatalog.length ? catalog.total : 0,
  };
}
