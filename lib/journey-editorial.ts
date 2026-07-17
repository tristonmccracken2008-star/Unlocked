import type { AccountData, AuthUser } from "@/lib/account-types";
import { isProUser } from "@/lib/billing";
import { schools } from "@/data/index";
import type { Opportunity } from "@/data/opportunities";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { rankMilestoneRecommendations, type RecommendationV1 } from "@/data/recommendation-engine";
import { getRoadmap } from "@/data/roadmap-engine";
import type { RoadmapMilestone } from "@/data/roadmap-engine";
import { inferApplicationsFromActivity, type StudentProgress } from "@/data/student-progress";
import { getJourneyTransitionActions, type JourneyTransitionAction } from "@/data/journey-transformations";
import type { OpportunityTrackerStatus } from "@/data/student-activity";
import {
  canonicalJourneyStatement,
  canonicalTransitionWaypoint,
  journeyClarityLimits,
  journeyClarityStage,
  journeyEditorialAuditVersion,
  recordSupportsEditorialAction,
} from "@/lib/journey-clarity";
import {
  buildPathprint,
  createPathGeometry,
  getOpenLineDiagnostics,
  openLineInputFromAccount,
  waypointFromRoadmap,
  type NarrativeExplanationSource,
  type NarrativeStoryType,
  type PathGeometry,
  type Pathprint,
} from "@/data/open-line/index";
import { buildPathMoments, type PathMomentCollection } from "@/lib/path-moments";
import { buildSemesterStories, type SemesterStoryCollection } from "@/lib/semester-story";

export type JourneyEditorialViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type JourneyEditorialGeometry = {
  geometry: PathGeometry;
  viewport: JourneyEditorialViewport;
  waypointPosition?: { xPercent: number; yPercent: number };
};

export type JourneyEditorialHistoryItem = {
  id: string;
  occurredAt: string | null;
  title: string;
  body: string;
  storyType: NarrativeStoryType;
  chapter: JourneyEditorialChapterKey;
  weight: "trace" | "small" | "medium" | "large" | "landmark";
  category?: string;
  detail: {
    whyItMattered: string;
    skillsGained: string[];
    whatChanged: string;
    nextConsequence: string;
    relatedOpportunity?: { id: string; title: string };
  };
};

export type JourneyEditorialChapterKey = "beginning" | "direction" | "action" | "experience" | "validation";

export type JourneyEditorialHistoryChapter = {
  id: string;
  key: JourneyEditorialChapterKey;
  title: string;
  moments: JourneyEditorialHistoryItem[];
};

export type JourneyEditorialHistory = {
  state: "empty" | "exploration" | "first_moment" | "active";
  totalMomentCount: number;
  recentChapters: JourneyEditorialHistoryChapter[];
  earlierChapters: JourneyEditorialHistoryChapter[];
  omittedMomentCount: number;
};

export type JourneyEditorialHorizonItem = {
  id: string;
  title: string;
  explanation: string;
  whyAvailable: string;
  effort: string;
  impact: "low" | "medium" | "high";
  source: "recommendation" | "roadmap";
  sourceRecommendationId?: string;
  sourceRoadmapId?: string;
  relatedExperience?: { id: string; title: string; organization: string };
  cta: { href: string; label: string };
  detail: {
    requiredEvidence: string[];
    skills: string[];
    relatedOpportunities: Array<{ id: string; title: string; organization: string }>;
    expectedPreparation: string;
  };
};

export type JourneyEditorialHorizon = {
  state: "empty" | "sparse" | "populated";
  items: JourneyEditorialHorizonItem[];
  geometries: {
    desktop: JourneyEditorialGeometry;
    tablet: JourneyEditorialGeometry;
    mobile: JourneyEditorialGeometry;
  };
};

export type JourneyEditorialModel = {
  empty: boolean;
  state: "empty" | "sparse" | "active" | "validated";
  identity: string[];
  story: {
    text: string;
    source: "branch_direction" | "narrative_moment" | "origin" | "canonical_profile";
    confidence: number;
    explanationSource: NarrativeExplanationSource;
  };
  waypoint?: {
    title: string;
    whyItMatters: string;
    estimatedMinutes?: number;
    impact: "low" | "medium" | "high";
    source: "recommendation" | "roadmap" | "journey";
    explanationSource: NarrativeExplanationSource;
    cta: { href: string; label: string };
  };
  transitionControl?: {
    opportunityId: string;
    opportunityTitle: string;
    status: OpportunityTrackerStatus;
    version: number;
    actions: JourneyTransitionAction[];
  };
  history: JourneyEditorialHistory;
  horizon: JourneyEditorialHorizon;
  pathMoments: PathMomentCollection;
  semesterStories: SemesterStoryCollection;
  geometries: {
    desktop: JourneyEditorialGeometry;
    tablet: JourneyEditorialGeometry;
    mobile: JourneyEditorialGeometry;
  };
  theme: "light" | "dark";
  diagnostics: {
    narrativeSource: string;
    waypointSource: string;
    pathprintSignature: string;
    geometrySignatures: string[];
    sourceEventCount: number;
    horizonSources: string[];
    horizonBranchSource: string;
    horizonEvidenceSource: string[];
    editorialAuditVersion: string;
    suppressedClaimCount: number;
    serverProjectionMs?: number;
  };
};

type HorizonSource = {
  input: {
    id: string;
    title: string;
    rationale: string;
    sourceOpportunityId?: string;
    requiredSkills?: string[];
    prerequisiteMilestoneIds?: string[];
  };
  explanation: string;
  effort: string;
  impact: JourneyEditorialHorizonItem["impact"];
  source: JourneyEditorialHorizonItem["source"];
  sourceRecommendationId?: string;
  sourceRoadmapId?: string;
  relatedExperience?: JourneyEditorialHorizonItem["relatedExperience"];
  cta: JourneyEditorialHorizonItem["cta"];
  detail: JourneyEditorialHorizonItem["detail"];
};

type JourneyActivity = NonNullable<ReturnType<typeof openLineInputFromAccount>["activity"]>;

function progressFromAccount(account: AccountData, opportunities: readonly Opportunity[], activity: JourneyActivity): StudentProgress {
  const milestoneTimestamp = account.updatedAt;
  const milestoneProgress = Object.fromEntries(Object.entries(account.journeyProgress ?? {})
    .filter(([, completed]) => completed)
    .map(([milestoneId]) => [milestoneId, {
      milestoneId,
      status: "completed" as const,
      completedDate: milestoneTimestamp.slice(0, 10),
      source: "system" as const,
      updatedAt: milestoneTimestamp,
    }]));
  return inferApplicationsFromActivity(activity, opportunities, { milestones: milestoneProgress, applications: {} });
}

function geometryPresentation(geometry: PathGeometry, viewportHeight: number, targetWaypointY: number): JourneyEditorialGeometry {
  const waypoint = geometry.nodes.find((node) => node.id === geometry.currentWaypointNodeId);
  const y = waypoint
    ? Math.max(0, Math.min(Math.max(0, geometry.height - viewportHeight), waypoint.point.y - targetWaypointY))
    : 0;
  const viewport = { x: 0, y, width: geometry.width, height: Math.min(viewportHeight, Math.max(viewportHeight, geometry.height)) };
  return {
    geometry,
    viewport,
    waypointPosition: waypoint ? {
      xPercent: (waypoint.point.x / geometry.width) * 100,
      yPercent: ((waypoint.point.y - y) / viewport.height) * 100,
    } : undefined,
  };
}

function horizonGeometryPresentation(geometry: PathGeometry, viewportHeight: number): JourneyEditorialGeometry {
  const waypoint = geometry.nodes.find((node) => node.id === geometry.currentWaypointNodeId);
  const horizonNodes = geometry.horizonNodeIds
    .map((id) => geometry.nodes.find((node) => node.id === id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const endpoint = geometry.nodes.find((node) => node.id === geometry.openEndpointNodeId);
  const anchor = waypoint ?? geometry.nodes.find((node) => node.kind === "origin") ?? geometry.nodes[0];
  const maximumY = Math.max(anchor?.point.y ?? 0, endpoint?.point.y ?? 0, ...horizonNodes.map((node) => node.point.y));
  const targetY = Math.max(0, (anchor?.point.y ?? 0) - 48);
  const height = Math.min(viewportHeight, Math.max(320, maximumY - targetY + 72));
  const y = Math.max(0, Math.min(Math.max(0, geometry.height - height), targetY));
  return { geometry, viewport: { x: 0, y, width: geometry.width, height } };
}

function displayIdentity(account: AccountData) {
  const profile = account.profile;
  if (!profile) return [];
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  return [profile.major, school?.name, profile.year].filter((item): item is string => Boolean(item?.trim()));
}

function pathMomentIdentity(account: AccountData, user: Pick<AuthUser, "name">, schoolName?: string) {
  const profile = account.profile;
  const firstName = profile?.firstName?.trim() || user.name.trim().split(/\s+/)[0] || "Student";
  const profileFullName = [profile?.firstName, profile?.lastName].map((part) => part?.trim()).filter(Boolean).join(" ");
  return {
    firstName,
    fullName: profileFullName || user.name.trim() || firstName,
    school: schoolName,
  };
}

function currentTheme(account: AccountData, resolvedTheme?: "light" | "dark"): "light" | "dark" {
  if (resolvedTheme) return resolvedTheme;
  const appearance = account.preferences?.appearance ?? "light";
  return isProUser(account.billing) && (appearance === "midnight" || appearance === "forest") ? "dark" : "light";
}

const chapterDefinitions: ReadonlyArray<{ key: JourneyEditorialChapterKey; title: string }> = [
  { key: "beginning", title: "Where you began" },
  { key: "direction", title: "Choosing a direction" },
  { key: "action", title: "Taking action" },
  { key: "experience", title: "Building experience" },
  { key: "validation", title: "Validation" },
];

const chapterRankByStory: Record<NarrativeStoryType, number> = {
  origin: 0,
  exploration: 0,
  direction: 1,
  expansion: 1,
  rejoin: 1,
  pause: 1,
  closed_opportunity: 1,
  action: 2,
  commitment: 2,
  experience: 3,
  skill: 3,
  validation: 4,
  acceptance: 4,
  waypoint: 4,
  horizon: 4,
};

const weightByStory: Record<NarrativeStoryType, JourneyEditorialHistoryItem["weight"]> = {
  origin: "trace",
  exploration: "trace",
  direction: "small",
  expansion: "small",
  pause: "small",
  closed_opportunity: "small",
  action: "small",
  rejoin: "medium",
  commitment: "medium",
  experience: "large",
  skill: "large",
  validation: "landmark",
  acceptance: "landmark",
  waypoint: "medium",
  horizon: "small",
};

const changedByStory: Record<NarrativeStoryType, string> = {
  origin: "Your Journey gained its first verified point.",
  exploration: "Your path widened before it narrowed.",
  direction: "A broad interest became a direction UnlockED can follow.",
  expansion: "A related direction became part of your path without replacing what came before.",
  action: "An opportunity moved from consideration into active work.",
  commitment: "Preparation became a completed submission.",
  validation: "An external response confirmed that your application moved forward.",
  acceptance: "A possibility became a confirmed opportunity.",
  experience: "A pursued opportunity became completed experience.",
  skill: "Completed work became evidence of specific skills.",
  rejoin: "Separate parts of your path now strengthen the same direction.",
  pause: "This direction stopped requiring attention without being erased.",
  closed_opportunity: "One route closed while the broader direction stayed visible.",
  waypoint: "Your current path gained a clear next step.",
  horizon: "A future possibility became visible from your current progress.",
};

const consequenceByStory: Record<NarrativeStoryType, string> = {
  origin: "The next meaningful action can now build on a real starting point.",
  exploration: "A later choice can be compared against a broader set of options.",
  direction: "Future recommendations can narrow around this direction.",
  expansion: "Related opportunities can support more than one part of your plan.",
  action: "The application can now move toward submission.",
  commitment: "The application can now move toward review, interview, or a final decision.",
  validation: "This response becomes evidence that your preparation is resonating.",
  acceptance: "You can now turn preparation into verified experience.",
  experience: "This experience can support future applications and interviews.",
  skill: "This evidence can strengthen applications that call for the same skills.",
  rejoin: "Evidence from both directions can support the same next step.",
  pause: "You can return to this direction later without losing its history.",
  closed_opportunity: "Related opportunities can still open a different route forward.",
  waypoint: "Completing it can reveal the next useful part of your path.",
  horizon: "The current step can prepare you to pursue it later.",
};

function horizonImpact(priority: RecommendationV1["priority"]): JourneyEditorialHorizonItem["impact"] {
  if (priority === "Critical" || priority === "High") return "high";
  if (priority === "Recommended") return "medium";
  return "low";
}

function horizonEffort(milestone: RoadmapMilestone) {
  return milestone.estimatedCompletionTime || `${milestone.estimatedEffort} preparation`;
}

function horizonHref(categories: readonly string[]) {
  const category = categories.find((item) => item.trim());
  return category ? `/opportunities?category=${encodeURIComponent(category)}` : "/opportunities";
}

function horizonSources(input: {
  advisorProfile: ReturnType<typeof createAdvisorProfile>;
  progress: StudentProgress;
  roadmap: ReturnType<typeof getRoadmap>;
  state: JourneyEditorialHorizon["state"];
}): HorizonSource[] {
  if (input.state === "empty") return [];
  const limit = input.state === "sparse" ? 1 : journeyClarityLimits.retainedHorizonItems;
  const sources: HorizonSource[] = [];
  const seen = new Set<string>();
  const add = (source: HorizonSource) => {
    const key = source.input.title.trim().toLowerCase();
    if (!key || seen.has(key) || sources.length >= limit) return;
    seen.add(key);
    sources.push({ ...source, input: { ...source.input, id: `horizon-${String(sources.length + 1).padStart(2, "0")}-${source.input.id}` } });
  };

  const recommendations = rankMilestoneRecommendations({ advisorProfile: input.advisorProfile, progress: input.progress });
  const recommendationByMilestone = new Map(recommendations
    .filter((recommendation) => recommendation.relatedMilestoneId)
    .map((recommendation) => [recommendation.relatedMilestoneId as string, recommendation]));
  for (const milestone of input.roadmap.upcomingMilestones) {
    if (milestone.id === input.roadmap.recommendedMilestone.id) continue;
    const recommendation = recommendationByMilestone.get(milestone.id);
    add({
      input: {
        id: milestone.id,
        title: milestone.title,
        rationale: recommendation?.reason ?? milestone.description,
        requiredSkills: milestone.requiredSkills,
        prerequisiteMilestoneIds: milestone.requiredBefore,
      },
      explanation: recommendation?.description ?? milestone.description,
      effort: horizonEffort(milestone),
      impact: recommendation ? horizonImpact(recommendation.priority) : horizonImpact(milestone.importance),
      source: recommendation ? "recommendation" : "roadmap",
      sourceRecommendationId: recommendation?.id,
      sourceRoadmapId: milestone.id,
      cta: { href: horizonHref(milestone.relatedOpportunityCategories), label: "Explore ways to begin" },
      detail: {
        requiredEvidence: milestone.requiredBefore,
        skills: milestone.requiredSkills,
        relatedOpportunities: [],
        expectedPreparation: recommendation?.nextAction
          ?? (milestone.recommendedBefore[0] ? `Begin before ${milestone.recommendedBefore[0]}.` : milestone.description),
      },
    });
  }
  return sources;
}

function chapteredHistory(items: JourneyEditorialHistoryItem[]) {
  const chaptered = items.map((item) => ({ ...item, chapter: chapterDefinitions[chapterRankByStory[item.storyType]].key }));
  const group = (moments: JourneyEditorialHistoryItem[]) => moments.reduce<JourneyEditorialHistoryChapter[]>((chapters, moment) => {
    const definition = chapterDefinitions.find((item) => item.key === moment.chapter) ?? chapterDefinitions[0];
    const latest = chapters.at(-1);
    if (latest?.key === definition.key) latest.moments.push(moment);
    else chapters.push({ id: `${definition.key}-${moment.id}`, key: definition.key, title: definition.title, moments: [moment] });
    return chapters;
  }, []);
  const visibleStart = Math.max(0, chaptered.length - journeyClarityLimits.visibleHistoryMoments);
  const retainedStart = Math.max(0, visibleStart - journeyClarityLimits.retainedEarlierMoments);
  return {
    state: chaptered.length === 0
      ? "empty" as const
      : chaptered.every((item) => item.storyType === "exploration")
        ? "exploration" as const
        : chaptered.length === 1 ? "first_moment" as const : "active" as const,
    totalMomentCount: chaptered.length,
    earlierChapters: group(chaptered.slice(retainedStart, visibleStart)),
    recentChapters: group(chaptered.slice(visibleStart)),
    omittedMomentCount: retainedStart,
  };
}

export type JourneyEditorialProjection = {
  model: JourneyEditorialModel;
  pathprint: Pathprint;
};

export function buildJourneyEditorialProjection(input: {
  user: Pick<AuthUser, "id" | "name">;
  account: AccountData;
  opportunities: readonly Opportunity[];
  resolvedTheme?: "light" | "dark";
}): JourneyEditorialProjection {
  const { account, user } = input;
  const profile = account.profile;
  if (!profile) throw new Error("A completed profile is required to build the Journey editorial model.");
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) throw new Error("The saved school is not available in the supported school catalog.");

  const allTrackedIds = new Set([
    ...Object.keys(account.tracker ?? {}),
    ...Object.keys(account.activity?.tracked ?? {}),
    ...(account.activity?.saved ?? []),
    ...(account.savedOpportunities ?? []).map((record) => record.opportunityId),
  ]);
  const empty = allTrackedIds.size === 0;
  const opportunities = input.opportunities.filter((opportunity) => allTrackedIds.has(opportunity.id));
  const adapted = openLineInputFromAccount({ userId: user.id, account, generatedAt: account.updatedAt });
  const activity = adapted.activity ?? { viewed: [], saved: [], claimed: [], tracked: {} };
  const progress = progressFromAccount(account, opportunities, activity);
  const advisorProfile = createAdvisorProfile({ profile, school, activity, progress });
  const roadmap = getRoadmap(advisorProfile, progress);
  const roadmapWaypoint = empty ? null : waypointFromRoadmap(roadmap.recommendedMilestone);
  const trackedRecords = { ...(account.activity?.tracked ?? {}), ...(account.tracker ?? {}) };
  const trackedValues = Object.values(trackedRecords);
  const clarityState = empty ? "empty" : trackedValues.length ? journeyClarityStage(trackedValues) : "sparse";
  const hasProgressBeyondSaving = (account.activity?.claimed?.length ?? 0) > 0
    || trackedValues.some((record) => record.status !== "Saved");
  const horizonState: JourneyEditorialHorizon["state"] = empty ? "empty" : hasProgressBeyondSaving ? "populated" : "sparse";
  const futureSources = horizonSources({ advisorProfile, progress, roadmap, state: horizonState });
  const pathInput = {
    ...adapted,
    profile: empty ? null : adapted.profile,
    activity: empty ? null : adapted.activity,
    savedRecords: empty ? [] : adapted.savedRecords,
    progress: empty ? null : progress,
    opportunities,
    milestoneDefinitions: roadmap.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      category: milestone.category,
      requiredSkills: milestone.requiredSkills,
    })),
    currentWaypoint: roadmapWaypoint,
    horizon: futureSources.map((source) => source.input),
  };
  const pathprint = buildPathprint(pathInput);
  const narrative = pathprint.narrative;
  if (!narrative) throw new Error("The Narrative Engine did not return a Journey narrative.");
  const openLineDiagnostics = getOpenLineDiagnostics(pathInput, pathprint);
  const desktopGeometry = createPathGeometry(pathprint, { mode: "desktop" });
  const tabletGeometry = createPathGeometry(pathprint, { mode: "tablet" });
  const mobileGeometry = createPathGeometry(pathprint, { mode: "mobile" });
  const waypointMeaning = narrative.waypoint;
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const transitionCandidateIds = [
    waypointMeaning?.sourceOpportunityId,
    ...trackedValues.toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt)).map((record) => record.id),
  ].filter((id): id is string => Boolean(id));
  const transitionRecord = transitionCandidateIds
    .map((id) => trackedRecords[id])
    .find((record) => {
      if (!record) return false;
      const opportunity = opportunityById.get(record.id);
      return Boolean(opportunity && recordSupportsEditorialAction(record, opportunity) && getJourneyTransitionActions(record).length > 0);
    });
  const transitionOpportunity = transitionRecord ? opportunityById.get(transitionRecord.id) : undefined;
  const transitionActions = transitionRecord ? getJourneyTransitionActions(transitionRecord) : [];
  const transitionPrimary = transitionActions.find((action) => action.primary);
  const pathEventsByMoment = new Map<string, typeof pathprint.events>();
  for (const event of pathprint.events) {
    if (!event.narrativeMomentId) continue;
    const related = pathEventsByMoment.get(event.narrativeMomentId) ?? [];
    related.push(event);
    pathEventsByMoment.set(event.narrativeMomentId, related);
  }
  let suppressedClaimCount = 0;
  const historyItems: JourneyEditorialHistoryItem[] = narrative.moments
    .flatMap((moment) => {
      if (["origin", "exploration", "direction", "expansion", "waypoint", "horizon"].includes(moment.storyType)) {
        suppressedClaimCount += 1;
        return [];
      }
      const pathEvents = pathEventsByMoment.get(moment.id) ?? [];
      const primaryEvent = pathEvents.reduce((mostImportant, event) => !mostImportant || event.importance > mostImportant.importance ? event : mostImportant, undefined as (typeof pathEvents)[number] | undefined);
      const opportunity = primaryEvent?.opportunityId ? opportunityById.get(primaryEvent.opportunityId) : undefined;
      const eventRecord = opportunity ? trackedRecords[opportunity.id] : undefined;
      if (moment.storyType === "action" && (!opportunity || !eventRecord || !recordSupportsEditorialAction(eventRecord, opportunity))) {
        suppressedClaimCount += 1;
        return [];
      }
      const parameterSkills = typeof moment.parameters.skills === "string" ? moment.parameters.skills.trim() : "";
      const supportsSkillEvidence = moment.storyType === "experience" || moment.storyType === "skill";
      const skillsGained = supportsSkillEvidence ? [...new Set([
        ...(opportunity?.metadata.skillsGained ?? []),
        ...(parameterSkills ? [parameterSkills] : []),
      ].map((skill) => skill.trim()).filter(Boolean))].slice(0, 4) : [];
      const category = primaryEvent?.category
        ?? (typeof moment.parameters.categoryTitle === "string" ? moment.parameters.categoryTitle : undefined);
      return [{
        id: moment.id,
        occurredAt: moment.occurredAt,
        title: moment.title,
        body: moment.body,
        storyType: moment.storyType,
        chapter: "beginning",
        weight: weightByStory[moment.storyType],
        category,
        detail: {
          whyItMattered: moment.explanation ?? moment.body,
          skillsGained,
          whatChanged: changedByStory[moment.storyType],
          nextConsequence: consequenceByStory[moment.storyType],
          relatedOpportunity: opportunity ? { id: opportunity.id, title: opportunity.title } : undefined,
        },
      }];
    });
  const sourceByTitle = new Map(futureSources.map((source) => [source.input.title, source]));
  const horizonItems: JourneyEditorialHorizonItem[] = narrative.horizon.flatMap((meaning) => {
    const source = sourceByTitle.get(meaning.title);
    if (!source) return [];
    return [{
      id: meaning.id,
      title: meaning.title,
      explanation: source.explanation,
      whyAvailable: meaning.rationale,
      effort: source.effort,
      impact: source.impact,
      source: source.source,
      sourceRecommendationId: source.sourceRecommendationId,
      sourceRoadmapId: source.sourceRoadmapId,
      relatedExperience: source.relatedExperience,
      cta: source.cta,
      detail: source.detail,
    }];
  });

  const canonicalWaypoint = !empty && transitionPrimary && transitionOpportunity
    ? {
      ...canonicalTransitionWaypoint(transitionPrimary.transition, transitionOpportunity.title),
      source: "journey" as const,
      explanationSource: "event_type" as const,
      cta: { href: "/my-opportunities", label: transitionPrimary.label },
    }
    : !empty && waypointMeaning
      ? {
        title: waypointMeaning.title,
        whyItMatters: waypointMeaning.whyItMatters,
        estimatedMinutes: waypointMeaning.estimatedMinutes,
        impact: waypointMeaning.impact,
        source: waypointMeaning.source,
        explanationSource: waypointMeaning.explanationSource,
        cta: waypointMeaning.sourceOpportunityId
          ? { href: `/opportunities/${waypointMeaning.sourceOpportunityId}`, label: "Open opportunity" }
          : { href: horizonHref(roadmap.recommendedMilestone.relatedOpportunityCategories), label: "Find an opportunity for this step" },
      }
      : undefined;
  const identity = pathMomentIdentity(account, user, school.name);
  const pathMoments = buildPathMoments({
    pathprint,
    opportunities,
    identity,
  });
  const semesterStories = buildSemesterStories({
    pathprint,
    opportunities,
    identity: {
      ...identity,
      major: profile.major,
      profileHref: "/profile",
    },
    generatedAt: account.updatedAt,
  });

  const model: JourneyEditorialModel = {
    empty,
    state: clarityState,
    identity: displayIdentity(account),
    story: {
      text: canonicalJourneyStatement(profile, clarityState),
      source: "canonical_profile",
      confidence: 1,
      explanationSource: "event_type",
    },
    waypoint: canonicalWaypoint,
    transitionControl: transitionRecord && transitionOpportunity && transitionPrimary ? {
      opportunityId: transitionRecord.id,
      opportunityTitle: transitionOpportunity.title,
      status: transitionRecord.status,
      version: transitionRecord.version ?? 0,
      actions: transitionActions,
    } : undefined,
    history: chapteredHistory(historyItems),
    horizon: {
      state: horizonState,
      items: horizonItems,
      geometries: {
        desktop: horizonGeometryPresentation(desktopGeometry, 650),
        tablet: horizonGeometryPresentation(tabletGeometry, 650),
        mobile: horizonGeometryPresentation(mobileGeometry, 720),
      },
    },
    pathMoments,
    semesterStories,
    geometries: {
      desktop: geometryPresentation(desktopGeometry, 560, 252),
      tablet: geometryPresentation(tabletGeometry, 600, 250),
      mobile: geometryPresentation(mobileGeometry, 440, 48),
    },
    theme: currentTheme(account, input.resolvedTheme),
    diagnostics: {
      narrativeSource: narrative.editorialStatement.source,
      waypointSource: narrative.waypoint?.source ?? "none",
      pathprintSignature: pathprint.signature,
      geometrySignatures: [desktopGeometry, tabletGeometry, mobileGeometry].map((geometry) => geometry.diagnostics.deterministicSignature),
      sourceEventCount: openLineDiagnostics.sourceEventCount,
      horizonSources: horizonItems.map((item) => `${item.source}:${item.sourceRecommendationId ?? item.sourceRoadmapId ?? item.id}`),
      horizonBranchSource: pathprint.branchIntelligence?.primaryDirectionKey ?? "none",
      horizonEvidenceSource: narrative.horizon.map((item) => item.explanationSource),
      editorialAuditVersion: journeyEditorialAuditVersion,
      suppressedClaimCount,
    },
  };
  return { model, pathprint };
}

export function buildJourneyEditorialModel(input: {
  user: Pick<AuthUser, "id" | "name">;
  account: AccountData;
  opportunities: readonly Opportunity[];
  resolvedTheme?: "light" | "dark";
}): JourneyEditorialModel {
  return buildJourneyEditorialProjection(input).model;
}
