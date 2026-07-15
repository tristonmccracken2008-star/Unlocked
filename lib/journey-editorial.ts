import type { AccountData, AuthUser } from "@/lib/account-types";
import { isProUser } from "@/lib/billing";
import { schools } from "@/data/index";
import type { Opportunity } from "@/data/opportunities";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { getRoadmap } from "@/data/roadmap-engine";
import { inferApplicationsFromActivity, type StudentProgress } from "@/data/student-progress";
import {
  buildPathprint,
  createPathGeometry,
  getOpenLineDiagnostics,
  openLineInputFromAccount,
  waypointFromRoadmap,
  type NarrativeExplanationSource,
  type NarrativeStoryType,
  type PathGeometry,
} from "@/data/open-line/index";

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
};

export type JourneyEditorialModel = {
  empty: boolean;
  identity: string[];
  story: {
    text: string;
    source: "branch_direction" | "narrative_moment" | "origin";
    confidence: number;
    explanationSource: NarrativeExplanationSource;
  };
  waypoint?: {
    title: string;
    whyItMatters: string;
    estimatedMinutes?: number;
    impact: "low" | "medium" | "high";
    source: "recommendation" | "roadmap";
    explanationSource: NarrativeExplanationSource;
    cta: { href: string; label: string };
  };
  history: JourneyEditorialHistory;
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
  };
};

function activityFromAccount(account: AccountData) {
  const adapted = openLineInputFromAccount({ userId: "journey-editorial", account });
  return adapted.activity ?? { viewed: [], saved: [], claimed: [], tracked: {} };
}

function progressFromAccount(account: AccountData, opportunities: readonly Opportunity[]): StudentProgress {
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
  return inferApplicationsFromActivity(activityFromAccount(account), opportunities, { milestones: milestoneProgress, applications: {} });
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

function displayIdentity(account: AccountData) {
  const profile = account.profile;
  if (!profile) return [];
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  return [profile.major, school?.name, profile.year].filter((item): item is string => Boolean(item?.trim()));
}

function currentTheme(account: AccountData): "light" | "dark" {
  const appearance = account.preferences?.appearance ?? "light";
  return isProUser(account.billing) && appearance !== "light" ? "dark" : "light";
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

function chapteredHistory(items: JourneyEditorialHistoryItem[]) {
  const chaptered = items.map((item) => ({ ...item, chapter: chapterDefinitions[chapterRankByStory[item.storyType]].key }));
  const group = (moments: JourneyEditorialHistoryItem[]) => moments.reduce<JourneyEditorialHistoryChapter[]>((chapters, moment) => {
    const definition = chapterDefinitions.find((item) => item.key === moment.chapter) ?? chapterDefinitions[0];
    const latest = chapters.at(-1);
    if (latest?.key === definition.key) latest.moments.push(moment);
    else chapters.push({ id: `${definition.key}-${moment.id}`, key: definition.key, title: definition.title, moments: [moment] });
    return chapters;
  }, []);
  const recentStart = Math.max(0, chaptered.length - 10);
  return {
    state: chaptered.length === 0
      ? "empty" as const
      : chaptered.every((item) => item.storyType === "exploration")
        ? "exploration" as const
        : chaptered.length === 1 ? "first_moment" as const : "active" as const,
    totalMomentCount: chaptered.length,
    earlierChapters: group(chaptered.slice(0, recentStart)),
    recentChapters: group(chaptered.slice(recentStart)),
  };
}

export function buildJourneyEditorialModel(input: {
  user: Pick<AuthUser, "id" | "name">;
  account: AccountData;
  opportunities: readonly Opportunity[];
}): JourneyEditorialModel {
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
  const progress = progressFromAccount(account, opportunities);
  const activity = activityFromAccount(account);
  const advisorProfile = createAdvisorProfile({ profile, school, activity, progress });
  const roadmap = getRoadmap(advisorProfile, progress);
  const roadmapWaypoint = empty ? null : waypointFromRoadmap(roadmap.recommendedMilestone);
  const adapted = openLineInputFromAccount({ userId: user.id, account, generatedAt: account.updatedAt });
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
    horizon: empty ? [] : roadmap.upcomingMilestones
      .filter((milestone) => milestone.id !== roadmap.recommendedMilestone.id)
      .slice(0, 2)
      .map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        rationale: milestone.description,
        requiredSkills: milestone.requiredSkills,
        prerequisiteMilestoneIds: milestone.requiredBefore,
      })),
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
  const pathEventsByMoment = new Map<string, typeof pathprint.events>();
  for (const event of pathprint.events) {
    if (!event.narrativeMomentId) continue;
    const related = pathEventsByMoment.get(event.narrativeMomentId) ?? [];
    related.push(event);
    pathEventsByMoment.set(event.narrativeMomentId, related);
  }
  const historyItems: JourneyEditorialHistoryItem[] = narrative.moments
    .filter((moment) => moment.kind !== "origin")
    .map((moment) => {
      const pathEvents = pathEventsByMoment.get(moment.id) ?? [];
      const primaryEvent = [...pathEvents].sort((left, right) => right.importance - left.importance)[0];
      const opportunity = primaryEvent?.opportunityId ? opportunityById.get(primaryEvent.opportunityId) : undefined;
      const parameterSkills = typeof moment.parameters.skills === "string" ? moment.parameters.skills.trim() : "";
      const skillsGained = [...new Set([
        ...(opportunity?.metadata.skillsGained ?? []),
        ...(parameterSkills ? [parameterSkills] : []),
      ].map((skill) => skill.trim()).filter(Boolean))].slice(0, 4);
      const category = primaryEvent?.category
        ?? (typeof moment.parameters.categoryTitle === "string" ? moment.parameters.categoryTitle : undefined);
      return {
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
      };
    });

  return {
    empty,
    identity: displayIdentity(account),
    story: {
      text: narrative.editorialStatement.text,
      source: narrative.editorialStatement.source,
      confidence: narrative.editorialStatement.confidence,
      explanationSource: narrative.editorialStatement.explanationSource,
    },
    waypoint: waypointMeaning ? {
      title: waypointMeaning.title,
      whyItMatters: waypointMeaning.whyItMatters,
      estimatedMinutes: waypointMeaning.estimatedMinutes,
      impact: waypointMeaning.impact,
      source: waypointMeaning.source,
      explanationSource: waypointMeaning.explanationSource,
      cta: waypointMeaning.sourceOpportunityId
        ? { href: `/opportunities/${waypointMeaning.sourceOpportunityId}`, label: "Open opportunity" }
        : { href: "/opportunities", label: "Explore ways to start" },
    } : undefined,
    history: chapteredHistory(historyItems),
    geometries: {
      desktop: geometryPresentation(desktopGeometry, 560, 252),
      tablet: geometryPresentation(tabletGeometry, 600, 250),
      mobile: geometryPresentation(mobileGeometry, 440, 48),
    },
    theme: currentTheme(account),
    diagnostics: {
      narrativeSource: narrative.editorialStatement.source,
      waypointSource: narrative.waypoint?.source ?? "none",
      pathprintSignature: pathprint.signature,
      geometrySignatures: [desktopGeometry, tabletGeometry, mobileGeometry].map((geometry) => geometry.diagnostics.deterministicSignature),
      sourceEventCount: openLineDiagnostics.sourceEventCount,
    },
  };
}
