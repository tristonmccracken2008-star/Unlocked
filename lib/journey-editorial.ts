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
  explanation?: string;
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
  history: JourneyEditorialHistoryItem[];
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
    history: narrative.moments
      .filter((moment) => moment.kind !== "origin")
      .slice(-6)
      .map((moment) => ({
        id: moment.id,
        occurredAt: moment.occurredAt,
        title: moment.title,
        body: moment.body,
        explanation: moment.explanation,
      })),
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
