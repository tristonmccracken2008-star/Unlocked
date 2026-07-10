import { runAdvisorEngine } from "./advisor-engine";
import type { AdvisorProfile } from "./advisor-engine";
import { buildAdvisorTimeline } from "./advisor-timeline";
import { advisorRuleKnowledgeReference, mergeKnowledgeReferences, milestoneKnowledgeReferences, opportunityKnowledgeReferences, type KnowledgeReferences } from "./knowledge-references";
import { getDeadlineDays, scoreOpportunityIntelligence } from "./opportunity-intelligence";
import { getOpportunityUpdates } from "./opportunity-updates";
import { opportunities as catalogOpportunities, type Opportunity } from "./opportunities";
import { runRecommendationEngineV1, type RecommendationV1 } from "./recommendation-engine";
import { getRoadmap } from "./roadmap-engine";
import type { StudentProgress } from "./student-progress";

export type WeeklyDigestOpportunity = {
  id: string;
  title: string;
  organization: string;
  category: string;
  deadline: string | null;
  reason: string;
  knowledgeReferences: KnowledgeReferences;
};

export type WeeklyAdvisorDigest = {
  generatedAt: string;
  weekOf: string;
  studentName: string;
  summary: string;
  newOpportunities: WeeklyDigestOpportunity[];
  deadlines: WeeklyDigestOpportunity[];
  advisorInsight: {
    title: string;
    description: string;
    reason: string;
  };
  recommendedMilestone: {
    id: string;
    title: string;
    description: string;
    nextAction: string;
  };
  topRecommendation: RecommendationV1 | null;
  knowledgeReferences: KnowledgeReferences;
};

export type WeeklyAdvisorDigestInput = {
  advisorProfile: AdvisorProfile;
  opportunities?: readonly Opportunity[];
  progress?: StudentProgress;
  now?: Date;
};

const msPerDay = 86_400_000;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
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

function digestOpportunity(opportunity: Opportunity, reason: string): WeeklyDigestOpportunity {
  return {
    id: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization,
    category: opportunity.category,
    deadline: opportunity.application_deadline,
    reason,
    knowledgeReferences: opportunityKnowledgeReferences(opportunity),
  };
}

function matchedNewOpportunities(profile: AdvisorProfile, source: readonly Opportunity[], now: Date) {
  const sourceIds = new Set(source.map((opportunity) => opportunity.id));
  const context = contextFor(profile);
  return getOpportunityUpdates()
    .filter((update) => sourceIds.has(update.opportunity.id))
    .filter((update) => update.badge === "NEW" && daysSince(update.date, now) <= 7)
    .map((update) => ({ opportunity: update.opportunity, score: scoreOpportunityIntelligence(update.opportunity, context) }))
    .filter(({ score }) => score.score >= 45)
    .sort((a, b) => b.score.score - a.score.score || a.opportunity.title.localeCompare(b.opportunity.title))
    .slice(0, 5)
    .map(({ opportunity, score }) => digestOpportunity(opportunity, score.reasons[0] ?? "New this week and relevant to your profile."));
}

function upcomingDeadlines(profile: AdvisorProfile, source: readonly Opportunity[], now: Date) {
  const context = contextFor(profile);
  return source
    .filter((opportunity) => opportunity.verification_status !== "expired")
    .map((opportunity) => ({ opportunity, score: scoreOpportunityIntelligence(opportunity, context), days: getDeadlineDays(opportunity, now) }))
    .filter(({ days }) => days !== null && days >= 0 && days <= 14)
    .filter(({ score }) => score.score >= 40)
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999) || b.score.score - a.score.score)
    .slice(0, 5)
    .map(({ opportunity, days, score }) => digestOpportunity(opportunity, days === 0 ? "Deadline is today." : `Deadline is in ${days} day${days === 1 ? "" : "s"}. ${score.reasons[0] ?? ""}`.trim()));
}

export function buildWeeklyAdvisorDigest(input: WeeklyAdvisorDigestInput): WeeklyAdvisorDigest {
  const now = input.now ?? new Date();
  const opportunities = input.opportunities ?? catalogOpportunities;
  const advisor = runAdvisorEngine(input.advisorProfile);
  const roadmap = getRoadmap(input.advisorProfile, input.progress);
  const timeline = buildAdvisorTimeline({ advisorProfile: input.advisorProfile, opportunities, progress: input.progress });
  const recommendationResult = runRecommendationEngineV1({ advisorProfile: input.advisorProfile, opportunities, progress: input.progress, limit: 6 });
  const topRecommendation = recommendationResult.recommendations[0] ?? null;
  const today = timeline.items.find((item) => item.period === "Today's Focus");
  const milestone = roadmap.recommendedMilestone;

  return {
    generatedAt: now.toISOString(),
    weekOf: isoDate(now),
    studentName: input.advisorProfile.student.firstName ?? "there",
    summary: `This week, focus on ${advisor.focus}.`,
    newOpportunities: matchedNewOpportunities(input.advisorProfile, opportunities, now),
    deadlines: upcomingDeadlines(input.advisorProfile, opportunities, now),
    advisorInsight: {
      title: "Advisor insight",
      description: `Your top priority right now is to ${advisor.focus}.`,
      reason: advisor.recommendations[0]?.reasons.slice(0, 2).join(" ") ?? today?.reason ?? "Based on your major, year, career goal, milestones, and opportunity matches.",
    },
    recommendedMilestone: {
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      nextAction: today?.nextAction ?? `Start this before ${milestone.recommendedBefore[0] ?? "your next application window"}.`,
    },
    topRecommendation,
    knowledgeReferences: mergeKnowledgeReferences(
      topRecommendation?.knowledgeReferences,
      milestoneKnowledgeReferences(milestone),
      today?.knowledgeReferences,
      advisorRuleKnowledgeReference("weekly_advisor_digest_v1"),
    ),
  };
}
