import type { Opportunity } from "./opportunities";
import type { StudentActivity, TrackedOpportunity } from "./student-activity";
import type { StudentProfile } from "./student-profile";
import type { StudentProgress } from "./student-progress";

export type JourneyMilestone = {
  id: string;
  title: string;
  description: string;
  category: "Profile" | "Saved" | "Application" | "Interview" | "Accepted" | "Completed" | "Research" | "Scholarship" | "Internship" | "Benefit";
  completed: boolean;
  completedAt?: string;
  date: string;
  opportunityId?: string;
  relatedOpportunityId?: string;
  order: number;
  shareable: boolean;
};

export type JourneyRecap = {
  opportunitiesSaved: number;
  applicationsSubmitted: number;
  interviewsReached: number;
  acceptancesRecorded: number;
  completedOpportunities: number;
  mostExploredCategory: string | null;
  biggestMilestone: JourneyMilestone | null;
};

export type JourneyTimeRange = "all" | "semester" | "academicYear";

export type JourneyActivityPoint = {
  date: string;
  count: number;
};

export type CollegeJourneySummary = {
  milestones: JourneyMilestone[];
  completedMilestones: JourneyMilestone[];
  upcomingMilestones: JourneyMilestone[];
  completedCount: number;
  applicableCount: number;
  progressPercent: number;
  nextMilestone: JourneyMilestone | null;
  recap: JourneyRecap;
  activityHeatmap: JourneyActivityPoint[];
  journeyStartDate: string | null;
  topCategory: string | null;
  topInterest: string | null;
};

type MilestoneRuleInput = {
  profile: StudentProfile;
  tracked: TrackedOpportunity[];
  opportunities: readonly Opportunity[];
};

type JourneyMilestoneDefinition = {
  id: string;
  title: string;
  description: string;
  category: JourneyMilestone["category"];
  order: number;
  shareable: boolean;
  resolve: (input: MilestoneRuleInput) => { completedAt: string; opportunityId?: string } | null;
};

export const journeyActiveStatuses = ["Saved", "Interested", "Applying", "Submitted", "Interview"] as const;
export const journeyAppliedStatuses = ["Applying", "Submitted", "Interview", "Accepted", "Rejected", "Completed"] as const;
const applicationStatuses = new Set<string>(journeyAppliedStatuses);
const submittedStatuses = new Set<string>(["Submitted", "Interview", "Accepted", "Rejected", "Completed"]);
const acceptedOrCompletedStatuses = new Set<string>(["Accepted", "Completed"]);

function opportunityFor(id: string, opportunities: readonly Opportunity[]) {
  return opportunities.find((item) => item.id === id) ?? null;
}

function earliest(records: TrackedOpportunity[], predicate: (record: TrackedOpportunity) => boolean) {
  return records.filter(predicate).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0] ?? null;
}

function nthRecord(records: TrackedOpportunity[], predicate: (record: TrackedOpportunity) => boolean, index: number) {
  return records.filter(predicate).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[index] ?? null;
}

function trackedOpportunity(record: TrackedOpportunity, opportunities: readonly Opportunity[]) {
  return opportunityFor(record.id, opportunities);
}

function isType(record: TrackedOpportunity, opportunities: readonly Opportunity[], predicate: (opportunity: Opportunity) => boolean) {
  const item = trackedOpportunity(record, opportunities);
  return item ? predicate(item) : false;
}

function categoryFromOpportunity(opportunity: Opportunity) {
  if (opportunity.type === "Scholarship") return "Scholarships";
  if (opportunity.type === "Research") return "Research";
  if (opportunity.type === "Benefit") return "Benefits";
  if (opportunity.type === "AI") return "AI Tools";
  if (opportunity.category === "Software") return "Software";
  if (opportunity.category) return opportunity.category;
  return opportunity.type;
}

function milestone(definition: JourneyMilestoneDefinition, completion: { completedAt: string; opportunityId?: string } | null): JourneyMilestone {
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    category: definition.category,
    completed: Boolean(completion),
    completedAt: completion?.completedAt,
    date: completion?.completedAt ?? "",
    opportunityId: completion?.opportunityId,
    relatedOpportunityId: completion?.opportunityId,
    order: definition.order,
    shareable: definition.shareable,
  };
}

export const journeyMilestoneCatalog: readonly JourneyMilestoneDefinition[] = [
  { id: "profile-complete", title: "Completed profile", description: "Your recommendations can use your school, major, goals, and interests.", category: "Profile", order: 10, shareable: true, resolve: ({ profile }) => {
    const withTimestamp = profile as StudentProfile & { updatedAt?: string };
    const completedAt = withTimestamp.updatedAt ?? profile.advisorInterview?.completedAt ?? profile.onboardingCompletedAt;
    return completedAt ? { completedAt } : null;
  } },
  { id: "first-journey-add", title: "Added first opportunity to Journey", description: "You started tracking a real opportunity.", category: "Saved", order: 20, shareable: true, resolve: ({ tracked }) => {
    const record = nthRecord(tracked, () => true, 0);
    return record ? { completedAt: record.savedAt, opportunityId: record.id } : null;
  } },
  { id: "first-saved", title: "Saved first opportunity", description: "You saved an opportunity to revisit later.", category: "Saved", order: 30, shareable: true, resolve: ({ tracked }) => {
    const record = nthRecord(tracked, () => true, 0);
    return record ? { completedAt: record.savedAt, opportunityId: record.id } : null;
  } },
  { id: "five-saved", title: "Saved five opportunities", description: "Your Journey now has multiple paths to compare.", category: "Saved", order: 40, shareable: true, resolve: ({ tracked }) => {
    const record = nthRecord(tracked, () => true, 4);
    return record ? { completedAt: record.savedAt, opportunityId: record.id } : null;
  } },
  { id: "ten-saved", title: "Saved ten opportunities", description: "Your board reflects a serious opportunity search.", category: "Saved", order: 50, shareable: true, resolve: ({ tracked }) => {
    const record = nthRecord(tracked, () => true, 9);
    return record ? { completedAt: record.savedAt, opportunityId: record.id } : null;
  } },
  { id: "first-application-started", title: "Started first application", description: "You moved an opportunity into application progress.", category: "Application", order: 60, shareable: true, resolve: ({ tracked }) => {
    const record = earliest(tracked, (item) => applicationStatuses.has(item.status));
    return record ? { completedAt: record.updatedAt, opportunityId: record.id } : null;
  } },
  { id: "first-submitted", title: "Submitted first application", description: "You recorded your first submitted application.", category: "Application", order: 70, shareable: true, resolve: ({ tracked }) => {
    const record = earliest(tracked, (item) => submittedStatuses.has(item.status));
    return record ? { completedAt: record.updatedAt, opportunityId: record.id } : null;
  } },
  { id: "five-submitted", title: "Submitted five applications", description: "You recorded five submitted applications in UnlockED.", category: "Application", order: 80, shareable: true, resolve: ({ tracked }) => {
    const record = nthRecord(tracked, (item) => submittedStatuses.has(item.status), 4);
    return record ? { completedAt: record.updatedAt, opportunityId: record.id } : null;
  } },
  { id: "first-interview", title: "Reached first interview", description: "You recorded an opportunity as interviewing.", category: "Interview", order: 90, shareable: true, resolve: ({ tracked }) => {
    const record = earliest(tracked, (item) => item.status === "Interview");
    return record ? { completedAt: record.updatedAt, opportunityId: record.id } : null;
  } },
  { id: "three-interviews", title: "Reached three interviews", description: "You recorded three interview-stage opportunities.", category: "Interview", order: 100, shareable: true, resolve: ({ tracked }) => {
    const record = nthRecord(tracked, (item) => item.status === "Interview", 2);
    return record ? { completedAt: record.updatedAt, opportunityId: record.id } : null;
  } },
  { id: "first-acceptance", title: "Received first acceptance", description: "You recorded an accepted opportunity.", category: "Accepted", order: 110, shareable: true, resolve: ({ tracked }) => {
    const record = earliest(tracked, (item) => item.status === "Accepted");
    return record ? { completedAt: record.updatedAt, opportunityId: record.id } : null;
  } },
  { id: "first-completed", title: "Completed first opportunity", description: "You marked an opportunity as completed.", category: "Completed", order: 120, shareable: true, resolve: ({ tracked }) => {
    const record = earliest(tracked, (item) => item.status === "Completed");
    return record ? { completedAt: record.updatedAt, opportunityId: record.id } : null;
  } },
  { id: "first-research", title: "Pursued first research opportunity", description: "You added a research opportunity to your Journey.", category: "Research", order: 130, shareable: true, resolve: ({ tracked, opportunities }) => {
    const record = earliest(tracked, (item) => isType(item, opportunities, (opportunity) => opportunity.type === "Research"));
    return record ? { completedAt: record.savedAt, opportunityId: record.id } : null;
  } },
  { id: "first-scholarship", title: "Pursued first scholarship", description: "You added a scholarship to your Journey.", category: "Scholarship", order: 140, shareable: true, resolve: ({ tracked, opportunities }) => {
    const record = earliest(tracked, (item) => isType(item, opportunities, (opportunity) => opportunity.type === "Scholarship"));
    return record ? { completedAt: record.savedAt, opportunityId: record.id } : null;
  } },
  { id: "first-internship", title: "Pursued first internship", description: "You added an internship or career program to your Journey.", category: "Internship", order: 150, shareable: true, resolve: ({ tracked, opportunities }) => {
    const record = earliest(tracked, (item) => isType(item, opportunities, (opportunity) => opportunity.category === "Internships" || opportunity.type === "Career"));
    return record ? { completedAt: record.savedAt, opportunityId: record.id } : null;
  } },
  { id: "first-benefit", title: "Claimed first student benefit", description: "You added a student benefit to your Journey.", category: "Benefit", order: 160, shareable: true, resolve: ({ tracked, opportunities }) => {
    const record = earliest(tracked, (item) => isType(item, opportunities, (opportunity) => opportunity.type === "Benefit"));
    return record ? { completedAt: record.savedAt, opportunityId: record.id } : null;
  } },
  { id: "first-ai-software", title: "Used first AI or software benefit", description: "You added an AI tool or software resource to your Journey.", category: "Benefit", order: 170, shareable: true, resolve: ({ tracked, opportunities }) => {
    const record = earliest(tracked, (item) => isType(item, opportunities, (opportunity) => opportunity.type === "AI" || opportunity.category === "Software"));
    return record ? { completedAt: record.savedAt, opportunityId: record.id } : null;
  } },
];

export function buildJourneyMilestones(input: { profile: StudentProfile; activity: StudentActivity; progress?: StudentProgress; opportunities: readonly Opportunity[] }): JourneyMilestone[] {
  const tracked = Object.values(input.activity.tracked ?? {});
  return journeyMilestoneCatalog.map((definition) => milestone(definition, definition.resolve({ profile: input.profile, tracked, opportunities: input.opportunities }))).sort((a, b) => a.order - b.order);
}

export function buildJourneyRecap(input: { activity: StudentActivity; milestones: readonly JourneyMilestone[]; opportunities: readonly Opportunity[] }): JourneyRecap {
  const tracked = Object.values(input.activity.tracked ?? {});
  const categoryCounts = new Map<string, number>();
  for (const record of tracked) {
    const item = opportunityFor(record.id, input.opportunities);
    if (item) {
      const category = categoryFromOpportunity(item);
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const mostExploredCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    opportunitiesSaved: tracked.length,
    applicationsSubmitted: tracked.filter((record) => submittedStatuses.has(record.status)).length,
    interviewsReached: tracked.filter((record) => record.status === "Interview").length,
    acceptancesRecorded: tracked.filter((record) => acceptedOrCompletedStatuses.has(record.status)).length,
    completedOpportunities: tracked.filter((record) => record.status === "Completed").length,
    mostExploredCategory,
    biggestMilestone: input.milestones.filter((item) => item.completed).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0] ?? null,
  };
}

function timeRangeStart(range: JourneyTimeRange, now = new Date()) {
  if (range === "all") return null;
  const year = now.getUTCFullYear();
  if (range === "academicYear") return new Date(Date.UTC(now.getUTCMonth() >= 7 ? year : year - 1, 7, 1));
  const semesterMonth = now.getUTCMonth() >= 7 ? 7 : now.getUTCMonth() >= 4 ? 4 : 0;
  return new Date(Date.UTC(year, semesterMonth, 1));
}

function inRange(date: string, range: JourneyTimeRange) {
  const start = timeRangeStart(range);
  if (!start) return true;
  const value = new Date(date);
  return Number.isFinite(value.getTime()) && value >= start;
}

export function buildJourneyActivityHeatmap(activity: StudentActivity, range: JourneyTimeRange = "all"): JourneyActivityPoint[] {
  const counts = new Map<string, number>();
  for (const record of Object.values(activity.tracked ?? {})) {
    for (const date of [record.savedAt, record.updatedAt]) {
      if (!date || !inRange(date, range)) continue;
      const day = date.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
}

export function buildCollegeJourneySummary(input: { profile: StudentProfile; activity: StudentActivity; progress?: StudentProgress; opportunities: readonly Opportunity[]; range?: JourneyTimeRange }): CollegeJourneySummary {
  const range = input.range ?? "all";
  const allMilestones = buildJourneyMilestones(input);
  const milestones = allMilestones.map((item) => item.completedAt && !inRange(item.completedAt, range) ? { ...item, completed: false, completedAt: undefined, date: "" } : item);
  const completedMilestones = milestones.filter((item) => item.completed);
  const upcomingMilestones = milestones.filter((item) => !item.completed);
  const applicableCount = milestones.length;
  const completedCount = completedMilestones.length;
  const tracked = Object.values(input.activity.tracked ?? {}).filter((record) => inRange(record.savedAt, range) || inRange(record.updatedAt, range));
  const rangedActivity = { ...input.activity, saved: tracked.map((record) => record.id), tracked: Object.fromEntries(tracked.map((record) => [record.id, record])) };
  const recap = buildJourneyRecap({ activity: rangedActivity, milestones, opportunities: input.opportunities });
  const categoryCounts = new Map<string, number>();
  for (const record of tracked) {
    const item = opportunityFor(record.id, input.opportunities);
    if (item) categoryCounts.set(categoryFromOpportunity(item), (categoryCounts.get(categoryFromOpportunity(item)) ?? 0) + 1);
  }
  const topCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? recap.mostExploredCategory;
  const topInterest = input.profile.advisorInterview?.interests?.[0] ?? input.profile.topics?.[0] ?? input.profile.interests.split(",").map((item) => item.trim()).filter(Boolean)[0] ?? null;
  return {
    milestones,
    completedMilestones,
    upcomingMilestones,
    completedCount,
    applicableCount,
    progressPercent: applicableCount ? Math.round((completedCount / applicableCount) * 100) : 0,
    nextMilestone: upcomingMilestones[0] ?? null,
    recap,
    activityHeatmap: buildJourneyActivityHeatmap(input.activity, range),
    journeyStartDate: tracked.sort((a, b) => a.savedAt.localeCompare(b.savedAt))[0]?.savedAt ?? null,
    topCategory,
    topInterest,
  };
}
