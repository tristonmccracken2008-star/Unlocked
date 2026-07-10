import type { AdvisorProfile } from "./advisor-engine";
import { getOpportunityIntelligence } from "./opportunity-intelligence";
import type { Opportunity } from "./opportunities";
import type { RoadmapMilestone, RoadmapMilestoneCategory } from "./roadmap-engine";
import { getMilestoneStatus, type MilestoneStatus, type StudentProgress } from "./student-progress";

export type MilestoneCategory = RoadmapMilestoneCategory;

export type Milestone = {
  id: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  estimatedEffort: RoadmapMilestone["estimatedEffort"];
  recommendedSemester: RoadmapMilestone["recommendedSemester"];
  requiredBefore: string[];
  unlocks: string[];
  completionState: MilestoneStatus;
  completionDate?: string;
  relatedOpportunityCategories: string[];
  requiredSkills: string[];
};

export type MilestoneOpportunityConnection = {
  milestoneId: string;
  opportunityId: string;
  reasons: string[];
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();

export function inferMilestoneCategory(milestone: Pick<RoadmapMilestone, "title" | "relatedOpportunityCategories" | "requiredSkills">): MilestoneCategory {
  const text = normalize([milestone.title, ...milestone.relatedOpportunityCategories, ...milestone.requiredSkills].join(" "));
  if (/scholarship|funding|grant/.test(text)) return "Funding";
  if (/research|lab|faculty/.test(text)) return "Research";
  if (/leadership|club|organization|mentor/.test(text)) return "Leadership";
  if (/resume|career|internship|interview|network/.test(text)) return "Career";
  if (/excel|python|skill|project|technical|portfolio/.test(text)) return "Skill Building";
  if (/course|advisor|academic/.test(text)) return "Academic";
  return "Exploration";
}

export function getCompletionDate(progress: StudentProgress | undefined, milestoneId: string) {
  return progress?.milestones[milestoneId]?.completedDate;
}

export function toMilestone(milestone: RoadmapMilestone, progress?: StudentProgress): Milestone {
  const completionState = progress ? getMilestoneStatus(progress, milestone.id) : milestone.completionStatus;
  return {
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    category: milestone.category ?? inferMilestoneCategory(milestone),
    estimatedEffort: milestone.estimatedEffort,
    recommendedSemester: milestone.recommendedSemester,
    requiredBefore: milestone.requiredBefore ?? milestone.recommendedBefore,
    unlocks: milestone.unlocks ?? milestone.recommendedAfter,
    completionState,
    completionDate: getCompletionDate(progress, milestone.id),
    relatedOpportunityCategories: milestone.relatedOpportunityCategories,
    requiredSkills: milestone.requiredSkills,
  };
}

export function getMilestoneOpportunityConnections(milestone: Milestone, opportunities: readonly Opportunity[]) {
  return opportunities.flatMap((opportunity): MilestoneOpportunityConnection[] => {
    const intelligence = getOpportunityIntelligence(opportunity);
    const categoryMatch = milestone.relatedOpportunityCategories.includes(intelligence.category);
    const skillMatch = milestone.requiredSkills.filter((skill) => intelligence.requiredSkills.includes(skill) || intelligence.preferredSkills.includes(skill));
    if (!categoryMatch && !skillMatch.length) return [];
    return [{
      milestoneId: milestone.id,
      opportunityId: opportunity.id,
      reasons: [
        ...(categoryMatch ? [`Opportunity category matches milestone category: ${intelligence.category}.`] : []),
        ...(skillMatch.length ? [`Builds milestone skill: ${skillMatch[0]}.`] : []),
      ],
    }];
  });
}

export function getMilestoneForAdvisor(profile: AdvisorProfile, milestone: RoadmapMilestone, progress?: StudentProgress) {
  const structured = toMilestone(milestone, progress);
  return {
    ...structured,
    advisorStage: profile.academics.timelineStage,
    advisorMajor: profile.academics.major,
    whyNow: `${structured.title} fits a ${profile.academics.timelineStage.toLowerCase()} ${profile.academics.major} roadmap because it should happen before ${structured.requiredBefore[0] ?? "the next major application window"}.`,
  };
}
