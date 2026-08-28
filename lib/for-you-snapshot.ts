import "server-only";
import crypto from "node:crypto";
import { buildRecommendationService } from "@/data/recommendation-service";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { buildOpportunityStudentContext, buildRecommendationCandidateFunnel } from "@/data/recommendation-engine";
import { auditFinalOpportunityRecommendation, evaluateProfessionalRecommendationCandidate } from "@/data/recommendation-professional-pipeline";
import { eligibilitySchemaVersion } from "@/data/opportunity-eligibility-model";
import { recommendationRulesVersion } from "@/data/recommendation-config";
import { opportunities, type Opportunity } from "@/data/opportunities";
import { schoolDirectory as schools, type School } from "@/data/school-directory";
import { inferApplicationsFromActivity } from "@/data/student-progress";
import type { StudentActivity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountData, AuthUser } from "@/lib/account-types";
import { mergeAccountData } from "@/lib/auth-store";
import { getEntitlementsForBilling, type Entitlements } from "@/lib/billing";
import type { AdvisorAccessState } from "@/lib/advisor-access";
import { nextAdvisorData } from "@/lib/advisor/api";
import type { ForYouRecommendationSnapshot, ForYouSnapshotState } from "@/lib/advisor/types";
import { activeRecommendationFeedback } from "@/lib/advisor/feedback";
import { listPublishedOpportunities } from "@/lib/content-store";
import { buildForYouBriefing } from "@/lib/for-you-briefing";

export const forYouSnapshotEngineVersion = "for-you-snapshot-v10-decision-intelligence";
export const forYouSnapshotTtlMs = 1000 * 60 * 60 * 6;
const generationTimeoutMs = 2800;
const globalIndexTimeoutMs = 1000;
export const forYouCatalogVersion = crypto.createHash("sha256").update(JSON.stringify(opportunities.map((item) => [
  item.id,
  item.school_scope,
  [...item.schools].sort(),
  [...item.majors].sort(),
  [...item.academic_years].sort(),
  item.eligibility,
  item.application_deadline,
  item.metadata.deadlineType,
  item.metadata.eligibilityRules ?? null,
  item.verification_status,
  item.last_verified,
  item.date_added,
  item.prestige,
  item.featured,
  item.hidden_gem,
  item.paid,
  item.metadata.applicationSeason ?? null,
  item.metadata.semesters ?? [],
]))).digest("hex").slice(0, 20);
const sourceSignalsVersion = `opportunities:${opportunities.length}:${forYouCatalogVersion}`;
const generationByUser = new Map<string, Promise<ForYouRecommendationSnapshot>>();

export type ForYouServerState = {
  pageState: "pro_ready" | "free_preview" | "profile_incomplete" | "empty" | "preparing" | "error";
  access: AdvisorAccessState;
  entitlements: Entitlements | null;
  profile: StudentProfile | null;
  school: School | null;
  activity: StudentActivity;
  session: null;
  recommendations: ForYouRecommendationSnapshot["recommendations"];
  briefing: ForYouRecommendationSnapshot["briefing"] | null;
  totalMatches: number;
  snapshotStatus: ForYouSnapshotState;
  isRefreshing: boolean;
  errorCode?: "not_authenticated" | "profile_incomplete" | "snapshot_generation_pending" | "snapshot_generation_failed" | "session_store_unavailable" | "unexpected";
};

type ForYouGlobalIndex = { opportunityCount: number; opportunityById: Map<string, Opportunity>; source: Opportunity[]; expiresAt: number };
let globalIndex: ForYouGlobalIndex | null = null;
let globalIndexPromise: Promise<ForYouGlobalIndex> | null = null;

function timeoutError(label: string, ms: number) {
  const error = new Error(`${label} timed out after ${ms}ms`);
  error.name = "TimeoutError";
  return error;
}

function withTimeout<T>(promise: Promise<T>, label: string, ms: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(timeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

export function getForYouGlobalIndexStatus() {
  if (globalIndex) return "ready";
  if (globalIndexPromise) return "initializing";
  return "uninitialized";
}

export async function getForYouGlobalIndex() {
  if (globalIndex && globalIndex.expiresAt > Date.now()) return globalIndex;
  if (!globalIndexPromise) {
    globalIndexPromise = listPublishedOpportunities().then((source) => {
      const built = {
        opportunityCount: source.length,
        opportunityById: new Map(source.map((opportunity) => [opportunity.id, opportunity])),
        source,
        expiresAt: Date.now() + 60_000,
      };
      globalIndex = built;
      return built;
    }).catch((error) => {
      globalIndexPromise = null;
      throw error;
    });
  }
  const built = await globalIndexPromise;
  if (globalIndex) globalIndexPromise = null;
  return built;
}

function stableHash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

function emptyActivity(): StudentActivity {
  return { viewed: [], saved: [], claimed: [], tracked: {} };
}

function recommendationActivity(data: AccountData): StudentActivity {
  const activity = data.activity ?? emptyActivity();
  if (data.preferences?.useActivityForRecommendations !== false) return activity;
  return { ...activity, viewed: [], claimed: [] };
}

function recommendationFeedback(data: AccountData) {
  return data.preferences?.useActivityForRecommendations === false
    ? []
    : activeRecommendationFeedback(data.advisor?.feedbackRecords ?? []);
}

function profileForRecommendations(profile: StudentProfile, data: AccountData): StudentProfile {
  const explicit = data.preferences?.preferredTypes ?? [];
  if (!explicit.length) return profile;
  return {
    ...profile,
    preferredOpportunityTypes: [...new Set([...(profile.preferredOpportunityTypes ?? []), ...explicit])],
  };
}

export function forYouProfileVersion(profile: StudentProfile, data: AccountData) {
  const activity = recommendationActivity(data);
  const tracked = Object.values(activity.tracked ?? {}).map((item) => [item.id, item.status, item.updatedAt]).sort();
  const feedback = recommendationFeedback(data).map((item) => [item.recommendationId, item.feedbackType, item.createdAt]).sort();
  return stableHash({
    profile: {
      firstName: profile.firstName,
      schoolSlug: profile.schoolSlug,
      major: profile.major,
      secondaryMajor: profile.secondaryMajor,
      minor: profile.minor,
      gpaStatus: profile.gpaStatus,
      graduationYear: profile.graduationYear,
      year: profile.year,
      careerGoal: profile.careerGoal,
      interests: profile.interests,
      preferredOpportunityTypes: [...(profile.preferredOpportunityTypes ?? [])].sort(),
      opportunityTypeInterests: [...(profile.opportunityTypeInterests ?? [])].sort(),
      fieldInterests: [...(profile.fieldInterests ?? [])].sort(),
      specificCareerInterests: [...(profile.specificCareerInterests ?? [])].sort(),
      locationFormats: [...(profile.locationFormats ?? [])].sort(),
      compensationPreference: profile.compensationPreference,
      timeCommitments: [...(profile.timeCommitments ?? [])].sort(),
      advisorInterview: profile.advisorInterview,
      institutionType: profile.institutionType,
      enrollmentStatus: profile.enrollmentStatus,
      degreeLevel: profile.degreeLevel,
      citizenshipStatus: profile.citizenshipStatus,
      workAuthorization: profile.workAuthorization,
      residency: profile.residency,
      age: profile.age,
      transferStatus: profile.transferStatus,
      financialNeedStatus: profile.financialNeedStatus,
      meritStatus: profile.meritStatus,
      eligibilityAttributes: [...(profile.eligibilityAttributes ?? [])].sort(),
    },
    tracked,
    saved: [...(activity.saved ?? [])].sort(),
    viewed: [...(activity.viewed ?? [])].slice(-50),
    preferredTypes: [...(data.preferences?.preferredTypes ?? [])].sort(),
    hidden: data.preferences?.useActivityForRecommendations === false ? [] : [...(data.preferences?.hiddenDismissedIds ?? [])].sort(),
    useActivityForRecommendations: data.preferences?.useActivityForRecommendations !== false,
    feedback,
    watched: (data.watchedOpportunities ?? []).map((item) => [item.opportunityId, item.updatedAt, item.version]).sort(),
    billing: { tier: data.billing.tier, status: data.billing.status },
    sourceSignalsVersion,
  });
}

function latestSnapshot(data: AccountData, userId: string) {
  const snapshots = data.advisor?.forYouSnapshots ?? [];
  return snapshots.filter((snapshot) => snapshot.userId === userId).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0] ?? null;
}

function priorCompatibleSnapshot(data: AccountData, userId: string) {
  return (data.advisor?.forYouSnapshots ?? [])
    .filter((snapshot) => snapshot.userId === userId)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0] ?? null;
}

function previousFeedContext(data: AccountData, userId: string, now: Date) {
  const snapshots = (data.advisor?.forYouSnapshots ?? [])
    .filter((snapshot) => snapshot.userId === userId)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    .slice(0, 3);
  const exposureCounts: Record<string, number> = {};
  for (const snapshot of snapshots) {
    for (const view of snapshot.recommendations) {
      const id = view.recommendation.relatedOpportunityId;
      if (id) exposureCounts[id] = (exposureCounts[id] ?? 0) + 1;
    }
  }
  return {
    exposureCounts,
    previousTopOpportunityIds: snapshots[0]?.recommendations.slice(0, 2).map((view) => view.recommendation.relatedOpportunityId).filter((id): id is string => Boolean(id)) ?? [],
    feedRotationKey: now.toISOString().slice(0, 10),
  };
}

export function isForYouSnapshotCompatible(snapshot: ForYouRecommendationSnapshot, version: string, userId: string) {
  return snapshot.userId === userId
    && snapshot.profileVersion === version
    && snapshot.engineVersion === forYouSnapshotEngineVersion
    && snapshot.eligibilitySchemaVersion === eligibilitySchemaVersion
    && snapshot.catalogVersion === forYouCatalogVersion
    && snapshot.recommendationRulesVersion === recommendationRulesVersion
    && snapshot.sourceSignalsVersion === sourceSignalsVersion
    && Number.isFinite(new Date(snapshot.generatedAt).getTime());
}

function isFresh(snapshot: ForYouRecommendationSnapshot) {
  return new Date(snapshot.expiresAt).getTime() > Date.now();
}

function snapshotPassesSafetyAudit(snapshot: ForYouRecommendationSnapshot, profile: StudentProfile, school: School, activity: StudentActivity, data: AccountData) {
  const progress = inferApplicationsFromActivity(activity, opportunities, { milestones: {}, applications: {} });
  const advisorProfile = createAdvisorProfile({ profile: profileForRecommendations(profile, data), school, activity, progress });
  advisorProfile.future.recommendationFeedback = recommendationFeedback(data);
  advisorProfile.future.hiddenOpportunityIds = data.preferences?.useActivityForRecommendations === false ? [] : data.preferences?.hiddenDismissedIds ?? [];
  const context = buildOpportunityStudentContext(advisorProfile);
  return snapshot.recommendations.every((view) => {
    const id = view.recommendation.relatedOpportunityId;
    const opportunity = id ? globalIndex?.opportunityById.get(id) ?? opportunities.find((item) => item.id === id) : null;
    return Boolean(opportunity
      && view.opportunity?.id === opportunity.id
      && evaluateProfessionalRecommendationCandidate(opportunity, context).allowed
      && auditFinalOpportunityRecommendation(view.recommendation, opportunity, context).approved);
  });
}

async function persistSnapshot(userId: string, data: AccountData, snapshot: ForYouRecommendationSnapshot) {
  const advisor = nextAdvisorData(data, { forYouSnapshots: [snapshot] });
  await mergeAccountData(userId, { advisor });
}

async function generateSnapshot(user: AuthUser, data: AccountData, profile: StudentProfile, school: School, entitlements: Entitlements) {
  const index = await withTimeout(getForYouGlobalIndex(), "global recommendation index", globalIndexTimeoutMs);
  const source = index.source;
  const now = new Date();
  const priorFeed = previousFeedContext(data, user.id, now);
  const activeFeedback = recommendationFeedback(data);
  const activity = recommendationActivity(data);
  const progress = inferApplicationsFromActivity(activity, source, { milestones: {}, applications: {} });
  const service = buildRecommendationService({
    profile: profileForRecommendations(profile, data),
    school,
    activity,
    progress,
    source,
    feedbackRecords: activeFeedback,
    hiddenOpportunityIds: data.preferences?.useActivityForRecommendations === false ? [] : data.preferences?.hiddenDismissedIds ?? [],
    dismissedOpportunityIds: activeFeedback.filter((record) => ["dismissed", "not-interested", "show-fewer", "not-eligible", "already-applied", "already-completed", "completed"].includes(record.feedbackType)).map((record) => record.recommendationId.replace("recommendation-opportunity-", "")),
    referralActivity: data.referrals,
    recommendationExposureCounts: priorFeed.exposureCounts,
    previousTopOpportunityIds: priorFeed.previousTopOpportunityIds,
    feedRotationKey: priorFeed.feedRotationKey,
  });
  const pro = entitlements.canUseFullForYou;
  if (pro && service.recommendations.length === 0) {
    const funnel = buildRecommendationCandidateFunnel({ advisorProfile: service.advisorProfile, progress, opportunities: source, limit: 8 });
    const stages = [
      ["total_catalog", funnel.totalCatalog],
      ["verification", funnel.verificationEligible],
      ["education_level", funnel.educationLevelEligible],
      ["school", funnel.schoolEligible],
      ["class_year_major", funnel.classYearEligible],
      ["gpa_need", funnel.gpaEligible],
      ["citizenship_other", funnel.citizenshipEligible],
      ["status_deadline", funnel.statusDeadlineEligible],
      ["confidence", funnel.confidenceEligible],
      ["ranking", funnel.rankingEligible],
      ["final", funnel.finalRecommendations],
    ] as const;
    const lastAvailableStage = [...stages].reverse().find(([, count]) => count > 0)?.[0] ?? "none";
    console.warn("[UnlockED For You] empty feed diagnostics", {
      counts: Object.fromEntries(stages),
      lastAvailableStage,
      fallbackAttempted: funnel.fallbackAttempted,
      topRejectionReasons: funnel.topRejectionReasons,
    });
  }
  const allowed = service.recommendations.slice(0, pro ? 8 : 1);
  const briefing = pro ? buildForYouBriefing({
    recommendations: allowed,
    totalMatches: service.recommendations.length,
    profile,
    activity,
    account: data,
    opportunityById: index.opportunityById,
    priorSnapshot: priorCompatibleSnapshot(data, user.id),
    watchedOpportunityIds: (data.watchedOpportunities ?? []).map((item) => item.opportunityId),
    now,
  }) : undefined;
  const snapshot: ForYouRecommendationSnapshot = {
    userId: user.id,
    profileVersion: forYouProfileVersion(profile, data),
    engineVersion: forYouSnapshotEngineVersion,
    eligibilitySchemaVersion,
    catalogVersion: forYouCatalogVersion,
    recommendationRulesVersion,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + forYouSnapshotTtlMs).toISOString(),
    recommendations: allowed.map((view) => ({
      ...view,
      reasons: entitlements.canViewRecommendationExplanations ? view.reasons : view.reasons.slice(0, 1),
    })),
    totalMatches: service.recommendations.length,
    briefing,
    sourceSignalsVersion,
    pageState: pro ? service.recommendations.length ? "pro_ready" : "empty" : "free_preview",
  };
  await persistSnapshot(user.id, data, snapshot);
  return snapshot;
}

function generateSingleFlight(user: AuthUser, data: AccountData, profile: StudentProfile, school: School, entitlements: Entitlements) {
  const existing = generationByUser.get(user.id);
  if (existing) return existing;
  const generation = generateSnapshot(user, data, profile, school, entitlements).finally(() => {
    if (generationByUser.get(user.id) === generation) generationByUser.delete(user.id);
  });
  generationByUser.set(user.id, generation);
  return generation;
}

function stateFromSnapshot(snapshot: ForYouRecommendationSnapshot, access: AdvisorAccessState, entitlements: Entitlements, profile: StudentProfile, school: School, activity: StudentActivity, snapshotStatus: ForYouSnapshotState, isRefreshing: boolean): ForYouServerState {
  return {
    pageState: snapshot.pageState,
    access,
    entitlements,
    profile,
    school,
    activity,
    session: null,
    recommendations: snapshot.recommendations,
    briefing: snapshot.briefing ?? null,
    totalMatches: snapshot.totalMatches,
    snapshotStatus,
    isRefreshing,
  };
}

export async function resolveForYouState(user: AuthUser, data: AccountData, options: { allowGeneration?: boolean; waitForActiveGenerationMs?: number } = {}): Promise<ForYouServerState> {
  await withTimeout(getForYouGlobalIndex(), "global recommendation index", globalIndexTimeoutMs);
  const profile = data.profile;
  const school = schools.find((item) => item.slug === profile?.schoolSlug) ?? (profile?.schoolName ? {
    slug: profile.schoolSlug,
    name: profile.schoolName,
    aliases: [],
    domain: "",
    location: "",
    initials: profile.schoolName.split(/\s+/).map((part) => part[0]).join("").slice(0, 5).toUpperCase(),
    benefitSlugs: [],
  } : null);
  const activity = recommendationActivity(data);
  const entitlements = getEntitlementsForBilling(data.billing);
  const access: AdvisorAccessState = entitlements.canUseFullForYou ? "pro" : "preview";
  if (!profile || !school) {
    return { pageState: "profile_incomplete", access: "unavailable", entitlements, profile: profile ?? null, school, activity, session: null, recommendations: [], briefing: null, totalMatches: 0, snapshotStatus: "missing", isRefreshing: false, errorCode: "profile_incomplete" };
  }
  const version = forYouProfileVersion(profile, data);
  const snapshot = latestSnapshot(data, user.id);
  const compatibleSnapshot = snapshot && isForYouSnapshotCompatible(snapshot, version, user.id) && snapshotPassesSafetyAudit(snapshot, profile, school, activity, data) ? snapshot : null;
  if (compatibleSnapshot && isFresh(compatibleSnapshot)) return stateFromSnapshot(compatibleSnapshot, access, entitlements, profile, school, activity, "fresh", false);
  if (compatibleSnapshot) {
    if (!generationByUser.has(user.id)) void generateSingleFlight(user, data, profile, school, entitlements).catch((error) => console.error("[UnlockED For You] background snapshot refresh failed", { errorCategory: error instanceof Error ? error.name : "unknown" }));
    return stateFromSnapshot(compatibleSnapshot, access, entitlements, profile, school, activity, "stale", true);
  }
  const active = generationByUser.get(user.id);
  if (active) {
    try {
      const generated = await withTimeout(active, "active recommendation snapshot", options.waitForActiveGenerationMs ?? 450);
      return stateFromSnapshot(generated, access, entitlements, profile, school, activity, "fresh", false);
    } catch {
      return { pageState: "preparing", access, entitlements, profile, school, activity, session: null, recommendations: [], briefing: null, totalMatches: 0, snapshotStatus: "generating", isRefreshing: true, errorCode: "snapshot_generation_pending" };
    }
  }
  if (options.allowGeneration === false) {
    return { pageState: "preparing", access, entitlements, profile, school, activity, session: null, recommendations: [], briefing: null, totalMatches: 0, snapshotStatus: "missing", isRefreshing: true, errorCode: "snapshot_generation_pending" };
  }
  try {
    const generated = await withTimeout(generateSingleFlight(user, data, profile, school, entitlements), "initial recommendation snapshot", generationTimeoutMs);
    return stateFromSnapshot(generated, access, entitlements, profile, school, activity, "fresh", false);
  } catch (error) {
    console.error("[UnlockED For You] initial snapshot generation failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return { pageState: "preparing", access, entitlements, profile, school, activity, session: null, recommendations: [], briefing: null, totalMatches: 0, snapshotStatus: "generating", isRefreshing: true, errorCode: "snapshot_generation_pending" };
  }
}

export function forYouDiagnostics(snapshotStatus: ForYouSnapshotState, extra: Record<string, unknown> = {}) {
  return {
    snapshotStatus,
    globalIndexStatus: getForYouGlobalIndexStatus(),
    sourceSignalsVersion,
    eligibilitySchemaVersion,
    catalogVersion: forYouCatalogVersion,
    recommendationRulesVersion,
    activeGenerations: generationByUser.size,
    ...extra,
  };
}
