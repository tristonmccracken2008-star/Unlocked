import "server-only";

import { createAdvisorProfile } from "@/data/advisor-engine";
import { evaluateOpportunityEligibility } from "@/data/opportunity-eligibility";
import type { OpportunityStudentContext } from "@/data/opportunity-intelligence";
import { buildOpportunityStudentContext } from "@/data/recommendation-engine";
import { auditRecommendationSafety } from "@/data/recommendation-safe-catalog";
import {
  opportunityPaths,
  type OpportunityPathDefinition,
  type OpportunityPathRule,
} from "@/data/opportunity-paths";
import type { Opportunity } from "@/data/opportunities";
import { schools } from "@/data/seed";
import type { AccountData } from "./account-types";
import { buildAccomplishmentsModel } from "./accomplishments";

export type PathOpportunityState = "exploring" | "watching" | "in_journey" | "completed";
export type PathEligibilityState = "eligible" | "check" | "not_eligible";

export type PathOpportunityView = {
  id: string;
  title: string;
  organization: string;
  type: Opportunity["type"];
  category: string;
  officialSource: string;
  icon: string | null;
  href: string;
  deadline: string | null;
  deadlineLabel: string;
  lifecycleLabel: string;
  state: PathOpportunityState;
  eligibility: PathEligibilityState;
  eligibilityLabel: string;
  highValue: boolean;
};

export type OpportunityPathStageView = {
  id: string;
  name: string;
  description: string;
  experienceTypes: readonly string[];
  discoverHref: string;
  currentCount: number;
  eligibleCount: number;
  completedCount: number;
  journeyCount: number;
  watchingCount: number;
  opportunities: PathOpportunityView[];
};

export type OpportunityPathView = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  followed: boolean;
  profileRelated: boolean;
  currentCount: number;
  highValueCount: number;
  organizationCount: number;
  academicYears: string[];
  completedCount: number;
  journeyCount: number;
  watchingCount: number;
  stages: OpportunityPathStageView[];
  related: Array<{ id: string; name: string; href: string }>;
};

export type OpportunityPathsLandingModel = {
  followed: OpportunityPathView[];
  related: OpportunityPathView[];
  explore: OpportunityPathView[];
  all: OpportunityPathView[];
  pro: boolean;
};

type PathIndex = ReadonlyMap<string, ReadonlyMap<string, readonly Opportunity[]>>;
const indexCache = new WeakMap<readonly Opportunity[], PathIndex>();
const normalize = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
const normalizedSet = (values: readonly string[]) => new Set(values.map(normalize));
const intersects = (actual: readonly string[], expected: readonly string[] | undefined) => !expected?.length || expected.some((value) => normalizedSet(actual).has(normalize(value)));

function ruleMatches(opportunity: Opportunity, rule: OpportunityPathRule) {
  if (rule.opportunityIds?.length && !rule.opportunityIds.includes(opportunity.id)) return false;
  if (rule.types?.length && !rule.types.includes(opportunity.type)) return false;
  if (!intersects([opportunity.category], rule.categories)) return false;
  if (!intersects(opportunity.majors, rule.majors)) return false;
  if (!intersects(opportunity.tags, rule.tags)) return false;
  if (!intersects(opportunity.metadata.careerPaths ?? [], rule.careerPaths)) return false;
  return true;
}

export function opportunityMatchesPathStage(opportunity: Opportunity, stage: OpportunityPathDefinition["stages"][number]) {
  return stage.rules.some((rule) => ruleMatches(opportunity, rule));
}

export function buildOpportunityPathIndex(source: readonly Opportunity[]): PathIndex {
  const cached = indexCache.get(source);
  if (cached) return cached;
  const safe = source.filter((opportunity) => auditRecommendationSafety(opportunity).safe);
  const paths = new Map<string, ReadonlyMap<string, readonly Opportunity[]>>();
  for (const path of opportunityPaths as readonly OpportunityPathDefinition[]) {
    const assigned = new Set<string>();
    const stages = new Map<string, readonly Opportunity[]>();
    const assignmentOrder = [...path.stages].sort((left, right) => (right.mappingPriority ?? 0) - (left.mappingPriority ?? 0));
    for (const stage of assignmentOrder) {
      const matches = safe.filter((opportunity) => !assigned.has(opportunity.id) && opportunityMatchesPathStage(opportunity, stage));
      for (const opportunity of matches) assigned.add(opportunity.id);
      stages.set(stage.id, matches);
    }
    paths.set(path.id, stages);
  }
  indexCache.set(source, paths);
  return paths;
}

function contextFor(account: AccountData): OpportunityStudentContext | null {
  const profile = account.profile;
  if (!profile) return null;
  const school = schools.find((item) => item.slug === profile.schoolSlug) ?? {
    slug: profile.schoolSlug,
    name: profile.schoolName ?? profile.schoolSlug,
    aliases: [],
    location: "",
    domain: "",
    initials: (profile.schoolName ?? profile.schoolSlug).split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]).join("").toUpperCase(),
    benefitSlugs: [],
  };
  return buildOpportunityStudentContext(createAdvisorProfile({ profile, school, activity: account.activity ?? undefined }));
}

function eligibilityState(opportunity: Opportunity, context: OpportunityStudentContext | null): PathEligibilityState {
  if (!context) return "check";
  const evaluation = evaluateOpportunityEligibility(opportunity, context);
  if (evaluation.eligible) return "eligible";
  const unknown = evaluation.checks.some((check) => check.applicable && !check.proven && /not known|cannot be proven|not positively proven/i.test(check.reason));
  return unknown ? "check" : "not_eligible";
}

function deadlineLabel(opportunity: Opportunity) {
  if (opportunity.application_deadline) return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${opportunity.application_deadline}T12:00:00Z`));
  if (opportunity.metadata.deadlineType === "rolling") return "Rolling";
  if (opportunity.metadata.deadlineType === "current_cycle_closed") return "Next cycle not announced";
  return "Date not announced";
}

function highValue(opportunity: Opportunity) {
  return opportunity.estimated_value !== null && opportunity.estimated_value >= 2_500
    || opportunity.paid === true
    || ["Internships", "Research Grants", "Fellowships", "Finance Internships", "Government & National Labs", "National Laboratory Research"].includes(opportunity.category);
}

function pathProfileRelated(path: OpportunityPathDefinition, account: AccountData) {
  const profile = account.profile;
  if (!profile) return false;
  const values = [profile.careerGoal, profile.major, ...(profile.specificCareerInterests ?? []), ...(profile.fieldInterests ?? []), ...(profile.goals ?? [])].map(normalize);
  return path.profileAliases.some((alias) => values.some((value) => value === normalize(alias) || value.includes(normalize(alias))));
}

function opportunityState(id: string, journeyIds: Set<string>, watchedIds: Set<string>, completedIds: Set<string>): PathOpportunityState {
  if (completedIds.has(id)) return "completed";
  if (journeyIds.has(id)) return "in_journey";
  if (watchedIds.has(id)) return "watching";
  return "exploring";
}

function opportunityView(opportunity: Opportunity, state: PathOpportunityState, eligibility: PathEligibilityState): PathOpportunityView {
  return {
    id: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization,
    type: opportunity.type,
    category: opportunity.category,
    officialSource: opportunity.official_source,
    icon: opportunity.icon,
    href: `/opportunities/${encodeURIComponent(opportunity.id)}`,
    deadline: opportunity.application_deadline,
    deadlineLabel: deadlineLabel(opportunity),
    lifecycleLabel: opportunity.metadata.deadlineType === "rolling" ? "Open on a rolling basis" : "Current opportunity",
    state,
    eligibility,
    eligibilityLabel: eligibility === "eligible" ? "Fits your recorded eligibility" : eligibility === "not_eligible" ? "Doesn’t match your recorded eligibility" : "Check eligibility",
    highValue: highValue(opportunity),
  };
}

export function buildOpportunityPathModel(input: { path: OpportunityPathDefinition; account: AccountData; opportunities: readonly Opportunity[]; pro: boolean }): OpportunityPathView {
  const index: ReadonlyMap<string, readonly Opportunity[]> = buildOpportunityPathIndex(input.opportunities).get(input.path.id)
    ?? new Map<string, readonly Opportunity[]>();
  const context = contextFor(input.account);
  const journeyIds = new Set([
    ...Object.keys(input.account.activity?.tracked ?? {}),
    ...Object.keys(input.account.tracker ?? {}),
    ...input.account.savedOpportunities.map((record) => record.opportunityId),
  ]);
  const watchedIds = new Set((input.account.watchedOpportunities ?? []).map((record) => record.opportunityId));
  const accomplishments = buildAccomplishmentsModel({ account: input.account, opportunities: input.opportunities });
  const completedIds = new Set(accomplishments.records.flatMap((record) => record.canonicalOpportunityId ? [record.canonicalOpportunityId] : []));
  const followed = Boolean(input.account.pathPreferences?.[input.path.id]);
  const stages = input.path.stages.map((stage): OpportunityPathStageView => {
    const current = index.get(stage.id) ?? [];
    const candidates = current.map((opportunity) => {
      const eligibility = eligibilityState(opportunity, context);
      return opportunityView(opportunity, opportunityState(opportunity.id, journeyIds, watchedIds, completedIds), eligibility);
    });
    const visible = candidates
      .filter((item) => item.eligibility !== "not_eligible" || item.state !== "exploring")
      .sort((left, right) => {
        const stateWeight = { completed: 4, in_journey: 3, watching: 2, exploring: 1 } as const;
        return stateWeight[right.state] - stateWeight[left.state]
          || Number(right.eligibility === "eligible") - Number(left.eligibility === "eligible")
          || Number(right.highValue) - Number(left.highValue)
          || left.title.localeCompare(right.title);
      })
      .slice(0, input.pro ? 3 : 1);
    return {
      id: stage.id,
      name: stage.name,
      description: stage.description,
      experienceTypes: stage.experienceTypes,
      discoverHref: stage.discoverHref,
      currentCount: current.length,
      eligibleCount: candidates.filter((item) => item.eligibility === "eligible").length,
      completedCount: candidates.filter((item) => item.state === "completed").length,
      journeyCount: candidates.filter((item) => item.state === "in_journey").length,
      watchingCount: candidates.filter((item) => item.state === "watching").length,
      opportunities: visible,
    };
  });
  const all = [...new Map([...index.values()].flat().map((opportunity) => [opportunity.id, opportunity])).values()];
  return {
    id: input.path.id,
    name: input.path.name,
    shortName: input.path.shortName,
    description: input.path.description,
    followed,
    profileRelated: pathProfileRelated(input.path, input.account),
    currentCount: all.length,
    highValueCount: all.filter(highValue).length,
    organizationCount: new Set(all.map((opportunity) => opportunity.organization)).size,
    academicYears: [...new Set(all.flatMap((opportunity) => opportunity.academic_years))],
    completedCount: stages.reduce((sum, stage) => sum + stage.completedCount, 0),
    journeyCount: stages.reduce((sum, stage) => sum + stage.journeyCount, 0),
    watchingCount: stages.reduce((sum, stage) => sum + stage.watchingCount, 0),
    stages,
    related: input.path.relatedPathIds.flatMap((id) => {
      const path = opportunityPaths.find((candidate) => candidate.id === id);
      return path ? [{ id: path.id, name: path.name, href: `/paths/${path.id}` }] : [];
    }),
  };
}

export function buildOpportunityPathsLandingModel(input: { account: AccountData; opportunities: readonly Opportunity[]; pro: boolean }): OpportunityPathsLandingModel {
  const all = opportunityPaths.map((path) => buildOpportunityPathModel({ ...input, path }));
  const followed = all.filter((path) => path.followed);
  const related = all.filter((path) => path.profileRelated && !path.followed);
  const included = new Set([...followed, ...related].map((path) => path.id));
  return { followed, related, explore: all.filter((path) => !included.has(path.id)), all, pro: input.pro };
}

export function opportunityPathCoverage(source: readonly Opportunity[]) {
  const index = buildOpportunityPathIndex(source);
  return opportunityPaths.map((path) => {
    const opportunities = [...new Map([...(index.get(path.id)?.values() ?? [])].flat().map((item) => [item.id, item])).values()];
    return {
      id: path.id,
      name: path.name,
      opportunities: opportunities.length,
      highValue: opportunities.filter(highValue).length,
      organizations: new Set(opportunities.map((item) => item.organization)).size,
      academicYears: [...new Set(opportunities.flatMap((item) => item.academic_years))].sort(),
      stages: path.stages.map((stage) => ({ id: stage.id, count: index.get(path.id)?.get(stage.id)?.length ?? 0 })),
    };
  });
}
