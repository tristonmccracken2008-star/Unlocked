import "server-only";

import { createAdvisorProfile } from "@/data/advisor-engine";
import { evaluateOpportunityEligibility } from "@/data/opportunity-eligibility";
import { normalizeOpportunityEligibility } from "@/data/opportunity-eligibility-model";
import type { OpportunityStudentContext } from "@/data/opportunity-intelligence";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import { opportunityCollectionById, opportunityCollections, type OpportunityCollectionDefinition } from "@/data/opportunity-collections";
import type { Opportunity } from "@/data/opportunities";
import { buildOpportunityStudentContext } from "@/data/recommendation-engine";
import { auditRecommendationSafety } from "@/data/recommendation-safe-catalog";
import { schools } from "@/data/seed";
import type { AccountData } from "./account-types";
import { buildOpportunityExplorerIndex } from "./opportunity-explorer";

export type CollectionReadiness = "launched" | "deferred";
export type CollectionOpportunityState = "available" | "watching" | "in_journey" | "completed";
export type CollectionEligibilityState = "eligible" | "check" | "not_eligible";

export type CollectionCoverage = {
  id: string;
  title: string;
  readiness: CollectionReadiness;
  safe: number;
  highValue: number;
  organizations: number;
  types: number;
  categories: number;
  knownLifecycle: number;
  verifiedDeadlines: number;
  firstYear: number;
  international: number;
  transfer: number;
  blockers: string[];
};

export type CollectionOpportunityView = {
  id: string;
  title: string;
  organization: string;
  type: Opportunity["type"];
  category: string;
  officialSource: string;
  icon: string | null;
  href: string;
  state: CollectionOpportunityState;
  eligibility: CollectionEligibilityState;
  lifecycleLabel: string;
  deadlineLabel: string;
  factualLabel: string;
  highValue: boolean;
};

export type CollectionSummary = CollectionCoverage & {
  shortTitle: string;
  description: string;
  archetype: OpportunityCollectionDefinition["archetype"];
  href: string;
  profileRelated: boolean;
};

export type CollectionsLandingModel = {
  featured: CollectionSummary[];
  groups: Array<{ id: OpportunityCollectionDefinition["archetype"]; label: string; collections: CollectionSummary[] }>;
  launched: CollectionSummary[];
  pro: boolean;
};

export type CollectionDetailModel = CollectionSummary & {
  factualLabel: string;
  startHere: CollectionOpportunityView[];
  more: CollectionOpportunityView[];
  discoverHref: string;
  explorer: { title: string; href: string } | null;
  path: { title: string; href: string } | null;
  related: CollectionSummary[];
  pro: boolean;
};

type CollectionIndex = {
  safe: readonly Opportunity[];
  members: ReadonlyMap<string, readonly Opportunity[]>;
  coverage: ReadonlyMap<string, CollectionCoverage>;
};

const indexCache = new WeakMap<readonly Opportunity[], Map<string, CollectionIndex>>();
const normalizedCache = new Map<string, string>();
const normalize = (value: string) => {
  const cached = normalizedCache.get(value);
  if (cached !== undefined) return cached;
  const normalized = value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalizedCache.size < 3_000) normalizedCache.set(value, normalized);
  return normalized;
};

function highValue(opportunity: Opportunity) {
  return opportunity.estimated_value !== null && opportunity.estimated_value >= 2_500
    || opportunity.paid === true
    || ["Internships", "Research Grants", "Fellowships", "Finance Internships", "Government & National Labs", "National Laboratory Research"].includes(opportunity.category);
}

function explicitSummer(opportunity: Opportunity) {
  const season = normalize(opportunity.metadata.applicationSeason ?? "");
  return season.split(" ").includes("summer") || /\bsummer\b/i.test(`${opportunity.title} ${opportunity.category}`);
}

function matchesCollection(definition: OpportunityCollectionDefinition, opportunity: Opportunity, explorer: ReturnType<typeof buildOpportunityExplorerIndex>, now: Date) {
  const canonical = normalizeOpportunityEligibility(opportunity);
  const lifecycle = resolveOpportunityLifecycle(opportunity, now);
  const selector = definition.selector;
  if (selector.kind === "first_year") return canonical.classYears.some((year) => year === "First year" || year === "Any Year");
  if (selector.kind === "research") return opportunity.type === "Research" || /Research|National Laboratory/.test(opportunity.category);
  if (selector.kind === "summer") return explicitSummer(opportunity);
  if (selector.kind === "scholarship") return opportunity.type === "Scholarship";
  if (selector.kind === "explorer_area") {
    if (!(explorer.areas.get(selector.areaId) ?? []).some((item) => item.id === opportunity.id)) return false;
    if (!selector.terms?.length) return true;
    const text = normalize([opportunity.title, opportunity.category, opportunity.description, ...opportunity.tags, ...(opportunity.metadata.careerPaths ?? [])].join(" "));
    return selector.terms.some((term) => text.includes(normalize(term)));
  }
  if (selector.kind === "competition") return ["Competitions", "Hackathons"].includes(opportunity.category);
  if (selector.kind === "international") return canonical.citizenship.some((status) => status === "international_allowed" || status === "unrestricted");
  if (selector.kind === "transfer") return canonical.transferEligibility === "transfer_specific" || canonical.transferEligibility === "explicitly_eligible";
  if (selector.kind === "open_now") return lifecycle.actionable;
  if (selector.kind === "deadline_window") {
    if (!opportunity.application_deadline || opportunity.metadata.verification?.deadlineVerified !== true || !lifecycle.actionable) return false;
    const days = Math.ceil((Date.parse(`${opportunity.application_deadline}T23:59:59.999Z`) - now.getTime()) / 86_400_000);
    return days >= 0 && days <= selector.days;
  }
  if (selector.kind === "next_cycle") return ["temporarily_closed", "closed"].includes(lifecycle.state) && lifecycle.recurring && ["confirmed", "strong"].includes(lifecycle.confidence);
  return ["Government & National Labs", "National Laboratory Research", "Museums & Archives", "Museums & Arts", "Competitions", "Public Service", "Government Internships", "Cybersecurity Training"].includes(opportunity.category)
    || /\b(national laboratory|museum|archives?|space apps|cyber league)\b/i.test(`${opportunity.title} ${opportunity.organization}`);
}

function coverageFor(definition: OpportunityCollectionDefinition, items: readonly Opportunity[], now: Date): CollectionCoverage {
  const organizations = new Set(items.map((item) => normalize(item.organization))).size;
  const types = new Set(items.map((item) => item.type)).size;
  const categories = new Set(items.map((item) => item.category)).size;
  const knownLifecycle = items.filter((item) => resolveOpportunityLifecycle(item, now).confidence === "confirmed" || resolveOpportunityLifecycle(item, now).confidence === "strong").length;
  const verifiedDeadlines = items.filter((item) => item.application_deadline && item.metadata.verification?.deadlineVerified === true).length;
  const explicitEligibility = items.filter((item) => {
    const canonical = normalizeOpportunityEligibility(item);
    if (definition.selector.kind === "first_year") return canonical.classYears.includes("First year") || canonical.classYears.includes("Any Year");
    if (definition.selector.kind === "international") return canonical.citizenship.some((status) => status === "international_allowed" || status === "unrestricted");
    if (definition.selector.kind === "transfer") return canonical.transferEligibility === "transfer_specific" || canonical.transferEligibility === "explicitly_eligible";
    return true;
  }).length;
  const threshold = definition.threshold;
  const blockers = [
    items.length < threshold.minimumSafe ? `Needs ${threshold.minimumSafe} safe opportunities; found ${items.length}.` : "",
    organizations < threshold.minimumOrganizations ? `Needs ${threshold.minimumOrganizations} organizations; found ${organizations}.` : "",
    categories < threshold.minimumCategories ? `Needs ${threshold.minimumCategories} categories; found ${categories}.` : "",
    types < (threshold.minimumTypes ?? 1) ? `Needs ${threshold.minimumTypes} opportunity types; found ${types}.` : "",
    threshold.requireVerifiedDeadlineShare && verifiedDeadlines / Math.max(items.length, 1) < threshold.requireVerifiedDeadlineShare ? "Verified deadline coverage is insufficient." : "",
    threshold.requireExplicitEligibilityShare && explicitEligibility / Math.max(items.length, 1) < threshold.requireExplicitEligibilityShare ? "Explicit eligibility coverage is insufficient." : "",
  ].filter(Boolean);
  return {
    id: definition.id,
    title: definition.title,
    readiness: blockers.length ? "deferred" : "launched",
    safe: items.length,
    highValue: items.filter(highValue).length,
    organizations,
    types,
    categories,
    knownLifecycle,
    verifiedDeadlines,
    firstYear: items.filter((item) => normalizeOpportunityEligibility(item).classYears.some((year) => year === "First year" || year === "Any Year")).length,
    international: items.filter((item) => normalizeOpportunityEligibility(item).citizenship.some((status) => status === "international_allowed" || status === "unrestricted")).length,
    transfer: items.filter((item) => ["transfer_specific", "explicitly_eligible"].includes(normalizeOpportunityEligibility(item).transferEligibility)).length,
    blockers,
  };
}

export function buildOpportunityCollectionIndex(source: readonly Opportunity[], now = new Date()): CollectionIndex {
  const day = now.toISOString().slice(0, 10);
  const byDay = indexCache.get(source) ?? new Map<string, CollectionIndex>();
  if (!indexCache.has(source)) indexCache.set(source, byDay);
  const cached = byDay.get(day);
  if (cached) return cached;
  const safe = source.filter((opportunity) => auditRecommendationSafety(opportunity).safe);
  const explorer = buildOpportunityExplorerIndex(source);
  const members = new Map<string, readonly Opportunity[]>();
  const coverage = new Map<string, CollectionCoverage>();
  for (const definition of opportunityCollections) {
    const items = safe.filter((opportunity) => matchesCollection(definition, opportunity, explorer, now));
    members.set(definition.id, items);
    coverage.set(definition.id, coverageFor(definition, items, now));
  }
  const index = { safe, members, coverage };
  byDay.set(day, index);
  if (byDay.size > 2) byDay.delete(byDay.keys().next().value!);
  return index;
}

function contextFor(account: AccountData): OpportunityStudentContext | null {
  const profile = account.profile;
  if (!profile) return null;
  const school = schools.find((item) => item.slug === profile.schoolSlug) ?? {
    slug: profile.schoolSlug, name: profile.schoolName ?? profile.schoolSlug, aliases: [], location: "", domain: "",
    initials: (profile.schoolName ?? profile.schoolSlug).split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]).join("").toUpperCase(), benefitSlugs: [],
  };
  return buildOpportunityStudentContext(createAdvisorProfile({ profile, school, activity: account.activity ?? undefined }));
}

function accountState(account: AccountData) {
  const journey = new Set([...Object.keys(account.activity?.tracked ?? {}), ...Object.keys(account.tracker ?? {}), ...account.savedOpportunities.map((item) => item.opportunityId)]);
  const watched = new Set((account.watchedOpportunities ?? []).map((item) => item.opportunityId));
  const completed = new Set(Object.values(account.accomplishments ?? {}).flatMap((item) => [item.canonicalOpportunityId, item.journeyOpportunityId].filter((id): id is string => Boolean(id))));
  for (const [id, record] of Object.entries({ ...(account.activity?.tracked ?? {}), ...(account.tracker ?? {}) })) if (record.status === "Completed") completed.add(id);
  return { journey, watched, completed };
}

function opportunityState(id: string, state: ReturnType<typeof accountState>): CollectionOpportunityState {
  if (state.completed.has(id)) return "completed";
  if (state.journey.has(id)) return "in_journey";
  if (state.watched.has(id)) return "watching";
  return "available";
}

function eligibility(opportunity: Opportunity, context: OpportunityStudentContext | null): CollectionEligibilityState {
  if (!context) return "check";
  const result = evaluateOpportunityEligibility(opportunity, context);
  if (result.eligible) return "eligible";
  return result.checks.some((check) => check.applicable && !check.proven && /not known|not positively proven|unknown/i.test(check.reason)) ? "check" : "not_eligible";
}

function profileRelated(definition: OpportunityCollectionDefinition, account: AccountData) {
  const profile = account.profile;
  if (!profile) return false;
  if (definition.id === "first-year" && profile.year === "First year") return true;
  if (definition.id === "international-friendly" && profile.citizenshipStatus === "international") return true;
  if (definition.id === "transfer-friendly" && ["community_college_student", "transfer_applicant"].includes(profile.transferStatus ?? "")) return true;
  const signals = [profile.major, profile.secondaryMajor ?? "", profile.careerGoal, profile.interests, ...(profile.fieldInterests ?? []), ...(profile.specificCareerInterests ?? []), ...(profile.goals ?? [])].map(normalize);
  return definition.profileAliases.some((alias) => signals.some((signal) => signal === normalize(alias) || signal.includes(normalize(alias))));
}

function summary(definition: OpportunityCollectionDefinition, coverage: CollectionCoverage, account: AccountData): CollectionSummary {
  return { ...coverage, shortTitle: definition.shortTitle, description: definition.description, archetype: definition.archetype, href: `/collections/${definition.id}`, profileRelated: profileRelated(definition, account) };
}

function deadlineLabel(opportunity: Opportunity) {
  if (!opportunity.application_deadline) return opportunity.metadata.deadlineType === "rolling" ? "Rolling" : "Date not announced";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${opportunity.application_deadline}T12:00:00Z`));
}

function rankAndDiversify(items: readonly Opportunity[], definition: OpportunityCollectionDefinition, account: AccountData, context: OpportunityStudentContext | null, now: Date) {
  const state = accountState(account);
  const scored = items.map((opportunity) => {
    const currentState = opportunityState(opportunity.id, state);
    const currentEligibility = eligibility(opportunity, context);
    const lifecycle = resolveOpportunityLifecycle(opportunity, now);
    const deadlineDays = opportunity.application_deadline ? Math.ceil((Date.parse(`${opportunity.application_deadline}T23:59:59.999Z`) - now.getTime()) / 86_400_000) : null;
    const safety = auditRecommendationSafety(opportunity, now);
    const safetyPriority = safety.queuePriority === "safe" ? 24 : safety.queuePriority === "one_critical_blocker" ? 18 : safety.queuePriority === "two_critical_blockers" ? 12 : safety.queuePriority === "coverage_gap" ? 6 : 0;
    const score = safetyPriority
      + Number(highValue(opportunity)) * 18
      + Number(lifecycle.actionable) * 12
      + Number(currentEligibility === "eligible") * 8
      + Number(deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 60) * 9
      - Number(currentState === "completed") * 180
      - Number(currentEligibility === "not_eligible") * 120;
    return { opportunity, currentState, currentEligibility, lifecycle, score };
  }).sort((left, right) => right.score - left.score || left.opportunity.title.localeCompare(right.opportunity.title));
  const selected: typeof scored = [];
  const organizations = new Set<string>();
  const categories = new Set<string>();
  for (const item of scored) {
    if (item.currentState === "completed" || item.currentEligibility === "not_eligible") continue;
    const organization = normalize(item.opportunity.organization);
    if (organizations.has(organization) && selected.length < 8) continue;
    const categoryBonus = categories.has(item.opportunity.category) ? 0 : 1;
    if (!categoryBonus && selected.length < 3 && scored.some((candidate) => !categories.has(candidate.opportunity.category) && !organizations.has(normalize(candidate.opportunity.organization)))) continue;
    selected.push(item);
    organizations.add(organization);
    categories.add(item.opportunity.category);
  }
  for (const item of scored) if (!selected.includes(item) && item.currentState !== "completed" && item.currentEligibility !== "not_eligible") selected.push(item);
  return selected.map(({ opportunity, currentState, currentEligibility, lifecycle }): CollectionOpportunityView => ({
    id: opportunity.id, title: opportunity.title, organization: opportunity.organization, type: opportunity.type, category: opportunity.category,
    officialSource: opportunity.official_source, icon: opportunity.icon, href: `/opportunities/${encodeURIComponent(opportunity.id)}`,
    state: currentState, eligibility: currentEligibility, lifecycleLabel: lifecycle.label, deadlineLabel: deadlineLabel(opportunity), factualLabel: definition.factualLabel, highValue: highValue(opportunity),
  }));
}

const groupLabels: Record<OpportunityCollectionDefinition["archetype"], string> = { situation: "By student situation", goal: "By field or goal", experience: "By experience", timing: "By timing", discovery: "For discovery" };

export function buildCollectionsLanding(input: { account: AccountData; opportunities: readonly Opportunity[]; pro: boolean; now?: Date }): CollectionsLandingModel {
  const index = buildOpportunityCollectionIndex(input.opportunities, input.now);
  const launched = opportunityCollections.flatMap((definition) => {
    const coverage = index.coverage.get(definition.id)!;
    return coverage.readiness === "launched" ? [summary(definition, coverage, input.account)] : [];
  }).sort((left, right) => Number(right.profileRelated) - Number(left.profileRelated) || right.highValue - left.highValue || left.title.localeCompare(right.title));
  const featured = launched.slice(0, input.pro ? 5 : 4);
  return {
    featured,
    groups: (["situation", "goal", "experience", "timing", "discovery"] as const).flatMap((id) => {
      const collections = launched.filter((collection) => collection.archetype === id);
      return collections.length ? [{ id, label: groupLabels[id], collections }] : [];
    }),
    launched,
    pro: input.pro,
  };
}

export function buildCollectionDetail(input: { collection: OpportunityCollectionDefinition; account: AccountData; opportunities: readonly Opportunity[]; pro: boolean; now?: Date }): CollectionDetailModel | null {
  const now = input.now ?? new Date();
  const index = buildOpportunityCollectionIndex(input.opportunities, now);
  const coverage = index.coverage.get(input.collection.id)!;
  if (coverage.readiness !== "launched") return null;
  const ranked = rankAndDiversify(index.members.get(input.collection.id) ?? [], input.collection, input.account, contextFor(input.account), now);
  const allSummaries = opportunityCollections.flatMap((definition) => {
    const candidateCoverage = index.coverage.get(definition.id)!;
    return candidateCoverage.readiness === "launched" ? [summary(definition, candidateCoverage, input.account)] : [];
  });
  const startCount = input.pro ? 5 : 4;
  return {
    ...summary(input.collection, coverage, input.account),
    factualLabel: input.collection.factualLabel,
    startHere: ranked.slice(0, startCount),
    more: ranked.slice(startCount, startCount + (input.pro ? 8 : 6)),
    discoverHref: input.collection.discoverHref,
    explorer: input.collection.explorerAreaId ? { title: "Explore the wider landscape", href: `/explore/${input.collection.explorerAreaId}` } : null,
    path: input.collection.pathId ? { title: "View the related Opportunity Path", href: `/paths/${input.collection.pathId}` } : null,
    related: allSummaries.filter((collection) => collection.id !== input.collection.id && collection.archetype !== input.collection.archetype).sort((left, right) => Number(right.profileRelated) - Number(left.profileRelated) || right.safe - left.safe).slice(0, input.pro ? 4 : 3),
    pro: input.pro,
  };
}

export function opportunityCollectionCoverage(source: readonly Opportunity[], now = new Date()) {
  const index = buildOpportunityCollectionIndex(source, now);
  return opportunityCollections.map((definition) => index.coverage.get(definition.id)!);
}

export { opportunityCollectionById };
