import { canonicalOpportunity, dataQualityScore } from "./opportunity-enrichment";
import { opportunityEligibilityDataConfidence, opportunityVerificationConfidence } from "./opportunity-confidence";
import { normalizeOpportunityEligibility } from "./opportunity-eligibility-model";
import { getOpportunityIntelligence } from "./opportunity-intelligence";
import { auditOpportunity } from "./opportunity-quality";
import type { Opportunity } from "./opportunities";

export const opportunityPlatformVersion = "opportunity-intelligence-platform-v1";

export type OpportunityConfidenceTier = "high_confidence" | "partially_verified" | "needs_review" | "excluded";
export type OpportunityFreshnessState = "current" | "review_due" | "stale" | "expired" | "temporarily_closed" | "broken" | "archived";

export type ConfidenceFactor = {
  score: number;
  evidence: string[];
};

export type OpportunityBehaviorSignal = {
  shown: number;
  opened: number;
  saved: number;
  applied: number;
  dismissed: number;
  accepted: number;
};

export type OpportunityConfidenceAssessment = {
  sourceReliability: ConfidenceFactor;
  lastVerified: ConfidenceFactor;
  deadline: ConfidenceFactor;
  eligibility: ConfidenceFactor;
  completeness: ConfidenceFactor;
  duplicate: ConfidenceFactor;
  metadata: ConfidenceFactor;
  organization: ConfidenceFactor;
  overall: number;
  tier: OpportunityConfidenceTier;
};

export type OpportunityQualityAssessment = {
  prestige: number;
  careerValue: number;
  popularity: number;
  salaryPotential: number;
  scholarshipValue: number;
  resumeValue: number;
  networkingValue: number;
  selectivity: number;
  uniqueness: number;
  overall: number;
};

export type OpportunityFreshnessAssessment = {
  state: OpportunityFreshnessState;
  ageDays: number | null;
  deadlineDays: number | null;
  rankable: boolean;
  reviewReasons: string[];
  nextReviewAt: string | null;
};

export type OpportunityDuplicateAssessment = {
  canonicalId: string;
  duplicateOf: string | null;
  similarity: number;
  reasons: string[];
};

export type OpportunityEnrichmentAssessment = {
  organizationDomain: string | null;
  organizationDescription: string | null;
  logo: string | null;
  category: string;
  subcategory: string;
  industry: string[];
  careerPaths: string[];
  relatedSkills: string[];
  estimatedApplicationEffort: string;
  timeCommitment: string | null;
  benefitType: string | null;
  missingFields: string[];
};

export type OpportunityCatalogProfile = {
  opportunityId: string;
  confidence: OpportunityConfidenceAssessment;
  eligibility: ReturnType<typeof normalizeOpportunityEligibility>;
  quality: OpportunityQualityAssessment;
  freshness: OpportunityFreshnessAssessment;
  duplicate: OpportunityDuplicateAssessment;
  enrichment: OpportunityEnrichmentAssessment;
  recommendationEligible: boolean;
  recommendationGateReasons: string[];
};

export type OpportunityDuplicateGroup = {
  canonicalId: string;
  ids: string[];
  similarity: number;
  reasons: string[];
};

export type OpportunityCatalogIndex = {
  version: typeof opportunityPlatformVersion;
  generatedAt: string;
  profiles: ReadonlyMap<string, OpportunityCatalogProfile>;
  duplicateGroups: OpportunityDuplicateGroup[];
};

export type OpportunityProfileBuildOptions = {
  now?: Date;
  behavior?: OpportunityBehaviorSignal;
  duplicate?: OpportunityDuplicateAssessment;
};

const dayMs = 86_400_000;
const excludedStatuses = new Set(["expired", "archived", "broken_source", "incomplete"]);
const normalize = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
const unique = <T,>(values: T[]) => [...new Set(values.filter(Boolean))];
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function dateValue(value: string | null | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function daysBetween(timestamp: number | null, now: Date) {
  return timestamp === null ? null : Math.floor((now.getTime() - timestamp) / dayMs);
}

function nextReviewDate(item: Opportunity, ageDays: number | null) {
  const verifiedAt = dateValue(item.last_verified);
  if (verifiedAt === null || ageDays === null) return null;
  const interval = item.metadata.deadlineType === "fixed" ? 60 : 120;
  return new Date(verifiedAt + interval * dayMs).toISOString().slice(0, 10);
}

export function assessOpportunityFreshness(item: Opportunity, now = new Date()): OpportunityFreshnessAssessment {
  const verifiedAge = daysBetween(dateValue(item.last_verified), now);
  const deadlineDays = item.application_deadline ? -daysBetween(dateValue(item.application_deadline, true), now)! : null;
  const reviewReasons: string[] = [];
  let state: OpportunityFreshnessState = "current";
  if (item.verification_status === "archived") state = "archived";
  else if (item.verification_status === "broken_source" || item.metadata.verification?.sourceReachable === false) state = "broken";
  else if (item.verification_status === "expired" || deadlineDays !== null && deadlineDays < 0) state = "expired";
  else if (item.verification_status === "temporarily_closed" || item.metadata.deadlineType === "current_cycle_closed") state = "temporarily_closed";
  else if (verifiedAge === null || verifiedAge > 180) state = "stale";
  else if (verifiedAge > 120) state = "review_due";
  if (state === "expired") reviewReasons.push("Application deadline has passed.");
  if (state === "temporarily_closed") reviewReasons.push("The current application cycle is closed.");
  if (state === "broken") reviewReasons.push("The official source is unavailable or marked broken.");
  if (state === "archived") reviewReasons.push("The record is archived.");
  if (state === "stale") reviewReasons.push("Verification is more than 180 days old.");
  if (state === "review_due") reviewReasons.push("Verification review is due.");
  if (item.metadata.deadlineType === "unknown") reviewReasons.push("Deadline is not documented.");
  if (item.metadata.verification?.deadlineVerified === false) reviewReasons.push("Deadline has not been verified.");
  return {
    state,
    ageDays: verifiedAge,
    deadlineDays,
    rankable: state === "current" || state === "review_due",
    reviewReasons: unique(reviewReasons),
    nextReviewAt: nextReviewDate(item, verifiedAge),
  };
}

function titleTokens(item: Opportunity) {
  const organizationTokens = new Set(normalize(item.organization).split(" "));
  const generic = new Set(["official", "opportunity", "opportunities", "program", "programs", "resource", "resources", "student", "students"]);
  return new Set(normalize(item.title).split(" ").filter((token) => token.length > 2 && !organizationTokens.has(token) && !generic.has(token)));
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${path || "/"}`;
  } catch {
    return "";
  }
}

function programIdentifier(item: Opportunity) {
  const legacy = item.metadata.legacySlug?.trim();
  if (legacy) return normalize(`${item.organization}:${legacy}`);
  const source = normalizedUrl(item.official_source_url);
  return source.endsWith("/") ? "" : source;
}

function duplicatePair(left: Opportunity, right: Opportunity) {
  const leftCanonical = canonicalOpportunity(left);
  const rightCanonical = canonicalOpportunity(right);
  const titleSimilarity = jaccard(titleTokens(left), titleTokens(right));
  const sameOrganization = leftCanonical.normalizedOrganization === rightCanonical.normalizedOrganization;
  const sameProgram = Boolean(programIdentifier(left) && programIdentifier(left) === programIdentifier(right));
  const sameUrl = Boolean(programIdentifier(left) && normalizedUrl(left.official_source_url) === normalizedUrl(right.official_source_url));
  const compatibleDeadline = left.application_deadline === right.application_deadline
    || !left.application_deadline
    || !right.application_deadline;
  const reasons = unique([
    sameOrganization ? "same organization" : "",
    titleSimilarity >= 0.72 ? "high title similarity" : "",
    sameProgram ? "same program identifier" : "",
    sameUrl ? "same official source" : "",
    compatibleDeadline ? "compatible deadline" : "",
  ]);
  const duplicate = compatibleDeadline && (
    sameOrganization && titleSimilarity >= 0.82
    || sameProgram && titleSimilarity >= 0.5
    || sameUrl && titleSimilarity >= 0.5
  );
  const similarity = clamp(titleSimilarity * 65 + (sameOrganization ? 15 : 0) + (sameProgram ? 12 : 0) + (sameUrl ? 8 : 0));
  return { duplicate, similarity, reasons };
}

function canonicalPreference(item: Opportunity) {
  const specificity = (() => {
    try { return new URL(item.official_source_url).pathname.split("/").filter(Boolean).length; } catch { return 0; }
  })();
  return (item.verification_status === "verified" ? 1_000 : 0)
    + dataQualityScore(item) * 5
    + specificity * 8
    + (dateValue(item.last_verified) ?? 0) / dayMs / 10_000;
}

export function detectOpportunityDuplicateGroups(items: readonly Opportunity[]): OpportunityDuplicateGroup[] {
  const candidates = new Map<string, Opportunity[]>();
  const add = (key: string, item: Opportunity) => { if (key) candidates.set(key, [...(candidates.get(key) ?? []), item]); };
  for (const item of items) {
    const canonical = canonicalOpportunity(item);
    add(`org:${canonical.normalizedOrganization}`, item);
    const identifier = programIdentifier(item);
    if (identifier) add(`program:${identifier}`, item);
  }
  const edges = new Map<string, Map<string, { similarity: number; reasons: string[] }>>();
  const seen = new Set<string>();
  for (const group of candidates.values()) {
    if (group.length < 2) continue;
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        const pairKey = [left.id, right.id].sort().join("|");
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const assessment = duplicatePair(left, right);
        if (!assessment.duplicate) continue;
        if (!edges.has(left.id)) edges.set(left.id, new Map());
        if (!edges.has(right.id)) edges.set(right.id, new Map());
        edges.get(left.id)!.set(right.id, assessment);
        edges.get(right.id)!.set(left.id, assessment);
      }
    }
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const visited = new Set<string>();
  const results: OpportunityDuplicateGroup[] = [];
  for (const id of edges.keys()) {
    if (visited.has(id)) continue;
    const stack = [id];
    const ids: string[] = [];
    const reasons: string[] = [];
    let similarity = 100;
    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      ids.push(current);
      for (const [related, edge] of edges.get(current) ?? []) {
        similarity = Math.min(similarity, edge.similarity);
        reasons.push(...edge.reasons);
        if (!visited.has(related)) stack.push(related);
      }
    }
    const canonicalId = ids
      .map((entry) => byId.get(entry)!)
      .sort((left, right) => canonicalPreference(right) - canonicalPreference(left) || left.id.localeCompare(right.id))[0].id;
    results.push({ canonicalId, ids: ids.sort(), similarity, reasons: unique(reasons) });
  }
  return results.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
}

function sourceReliability(item: Opportunity): ConfidenceFactor {
  let score = 0;
  const evidence: string[] = [];
  try {
    const source = new URL(item.official_source_url);
    score += 35;
    evidence.push("Official source uses HTTPS.");
    if (source.pathname !== "/") { score += 10; evidence.push("Source points to a program-specific path."); }
  } catch {
    return { score: 0, evidence: ["Official source URL is invalid."] };
  }
  if (item.verification_status === "verified") { score += 35; evidence.push("Record is verified."); }
  if (item.metadata.verification?.sourceReachable === true) { score += 10; evidence.push("Source was reachable during verification."); }
  if (item.metadata.verification?.applicationUrlVerified === true) { score += 10; evidence.push("Application URL was verified."); }
  if (item.metadata.verification?.sourceReachable === false) return { score: 0, evidence: ["Source was marked unreachable."] };
  return { score: clamp(score), evidence };
}

function deadlineConfidence(item: Opportunity, freshness: OpportunityFreshnessAssessment): ConfidenceFactor {
  const type = item.metadata.deadlineType;
  if (freshness.state === "expired") return { score: 0, evidence: ["Published deadline has passed."] };
  if (type === "current_cycle_closed") return { score: 20, evidence: ["Current cycle is closed."] };
  if (type === "fixed" && item.application_deadline && item.metadata.verification?.deadlineVerified === true) return { score: 100, evidence: ["Exact deadline was verified."] };
  if (["rolling", "varies", "no_deadline"].includes(type ?? "") && item.metadata.verification?.deadlineVerified !== false) return { score: 88, evidence: [`Deadline is documented as ${type?.replaceAll("_", " ")}.`] };
  if (type === "not_announced") return { score: 62, evidence: ["Next deadline has not been announced."] };
  return { score: 25, evidence: ["Deadline needs verification."] };
}

function organizationConfidence(item: Opportunity): ConfidenceFactor {
  const canonical = canonicalOpportunity(item);
  let score = item.organization.trim().length >= 3 ? 50 : 0;
  const evidence = score ? ["Organization name is present."] : [];
  if (canonical.organizationDomain) { score += 30; evidence.push("Organization domain is known."); }
  if (canonical.logo) { score += 20; evidence.push("Organization identity has a registered logo."); }
  return { score: clamp(score), evidence };
}

function confidenceAssessment(
  item: Opportunity,
  freshness: OpportunityFreshnessAssessment,
  duplicate: OpportunityDuplicateAssessment,
): OpportunityConfidenceAssessment {
  const quality = auditOpportunity(item);
  const eligibilityScore = opportunityEligibilityDataConfidence(item);
  const verificationScore = opportunityVerificationConfidence(item);
  const factors = {
    sourceReliability: sourceReliability(item),
    lastVerified: { score: verificationScore, evidence: [freshness.ageDays === null ? "Verification date is invalid." : `Verified ${freshness.ageDays} days ago.`] },
    deadline: deadlineConfidence(item, freshness),
    eligibility: { score: eligibilityScore, evidence: normalizeOpportunityEligibility(item).evidence.slice(0, 3) },
    completeness: { score: quality.completenessScore, evidence: quality.missingFields.length ? quality.missingFields.map((field) => `Missing ${field}.`) : ["Required content fields are complete."] },
    duplicate: { score: duplicate.duplicateOf ? Math.max(0, 100 - duplicate.similarity) : 100, evidence: duplicate.duplicateOf ? [`Potential duplicate of ${duplicate.duplicateOf}.`] : ["No duplicate candidate detected."] },
    metadata: { score: dataQualityScore(item), evidence: ["Score is based on structured catalog completeness."] },
    organization: organizationConfidence(item),
  } satisfies Omit<OpportunityConfidenceAssessment, "overall" | "tier">;
  const scores = Object.values(factors).map((factor) => factor.score);
  const overall = clamp(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  const excluded = excludedStatuses.has(item.verification_status) || !freshness.rankable || Boolean(duplicate.duplicateOf);
  const tier: OpportunityConfidenceTier = excluded
    ? "excluded"
    : item.verification_status === "verified"
        && factors.eligibility.score >= 78
        && factors.lastVerified.score >= 78
        && factors.sourceReliability.score >= 70
        && factors.completeness.score >= 80
      ? "high_confidence"
      : factors.sourceReliability.score >= 55 && overall >= 50
        ? "partially_verified"
        : "needs_review";
  return { ...factors, overall, tier };
}

function behaviorPopularity(signal: OpportunityBehaviorSignal | undefined) {
  if (!signal || signal.shown <= 0) return 0;
  const engagement = (signal.opened * 1.5 + signal.saved * 3 + signal.applied * 5 + signal.accepted * 7 - signal.dismissed * 2) / signal.shown;
  return clamp(engagement * 18);
}

function qualityAssessment(item: Opportunity, behavior: OpportunityBehaviorSignal | undefined, duplicate: OpportunityDuplicateAssessment) {
  const intelligence = getOpportunityIntelligence(item);
  const prestige = item.prestige === "Very High" ? 100 : item.prestige === "High" ? 82 : item.prestige === "Established" ? 65 : 35;
  const careerValue = clamp(intelligence.impactScore + (item.paid === true ? 18 : 0) + (intelligence.requiredSkills.length ? 14 : 0));
  const popularity = behaviorPopularity(behavior);
  const salaryPotential = item.metadata.salaryEstimate ? 90 : item.paid === true ? 65 : item.paid === false ? 10 : 30;
  const scholarshipValue = item.type !== "Scholarship" ? 0 : item.estimated_value === null ? 35 : clamp(35 + Math.log10(Math.max(1, item.estimated_value)) * 14);
  const resumeValue = clamp(prestige * 0.45 + careerValue * 0.45 + (item.type === "Career" || item.type === "Research" ? 10 : 0));
  const networkingValue = ["Conferences", "Leadership Programs", "Fellowships", "Internships"].includes(item.category) ? 82 : item.metadata.careerPaths?.length ? 58 : 30;
  const selectivity = item.difficulty === "Highly Competitive" ? 95 : item.difficulty === "Competitive" ? 75 : item.difficulty === "Open" ? 35 : 50;
  const uniqueness = duplicate.duplicateOf ? 0 : item.hidden_gem ? 95 : 65;
  const weighted = careerValue * 0.2 + resumeValue * 0.16 + prestige * 0.12 + popularity * 0.1 + salaryPotential * 0.1 + scholarshipValue * 0.08 + networkingValue * 0.1 + selectivity * 0.06 + uniqueness * 0.08;
  return { prestige, careerValue, popularity, salaryPotential, scholarshipValue, resumeValue, networkingValue, selectivity, uniqueness, overall: clamp(weighted) } satisfies OpportunityQualityAssessment;
}

function enrichmentAssessment(item: Opportunity): OpportunityEnrichmentAssessment {
  const canonical = canonicalOpportunity(item);
  const intelligence = getOpportunityIntelligence(item);
  const missingFields = unique([
    "organization_description",
    canonical.logo ? "" : "organization_logo",
    canonical.organizationDomain ? "" : "organization_domain",
    item.metadata.careerPaths?.length || canonical.careerFields.length ? "" : "career_paths",
    item.metadata.skillsGained?.length || intelligence.requiredSkills.length ? "" : "related_skills",
    item.metadata.estimatedApplicationTime ? "" : "verified_application_effort",
    item.metadata.internshipDuration || item.metadata.semesters?.length ? "" : "time_commitment",
  ]);
  return {
    organizationDomain: canonical.organizationDomain,
    organizationDescription: null,
    logo: canonical.logo,
    category: canonical.category,
    subcategory: canonical.subcategory,
    industry: canonical.careerFields,
    careerPaths: intelligence.careerPaths,
    relatedSkills: intelligence.requiredSkills,
    estimatedApplicationEffort: intelligence.estimatedApplicationTime,
    timeCommitment: item.metadata.internshipDuration ?? item.metadata.semesters?.join(", ") ?? null,
    benefitType: item.type === "Benefit" ? item.metadata.offerType ?? item.category : null,
    missingFields,
  };
}

export function buildOpportunityCatalogIndex(
  items: readonly Opportunity[],
  options: { now?: Date; behavior?: ReadonlyMap<string, OpportunityBehaviorSignal> } = {},
): OpportunityCatalogIndex {
  const now = options.now ?? new Date();
  const duplicateGroups = detectOpportunityDuplicateGroups(items);
  const duplicateById = new Map<string, OpportunityDuplicateAssessment>();
  for (const group of duplicateGroups) for (const id of group.ids) duplicateById.set(id, {
    canonicalId: group.canonicalId,
    duplicateOf: id === group.canonicalId ? null : group.canonicalId,
    similarity: group.similarity,
    reasons: group.reasons,
  });
  const profiles = new Map<string, OpportunityCatalogProfile>();
  for (const item of items) {
    const duplicate = duplicateById.get(item.id) ?? { canonicalId: item.id, duplicateOf: null, similarity: 0, reasons: [] };
    profiles.set(item.id, buildOpportunityCatalogProfile(item, { now, behavior: options.behavior?.get(item.id), duplicate }));
  }
  return { version: opportunityPlatformVersion, generatedAt: now.toISOString(), profiles, duplicateGroups };
}

export function buildOpportunityCatalogProfile(item: Opportunity, options: OpportunityProfileBuildOptions = {}): OpportunityCatalogProfile {
  const now = options.now ?? new Date();
  const duplicate = options.duplicate ?? { canonicalId: item.id, duplicateOf: null, similarity: 0, reasons: [] };
  const freshness = assessOpportunityFreshness(item, now);
  const confidence = confidenceAssessment(item, freshness, duplicate);
  const eligibility = normalizeOpportunityEligibility(item);
  const recommendationGateReasons = unique([
    confidence.tier !== "high_confidence" ? `Confidence tier is ${confidence.tier.replaceAll("_", " ")}.` : "",
    eligibility.recommendationEligibilityStatus !== "eligible_for_ranking" ? `Eligibility status is ${eligibility.recommendationEligibilityStatus.replaceAll("_", " ")}.` : "",
    ...eligibility.criticalUnknowns.map((field) => `Eligibility requires review: ${field.replaceAll("_", " ")}.`),
    ...freshness.reviewReasons.filter(() => !freshness.rankable),
    duplicate.duplicateOf ? `Duplicate of ${duplicate.duplicateOf}.` : "",
  ]);
  return {
    opportunityId: item.id,
    confidence,
    eligibility,
    quality: qualityAssessment(item, options.behavior, duplicate),
    freshness,
    duplicate,
    enrichment: enrichmentAssessment(item),
    recommendationEligible: recommendationGateReasons.length === 0,
    recommendationGateReasons,
  };
}

export function refreshOpportunityCatalogProfile(
  index: OpportunityCatalogIndex,
  item: Opportunity,
  options: OpportunityProfileBuildOptions = {},
): OpportunityCatalogIndex {
  const profiles = new Map(index.profiles);
  profiles.set(item.id, buildOpportunityCatalogProfile(item, options));
  return { ...index, generatedAt: (options.now ?? new Date()).toISOString(), profiles };
}

export function mergeDuplicateOpportunityMetadata(group: readonly Opportunity[]) {
  if (!group.length) return null;
  const canonical = [...group].sort((left, right) => canonicalPreference(right) - canonicalPreference(left) || left.id.localeCompare(right.id))[0];
  return {
    canonicalId: canonical.id,
    sourceIds: group.map((item) => item.id).sort(),
    majors: unique(group.flatMap((item) => item.majors)),
    academicYears: unique(group.flatMap((item) => item.academic_years)),
    tags: unique(group.flatMap((item) => item.tags)),
    careerPaths: unique(group.flatMap((item) => item.metadata.careerPaths ?? [])),
    skills: unique(group.flatMap((item) => item.metadata.skillsGained ?? [])),
    officialSources: unique(group.map((item) => item.official_source_url)),
  };
}
