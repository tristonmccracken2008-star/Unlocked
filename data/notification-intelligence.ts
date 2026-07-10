import type { AdvisorProfile } from "./advisor-engine";
import { buildAdvisorTimeline } from "./advisor-timeline";
import { advisorRuleKnowledgeReference, mergeKnowledgeReferences, milestoneKnowledgeReferences, opportunityKnowledgeReferences, type KnowledgeReferences } from "./knowledge-references";
import { getDeadlineDays, scoreOpportunityIntelligence, type OpportunityPriority } from "./opportunity-intelligence";
import { getOpportunityUpdates } from "./opportunity-updates";
import { opportunities as catalogOpportunities, type Opportunity } from "./opportunities";
import { getRoadmap, type RoadmapMilestone } from "./roadmap-engine";
import type { StudentProgress } from "./student-progress";
import { buildWeeklyAdvisorDigest } from "./weekly-advisor-digest";

export type NotificationType = "deadline_reminder" | "new_opportunity" | "roadmap_update" | "milestone_reminder" | "weekly_digest";
export type NotificationPriority = "Critical" | "High" | "Recommended" | "Optional";

export type AdvisorNotification = {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  reason: string;
  actionLabel: string;
  actionHref: string;
  relatedOpportunityId?: string;
  relatedMilestoneId?: string;
  generatedAt: string;
  knowledgeReferences: KnowledgeReferences;
};

export type NotificationIntelligenceInput = {
  advisorProfile: AdvisorProfile;
  opportunities?: readonly Opportunity[];
  progress?: StudentProgress;
  now?: Date;
  includeWeeklyDigest?: boolean;
  limit?: number;
};

export type NotificationIntelligenceResult = {
  notifications: AdvisorNotification[];
  generatedAt: string;
  inputs: {
    major: string;
    year: string;
    notificationCount: number;
  };
};

const priorityWeight: Record<NotificationPriority, number> = {
  Critical: 4,
  High: 3,
  Recommended: 2,
  Optional: 1,
};

const msPerDay = 86_400_000;

function isoNow(now: Date) {
  return now.toISOString();
}

function daysSince(date: string, now: Date) {
  const then = new Date(`${date}T00:00:00Z`);
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - then.getTime()) / msPerDay);
}

function contextFor(profile: AdvisorProfile) {
  return {
    schoolSlug: profile.school.slug,
    schoolName: profile.school.name,
    major: profile.academics.major,
    academicYear: profile.academics.academicYear,
    careerGoals: [profile.goals.careerGoal, ...profile.goals.primaryGoals].filter(Boolean).join(", "),
    interests: [...profile.goals.interests, ...profile.goals.topics],
    savedOpportunityIds: profile.experience.savedOpportunityIds,
    viewedOpportunityIds: profile.experience.viewedOpportunityIds,
  };
}

function notificationPriority(priority: OpportunityPriority): NotificationPriority {
  return priority;
}

function deadlinePriority(days: number): NotificationPriority {
  if (days <= 3) return "Critical";
  if (days <= 10) return "High";
  return "Recommended";
}

function milestonePriority(milestone: RoadmapMilestone): NotificationPriority {
  return milestone.importance;
}

function deadlineNotifications(profile: AdvisorProfile, opportunities: readonly Opportunity[], now: Date): AdvisorNotification[] {
  const context = contextFor(profile);
  return opportunities
    .filter((opportunity) => opportunity.verification_status !== "expired")
    .map((opportunity) => ({ opportunity, days: getDeadlineDays(opportunity, now), score: scoreOpportunityIntelligence(opportunity, context) }))
    .filter(({ days, score }) => days !== null && days >= 0 && days <= 14 && score.score >= 40)
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999) || b.score.score - a.score.score)
    .slice(0, 4)
    .map(({ opportunity, days, score }) => ({
      id: `deadline-${opportunity.id}`,
      type: "deadline_reminder" as const,
      priority: deadlinePriority(days ?? 14),
      title: days === 0 ? `${opportunity.title} is due today` : `${opportunity.title} closes in ${days} day${days === 1 ? "" : "s"}`,
      body: "Review eligibility and submit from the official source before the deadline.",
      reason: score.reasons[0] ?? "This deadline matches your profile and is approaching.",
      actionLabel: "View opportunity",
      actionHref: `/opportunities/${opportunity.id}`,
      relatedOpportunityId: opportunity.id,
      generatedAt: isoNow(now),
      knowledgeReferences: mergeKnowledgeReferences(opportunityKnowledgeReferences(opportunity), advisorRuleKnowledgeReference("deadline_reminder")),
    }));
}

function newOpportunityNotifications(profile: AdvisorProfile, opportunities: readonly Opportunity[], now: Date): AdvisorNotification[] {
  const sourceIds = new Set(opportunities.map((opportunity) => opportunity.id));
  const context = contextFor(profile);
  return getOpportunityUpdates()
    .filter((update) => sourceIds.has(update.opportunity.id))
    .filter((update) => update.badge === "NEW" && daysSince(update.date, now) <= 7)
    .map((update) => ({ opportunity: update.opportunity, score: scoreOpportunityIntelligence(update.opportunity, context) }))
    .filter(({ score }) => score.score >= 55)
    .sort((a, b) => b.score.score - a.score.score || a.opportunity.title.localeCompare(b.opportunity.title))
    .slice(0, 3)
    .map(({ opportunity, score }) => ({
      id: `new-opportunity-${opportunity.id}`,
      type: "new_opportunity" as const,
      priority: notificationPriority(score.priority),
      title: `New match: ${opportunity.title}`,
      body: `${opportunity.organization} added a listing that fits your profile.`,
      reason: score.reasons[0] ?? "New this week and relevant to your major, year, or goals.",
      actionLabel: "Review match",
      actionHref: `/opportunities/${opportunity.id}`,
      relatedOpportunityId: opportunity.id,
      generatedAt: isoNow(now),
      knowledgeReferences: mergeKnowledgeReferences(opportunityKnowledgeReferences(opportunity), advisorRuleKnowledgeReference("new_opportunity_notification")),
    }));
}

function roadmapNotifications(profile: AdvisorProfile, opportunities: readonly Opportunity[], progress: StudentProgress | undefined, now: Date): AdvisorNotification[] {
  const timeline = buildAdvisorTimeline({ advisorProfile: profile, opportunities, progress });
  const nextMonth = timeline.items.find((item) => item.period === "This Month");
  if (!nextMonth?.milestone) return [];
  return [{
    id: `roadmap-${nextMonth.milestone.id}`,
    type: "roadmap_update",
    priority: "Recommended",
    title: `Roadmap update: ${nextMonth.title}`,
    body: nextMonth.description,
    reason: nextMonth.reason,
    actionLabel: "Open roadmap",
    actionHref: "/",
    relatedMilestoneId: nextMonth.milestone.id,
    generatedAt: isoNow(now),
    knowledgeReferences: mergeKnowledgeReferences(nextMonth.knowledgeReferences, advisorRuleKnowledgeReference("roadmap_update_notification")),
  }];
}

function milestoneNotifications(profile: AdvisorProfile, progress: StudentProgress | undefined, now: Date): AdvisorNotification[] {
  const roadmap = getRoadmap(profile, progress);
  return roadmap.upcomingMilestones
    .slice(0, 2)
    .map((milestone) => ({
      id: `milestone-${milestone.id}`,
      type: "milestone_reminder" as const,
      priority: milestonePriority(milestone),
      title: `Next milestone: ${milestone.title}`,
      body: milestone.description,
      reason: `${milestone.title} is recommended for ${milestone.recommendedYear.toLowerCase()} ${profile.academics.major} students.`,
      actionLabel: "Review next step",
      actionHref: "/",
      relatedMilestoneId: milestone.id,
      generatedAt: isoNow(now),
      knowledgeReferences: mergeKnowledgeReferences(milestoneKnowledgeReferences(milestone), advisorRuleKnowledgeReference("milestone_reminder")),
    }));
}

function weeklyDigestNotification(profile: AdvisorProfile, opportunities: readonly Opportunity[], progress: StudentProgress | undefined, now: Date): AdvisorNotification[] {
  const digest = buildWeeklyAdvisorDigest({ advisorProfile: profile, opportunities, progress, now });
  const top = digest.topRecommendation;
  return [{
    id: `weekly-digest-${digest.weekOf}`,
    type: "weekly_digest",
    priority: "Recommended",
    title: "Your weekly UnlockED advisor digest is ready",
    body: digest.summary,
    reason: top?.reason ?? digest.advisorInsight.reason,
    actionLabel: "Open dashboard",
    actionHref: "/",
    relatedOpportunityId: top?.relatedOpportunityId,
    relatedMilestoneId: top?.relatedMilestoneId ?? digest.recommendedMilestone.id,
    generatedAt: isoNow(now),
    knowledgeReferences: mergeKnowledgeReferences(digest.knowledgeReferences, advisorRuleKnowledgeReference("weekly_digest_notification")),
  }];
}

function uniqueNotifications(notifications: AdvisorNotification[]) {
  const seen = new Set<string>();
  return notifications.filter((notification) => {
    if (seen.has(notification.id)) return false;
    seen.add(notification.id);
    return true;
  });
}

export function buildNotificationIntelligence(input: NotificationIntelligenceInput): NotificationIntelligenceResult {
  const now = input.now ?? new Date();
  const opportunities = input.opportunities ?? catalogOpportunities;
  const generated = [
    ...deadlineNotifications(input.advisorProfile, opportunities, now),
    ...newOpportunityNotifications(input.advisorProfile, opportunities, now),
    ...roadmapNotifications(input.advisorProfile, opportunities, input.progress, now),
    ...milestoneNotifications(input.advisorProfile, input.progress, now),
    ...(input.includeWeeklyDigest ?? true ? weeklyDigestNotification(input.advisorProfile, opportunities, input.progress, now) : []),
  ];

  const notifications = uniqueNotifications(generated)
    .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority] || a.title.localeCompare(b.title))
    .slice(0, input.limit ?? 10);

  return {
    notifications,
    generatedAt: isoNow(now),
    inputs: {
      major: input.advisorProfile.academics.major,
      year: input.advisorProfile.academics.academicYear,
      notificationCount: notifications.length,
    },
  };
}
