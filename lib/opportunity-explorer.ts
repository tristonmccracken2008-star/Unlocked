import "server-only";

import { createAdvisorProfile } from "@/data/advisor-engine";
import { evaluateOpportunityEligibility } from "@/data/opportunity-eligibility";
import type { OpportunityStudentContext } from "@/data/opportunity-intelligence";
import {
  explorerAreas,
  explorerExperienceTypes,
  type ExplorerAreaDefinition,
  type ExplorerExperienceDefinition,
  type ExplorerLandscapeDefinition,
  type ExplorerRule,
} from "@/data/opportunity-explorer";
import type { Opportunity } from "@/data/opportunities";
import { buildOpportunityStudentContext } from "@/data/recommendation-engine";
import { auditRecommendationSafety } from "@/data/recommendation-safe-catalog";
import { schools } from "@/data/seed";
import type { AccountData } from "./account-types";

export type ExplorerOpportunityState = "exploring" | "watching" | "in_journey" | "completed";
export type ExplorerEligibilityState = "eligible" | "check" | "not_eligible";

export type ExplorerOpportunityView = {
  id: string;
  title: string;
  organization: string;
  type: Opportunity["type"];
  category: string;
  description: string;
  officialSource: string;
  icon: string | null;
  href: string;
  deadlineLabel: string;
  state: ExplorerOpportunityState;
  eligibility: ExplorerEligibilityState;
  eligibilityLabel: string;
  highValue: boolean;
};

export type ExplorerLandscapeView = {
  id: string;
  name: string;
  description: string;
  count: number;
  organizationCount: number;
  discoverHref: string;
  opportunities: ExplorerOpportunityView[];
};

export type ExplorerAreaSummary = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  href: string;
  count: number;
  organizationCount: number;
  profileRelated: boolean;
};

export type ExplorerExperienceView = {
  id: string;
  name: string;
  description: string;
  href: string;
  discoverHref: string;
  count: number;
};

export type ExplorerLandingModel = {
  areas: ExplorerAreaSummary[];
  related: ExplorerAreaSummary[];
  experiences: ExplorerExperienceView[];
  experienceSpotlight: ExplorerLandscapeView | null;
  firstYear: ExplorerLandscapeView[];
  serendipity: (ExplorerAreaSummary & { reason: string }) | null;
  notYetExplored: ExplorerAreaSummary[];
  pro: boolean;
  safeCatalogCount: number;
};

export type ExplorerAreaModel = ExplorerAreaSummary & {
  path: { id: string; name: string; href: string } | null;
  landscapes: ExplorerLandscapeView[];
  adjacent: ExplorerAreaSummary[];
  pro: boolean;
};

type SearchFields = {
  category: Set<string>;
  majors: Set<string>;
  tags: Set<string>;
  careerPaths: Set<string>;
  text: string;
};

type ExplorerIndex = {
  safe: readonly Opportunity[];
  areas: ReadonlyMap<string, readonly Opportunity[]>;
  landscapes: ReadonlyMap<string, readonly Opportunity[]>;
  experiences: ReadonlyMap<string, readonly Opportunity[]>;
};

const indexCache = new WeakMap<readonly Opportunity[], ExplorerIndex>();
const searchCache = new WeakMap<Opportunity, SearchFields>();
const normalizedCache = new Map<string, string>();

function normalize(value: string) {
  const cached = normalizedCache.get(value);
  if (cached !== undefined) return cached;
  const result = value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalizedCache.size < 3_000) normalizedCache.set(value, result);
  return result;
}

function fields(opportunity: Opportunity): SearchFields {
  const cached = searchCache.get(opportunity);
  if (cached) return cached;
  const result = {
    category: new Set([normalize(opportunity.category)]),
    majors: new Set(opportunity.majors.map(normalize)),
    tags: new Set(opportunity.tags.map(normalize)),
    careerPaths: new Set((opportunity.metadata.careerPaths ?? []).map(normalize)),
    text: normalize([
      opportunity.title,
      opportunity.organization,
      opportunity.description,
      opportunity.category,
      opportunity.type,
      ...opportunity.tags,
      ...opportunity.majors,
      ...(opportunity.metadata.careerPaths ?? []),
      ...(opportunity.metadata.skillsGained ?? []),
    ].join(" ")),
  };
  searchCache.set(opportunity, result);
  return result;
}

const intersects = (actual: ReadonlySet<string>, expected: readonly string[] | undefined) => !expected?.length || expected.some((value) => actual.has(normalize(value)));

export function opportunityMatchesExplorerRule(opportunity: Opportunity, rule: ExplorerRule) {
  const index = fields(opportunity);
  if (rule.types?.length && !rule.types.includes(opportunity.type)) return false;
  if (!intersects(index.category, rule.categories)) return false;
  if (!intersects(index.majors, rule.majors)) return false;
  if (!intersects(index.tags, rule.tags)) return false;
  if (!intersects(index.careerPaths, rule.careerPaths)) return false;
  if (rule.terms?.length && !rule.terms.some((term) => index.text.includes(normalize(term)))) return false;
  return true;
}

function matchesRules(opportunity: Opportunity, rules: readonly ExplorerRule[]) {
  return rules.some((rule) => opportunityMatchesExplorerRule(opportunity, rule));
}

export function buildOpportunityExplorerIndex(source: readonly Opportunity[]): ExplorerIndex {
  const cached = indexCache.get(source);
  if (cached) return cached;
  const safe = source.filter((opportunity) => auditRecommendationSafety(opportunity).safe);
  const areas = new Map<string, readonly Opportunity[]>();
  const landscapes = new Map<string, readonly Opportunity[]>();
  const experiences = new Map<string, readonly Opportunity[]>();
  for (const area of explorerAreas) {
    const areaIds = new Set<string>();
    for (const landscape of area.landscapes) {
      const matches = safe.filter((opportunity) => matchesRules(opportunity, landscape.rules));
      landscapes.set(`${area.id}:${landscape.id}`, matches);
      for (const opportunity of matches) areaIds.add(opportunity.id);
    }
    areas.set(area.id, safe.filter((opportunity) => areaIds.has(opportunity.id)));
  }
  for (const experience of explorerExperienceTypes) experiences.set(experience.id, safe.filter((opportunity) => matchesRules(opportunity, experience.rules)));
  const index = { safe, areas, landscapes, experiences };
  indexCache.set(source, index);
  return index;
}

function studentContext(account: AccountData): OpportunityStudentContext | null {
  const profile = account.profile;
  if (!profile) return null;
  const school = schools.find((item) => item.slug === profile.schoolSlug) ?? {
    slug: profile.schoolSlug,
    name: profile.schoolName ?? profile.schoolSlug,
    aliases: [], location: "", domain: "",
    initials: (profile.schoolName ?? profile.schoolSlug).split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]).join("").toUpperCase(),
    benefitSlugs: [],
  };
  return buildOpportunityStudentContext(createAdvisorProfile({ profile, school, activity: account.activity ?? undefined }));
}

function eligibilityState(opportunity: Opportunity, context: OpportunityStudentContext | null): ExplorerEligibilityState {
  if (!context) return "check";
  const evaluation = evaluateOpportunityEligibility(opportunity, context);
  if (evaluation.eligible) return "eligible";
  const uncertain = evaluation.checks.some((check) => check.applicable && !check.proven && /not known|cannot be proven|not positively proven|unknown/i.test(check.reason));
  return uncertain ? "check" : "not_eligible";
}

function currentRecords(account: AccountData) {
  return { ...(account.activity?.tracked ?? {}), ...(account.tracker ?? {}) };
}

function opportunityState(id: string, account: AccountData): ExplorerOpportunityState {
  const record = currentRecords(account)[id];
  if (record?.status === "Completed") return "completed";
  if (record || account.savedOpportunities.some((item) => item.opportunityId === id)) return "in_journey";
  if ((account.watchedOpportunities ?? []).some((item) => item.opportunityId === id)) return "watching";
  return "exploring";
}

function deadlineLabel(opportunity: Opportunity) {
  if (opportunity.application_deadline) return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${opportunity.application_deadline}T12:00:00Z`));
  if (opportunity.metadata.deadlineType === "rolling") return "Rolling";
  if (opportunity.metadata.deadlineType === "current_cycle_closed") return "Next cycle not announced";
  return "Date not announced";
}

function isHighValue(opportunity: Opportunity) {
  return opportunity.estimated_value !== null && opportunity.estimated_value >= 2_500
    || opportunity.paid === true
    || ["Internships", "Research Grants", "Fellowships", "Finance Internships", "Government & National Labs", "National Laboratory Research"].includes(opportunity.category);
}

function opportunityView(opportunity: Opportunity, account: AccountData, context: OpportunityStudentContext | null): ExplorerOpportunityView {
  const eligibility = eligibilityState(opportunity, context);
  const firstYear = account.profile?.year === "First year";
  return {
    id: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization,
    type: opportunity.type,
    category: opportunity.category,
    description: opportunity.description,
    officialSource: opportunity.official_source,
    icon: opportunity.icon,
    href: `/opportunities/${encodeURIComponent(opportunity.id)}`,
    deadlineLabel: deadlineLabel(opportunity),
    state: opportunityState(opportunity.id, account),
    eligibility,
    eligibilityLabel: eligibility === "eligible" ? firstYear ? "First-year eligibility supported" : "Fits your recorded eligibility" : eligibility === "not_eligible" ? "Doesn’t match your recorded eligibility" : "Check official eligibility",
    highValue: isHighValue(opportunity),
  };
}

function rankExamples(opportunities: readonly Opportunity[], account: AccountData, context: OpportunityStudentContext | null, limit: number) {
  return opportunities.map((opportunity) => opportunityView(opportunity, account, context))
    .filter((opportunity) => opportunity.eligibility !== "not_eligible" || opportunity.state !== "exploring")
    .sort((left, right) => {
      const stateWeight = { completed: 4, in_journey: 3, watching: 2, exploring: 1 } as const;
      return stateWeight[right.state] - stateWeight[left.state]
        || Number(right.eligibility === "eligible") - Number(left.eligibility === "eligible")
        || Number(right.highValue) - Number(left.highValue)
        || left.title.localeCompare(right.title);
    }).slice(0, limit);
}

function profileSignals(account: AccountData) {
  const profile = account.profile;
  if (!profile) return [];
  return [
    profile.major, profile.secondaryMajor ?? "", profile.minor ?? "", profile.careerGoal, profile.interests,
    ...(profile.fieldInterests ?? []), ...(profile.specificCareerInterests ?? []), ...(profile.goals ?? []), ...(profile.topics ?? []),
  ].map(normalize).filter(Boolean);
}

function profileRelated(area: ExplorerAreaDefinition, signals: readonly string[]) {
  return area.aliases.some((alias) => signals.some((signal) => signal === normalize(alias) || signal.includes(normalize(alias)) || normalize(alias).includes(signal)));
}

function areaSummary(area: ExplorerAreaDefinition, index: ExplorerIndex, signals: readonly string[]): ExplorerAreaSummary {
  const opportunities = index.areas.get(area.id) ?? [];
  return {
    id: area.id,
    name: area.name,
    shortName: area.shortName,
    description: area.description,
    href: `/explore/${area.id}`,
    count: opportunities.length,
    organizationCount: new Set(opportunities.map((opportunity) => opportunity.organization)).size,
    profileRelated: profileRelated(area, signals),
  };
}

function pursuedAreaIds(index: ExplorerIndex, account: AccountData) {
  const recorded = new Set([
    ...Object.keys(currentRecords(account)),
    ...account.savedOpportunities.map((record) => record.opportunityId),
    ...(account.watchedOpportunities ?? []).map((record) => record.opportunityId),
    ...Object.values(account.accomplishments ?? {}).flatMap((record) => [record.canonicalOpportunityId, record.journeyOpportunityId].filter((id): id is string => Boolean(id))),
  ]);
  const result = new Set<string>();
  for (const [areaId, opportunities] of index.areas) if (opportunities.some((opportunity) => recorded.has(opportunity.id))) result.add(areaId);
  return result;
}

function serendipityArea(areas: readonly ExplorerAreaSummary[], account: AccountData, pursued: ReadonlySet<string>, pro: boolean) {
  const related = areas.filter((area) => area.profileRelated);
  const adjacent = new Set(related.flatMap((summary) => explorerAreas.find((area) => area.id === summary.id)?.adjacentAreaIds ?? []));
  const candidates = areas.filter((area) => area.count >= 2 && !area.profileRelated && !pursued.has(area.id));
  const selected = [...candidates].sort((left, right) => Number(adjacent.has(right.id)) - Number(adjacent.has(left.id)) || right.organizationCount - left.organizationCount || right.count - left.count || left.id.localeCompare(right.id))[0];
  if (!selected) return null;
  const relatedNames = related.slice(0, 2).map((area) => area.shortName);
  const reason = pro && adjacent.has(selected.id) && relatedNames.length ? `Related to ${relatedNames.join(" and ")}` : "A different part of the verified catalog";
  return { ...selected, reason };
}

export function buildOpportunityExplorerLanding(input: { account: AccountData; opportunities: readonly Opportunity[]; pro: boolean; experienceId?: string }): ExplorerLandingModel {
  const index = buildOpportunityExplorerIndex(input.opportunities);
  const signals = profileSignals(input.account);
  const areas = explorerAreas.map((area) => areaSummary(area, index, signals)).filter((area) => area.count >= 3 && area.organizationCount >= 2);
  const related = areas.filter((area) => area.profileRelated);
  const pursued = pursuedAreaIds(index, input.account);
  const context = studentContext(input.account);
  const firstYear = input.account.profile?.year === "First year" ? explorerExperienceTypes.flatMap((experience): ExplorerLandscapeView[] => {
    const opportunities = index.experiences.get(experience.id) ?? [];
    const eligible = opportunities.filter((opportunity) => eligibilityState(opportunity, context) === "eligible");
    if (!eligible.length) return [];
    return [{ id: experience.id, name: experience.name, description: experience.description, count: eligible.length, organizationCount: new Set(eligible.map((item) => item.organization)).size, discoverHref: `${experience.discoverHref}${experience.discoverHref.includes("?") ? "&" : "?"}freshmanFriendly=true`, opportunities: rankExamples(eligible, input.account, context, 2) }];
  }).slice(0, 5) : [];
  const selectedExperience = explorerExperienceTypes.find((experience) => experience.id === input.experienceId);
  const experienceOpportunities = selectedExperience ? index.experiences.get(selectedExperience.id) ?? [] : [];
  return {
    areas,
    related,
    experiences: explorerExperienceTypes.flatMap((experience): ExplorerExperienceView[] => {
      const count = index.experiences.get(experience.id)?.length ?? 0;
      return count ? [{ id: experience.id, name: experience.name, description: experience.description, href: `/explore?type=${experience.id}#experience-spotlight`, discoverHref: experience.discoverHref, count }] : [];
    }),
    experienceSpotlight: selectedExperience && experienceOpportunities.length ? {
      id: `experience-${selectedExperience.id}`,
      name: selectedExperience.name,
      description: selectedExperience.description,
      count: experienceOpportunities.length,
      organizationCount: new Set(experienceOpportunities.map((opportunity) => opportunity.organization)).size,
      discoverHref: selectedExperience.discoverHref,
      opportunities: rankExamples(experienceOpportunities, input.account, context, input.pro ? 3 : 2),
    } : null,
    firstYear,
    serendipity: serendipityArea(areas, input.account, pursued, input.pro),
    notYetExplored: areas.filter((area) => !pursued.has(area.id)).sort((left, right) => Number(right.profileRelated) - Number(left.profileRelated) || right.count - left.count).slice(0, 3),
    pro: input.pro,
    safeCatalogCount: index.safe.length,
  };
}

function landscapeView(definition: ExplorerLandscapeDefinition, areaId: string, index: ExplorerIndex, account: AccountData, context: OpportunityStudentContext | null, pro: boolean): ExplorerLandscapeView | null {
  const opportunities = index.landscapes.get(`${areaId}:${definition.id}`) ?? [];
  if (!opportunities.length) return null;
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    count: opportunities.length,
    organizationCount: new Set(opportunities.map((opportunity) => opportunity.organization)).size,
    discoverHref: definition.discoverHref,
    opportunities: rankExamples(opportunities, account, context, pro ? 3 : 2),
  };
}

export function buildOpportunityExplorerArea(input: { area: ExplorerAreaDefinition; account: AccountData; opportunities: readonly Opportunity[]; pro: boolean }): ExplorerAreaModel {
  const index = buildOpportunityExplorerIndex(input.opportunities);
  const signals = profileSignals(input.account);
  const context = studentContext(input.account);
  const summary = areaSummary(input.area, index, signals);
  const adjacent = input.area.adjacentAreaIds.flatMap((id) => {
    const area = explorerAreas.find((candidate) => candidate.id === id);
    if (!area) return [];
    const view = areaSummary(area, index, signals);
    return view.count >= 3 ? [view] : [];
  }).slice(0, 4);
  return {
    ...summary,
    path: input.area.pathId ? { id: input.area.pathId, name: input.area.shortName, href: `/paths/${input.area.pathId}` } : null,
    landscapes: input.area.landscapes.flatMap((landscape) => {
      const view = landscapeView(landscape, input.area.id, index, input.account, context, input.pro);
      return view ? [view] : [];
    }),
    adjacent,
    pro: input.pro,
  };
}

export function opportunityExplorerCoverage(source: readonly Opportunity[]) {
  const index = buildOpportunityExplorerIndex(source);
  return {
    safeCatalogCount: index.safe.length,
    areas: explorerAreas.map((area) => {
      const opportunities = index.areas.get(area.id) ?? [];
      return { id: area.id, count: opportunities.length, organizations: new Set(opportunities.map((item) => item.organization)).size, landscapes: area.landscapes.map((landscape) => ({ id: landscape.id, count: index.landscapes.get(`${area.id}:${landscape.id}`)?.length ?? 0 })) };
    }),
    experiences: explorerExperienceTypes.map((experience) => ({ id: experience.id, count: index.experiences.get(experience.id)?.length ?? 0 })),
  };
}
