import "server-only";

import type { Opportunity } from "@/data/opportunities";
import type { UniversalSearchPayload, UniversalSearchResult } from "@/data/universal-search";
import { buildDiscoverCatalog } from "./discover-catalog";
import type { AccountData, AuthUser } from "./account-types";
import { buildJourneyCommandCenterModel, type JourneyCommandRecord } from "./journey-command-center";
import { buildAccomplishmentsModel } from "./accomplishments";
import { opportunityPaths } from "@/data/opportunity-paths";
import { explorerAreas, explorerExperienceTypes } from "@/data/opportunity-explorer";
import { opportunityCollections } from "@/data/opportunity-collections";
import { applicationMaterialStatusLabels, applicationMaterialTypeLabels, normalizeApplicationMaterialStore } from "@/data/application-materials";
import { opportunityCollectionCoverage } from "./opportunity-collections";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import { normalizeAnswerBank } from "./application-workspace";

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

function recordHref(record: JourneyCommandRecord) {
  return record.applicationWorkspace ? `/applications/${encodeURIComponent(record.id)}` : journeyHref(record);
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
      href: recordHref(record),
      score: score + 260,
    }];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);
}

function deadlineIntent(query: string) {
  return /\b(calendar|deadline|deadlines|due|upcoming|this week|schedule|busy week|busy weeks|conflict|conflicts)\b/i.test(query);
}

function conflictIntent(query: string) {
  return /\b(deadline conflict|deadline conflicts|busy week|busy weeks|conflict planning|my schedule)\b/i.test(query);
}

function applicationIntent(query: string) {
  return /\b(application|applications|task|tasks|resume|résumé|essay|transcript|recommendation)\b/i.test(query);
}

function strategyIntent(query: string) {
  return /^(strategy|my strategy|current mix|my current opportunities|what am i pursuing|opportunity mix)$/i.test(query.trim());
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
  const strategy: UniversalSearchResult[] = strategyIntent(query) ? [{
    id: "journey:strategy",
    kind: "journey",
    group: "Your Journey",
    title: "Current opportunity mix",
    subtitle: "See how your current opportunities overlap and differ",
    href: "/#journey-strategy",
    score: 1_200,
  }] : [];
  const materials = Object.values(normalizeApplicationMaterialStore(input.account.applicationMaterials).records).flatMap((record): UniversalSearchResult[] => {
    const score = matchScore(query, [record.title, record.versionLabel ?? "", applicationMaterialTypeLabels[record.type], ...record.contexts]);
    if (!score) return [];
    return [{ id: `material:${record.id}`, kind: "material", group: "Materials", title: record.title, subtitle: `${applicationMaterialTypeLabels[record.type]} · ${applicationMaterialStatusLabels[record.status]}`, href: `/materials#material-${encodeURIComponent(record.id)}`, score: score + 360 }];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);
  const resumeLab = normalizeResumeLabStore(input.account.resumeLab);
  const resumes = Object.values(resumeLab.resumes).filter((record) => !record.archivedAt).flatMap((record): UniversalSearchResult[] => {
    const score = matchScore(query, [record.title, record.kind, record.target.label ?? "", "resume lab"]);
    if (!score) return [];
    return [{ id: `resume:${record.id}`, kind: "resume", group: "Resume Lab", title: record.title, subtitle: `${record.kind === "master" ? "Master" : "Targeted"} resume · Private`, href: `/resume-lab?resume=${encodeURIComponent(record.id)}`, score: score + 410 }];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);
  const experiences = Object.values(resumeLab.experiences).flatMap((record): UniversalSearchResult[] => {
    // Deliberately index structured Fact Ledger fields, not private resume-specific bullet prose.
    const score = matchScore(query, [record.title ?? "", record.organization ?? "", record.kind, ...record.skills, ...record.facts.filter((fact) => fact.confirmed).map((fact) => fact.text)]);
    if (!score) return [];
    return [{ id: `experience:${record.id}`, kind: "resume", group: "Resume Lab", title: record.title ?? "Untitled experience", subtitle: `${record.organization ?? "Personal experience"} · Experience Bank`, href: `/resume-lab?view=experience&experience=${encodeURIComponent(record.id)}`, score: score + 390 }];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);
  const answerStories = Object.values(normalizeAnswerBank(input.account.answerBank).records).flatMap((record): UniversalSearchResult[] => {
    // Search metadata only. Story bodies remain intentionally unindexed.
    const score = matchScore(query, [record.title, record.category, "answer bank"]);
    if (!score) return [];
    return [{ id: `answer-story:${record.id}`, kind: "resume", group: "Resume Lab", title: record.title, subtitle: `${record.category} · Private Answer Bank`, href: `/answer-bank#story-${encodeURIComponent(record.id)}`, score: score + 395 }];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);
  const paths = opportunityPaths.flatMap((path): UniversalSearchResult[] => {
    const score = matchScore(query, [path.name, path.shortName, `${path.name} path`, `${path.shortName} path`, path.description, ...path.profileAliases]);
    return score ? [{ id: `path:${path.id}`, kind: "path", group: "Paths", title: path.name, subtitle: "Explore opportunities by goal", href: `/paths/${path.id}`, score: score + 340 }] : [];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);
  const launchedCollectionIds = new Set(opportunityCollectionCoverage(input.opportunities, input.now).filter((item) => item.readiness === "launched").map((item) => item.id));
  const collections = opportunityCollections.flatMap((collection): UniversalSearchResult[] => {
    if (!launchedCollectionIds.has(collection.id)) return [];
    const score = matchScore(query, [collection.title, collection.shortTitle, collection.description, ...collection.profileAliases, `${collection.shortTitle} opportunities`]);
    return score ? [{ id: `collection:${collection.id}`, kind: "collection", group: "Collections", title: collection.title, subtitle: "Open a curated starting point", href: `/collections/${collection.id}`, score: score + 370 }] : [];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);
  const explorationQuery = query.replace(/^(what (?:can|could) i do with|explore|opportunities (?:in|for)|interested in)\s+/i, "").trim() || query;
  const explorer = [
    ...explorerAreas.flatMap((area): UniversalSearchResult[] => {
      const score = matchScore(explorationQuery, [area.name, area.shortName, area.description, ...area.aliases, ...area.landscapes.flatMap((landscape) => [landscape.name, landscape.description])]);
      return score ? [{ id: `explorer:${area.id}`, kind: "explorer", group: "Explore", title: area.name, subtitle: "Explore related fields and experience types", href: `/explore/${area.id}`, score: score + 380 }] : [];
    }),
    ...explorerExperienceTypes.flatMap((experience): UniversalSearchResult[] => {
      const score = matchScore(explorationQuery, [experience.name, experience.description, `${experience.name} opportunities`]);
      return score ? [{ id: `explorer-type:${experience.id}`, kind: "explorer", group: "Explore", title: `Explore ${experience.name}`, subtitle: experience.description, href: `/explore?type=${experience.id}#experience-types`, score: score + 350 }] : [];
    }),
  ].sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);
  const accomplishments = buildAccomplishmentsModel({ account: input.account, opportunities: trackedOpportunities }).records.flatMap((record): UniversalSearchResult[] => {
    const score = matchScore(query, [record.snapshot.title, record.snapshot.organization, record.kindLabel, record.outcomeLabel]);
    if (!score) return [];
    return [{
      id: `accomplishment:${record.id}`,
      kind: "accomplishment",
      group: "Accomplishments",
      title: record.snapshot.title,
      subtitle: `${record.outcomeLabel} · ${record.year}`,
      href: `/accomplishments#accomplishment-${encodeURIComponent(record.id)}`,
      score: score + 300,
    }];
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 4);

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
      href: conflictIntent(query) ? "/?calendar=conflicts#journey-upcoming-heading" : "/#journey-upcoming-heading",
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
      href: `/applications/${encodeURIComponent(record.id)}#task-${encodeURIComponent(task.id)}`,
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
    results: [...strategy, ...collections, ...explorer, ...resumes, ...experiences, ...answerStories, ...materials, ...paths, ...accomplishments, ...personal, ...upcoming, ...tasks, ...opportunities],
    totalOpportunityMatches: preciseCatalog.length ? catalog.total : 0,
  };
}
