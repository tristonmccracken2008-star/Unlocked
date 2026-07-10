import type { Opportunity } from "./opportunities";
import type { RoadmapMilestone } from "./roadmap-engine";
import type { StudentProfile } from "./student-profile";

export type KnowledgeDomain = "major" | "career" | "skill" | "opportunity_type" | "advisor_rule";

export type MajorKnowledgeId = `major:${string}`;
export type CareerKnowledgeId = `career:${string}`;
export type SkillKnowledgeId = `skill:${string}`;
export type OpportunityTypeKnowledgeId = `opportunity_type:${string}`;
export type AdvisorRuleKnowledgeId = `advisor_rule:${string}`;

export type KnowledgeId =
  | MajorKnowledgeId
  | CareerKnowledgeId
  | SkillKnowledgeId
  | OpportunityTypeKnowledgeId
  | AdvisorRuleKnowledgeId;

export type KnowledgeReferences = {
  majors: MajorKnowledgeId[];
  careers: CareerKnowledgeId[];
  skills: SkillKnowledgeId[];
  opportunityTypes: OpportunityTypeKnowledgeId[];
  advisorRules: AdvisorRuleKnowledgeId[];
};

export type KnowledgeReferenceEnvelope = {
  knowledgeReferences: KnowledgeReferences;
};

export const emptyKnowledgeReferences = (): KnowledgeReferences => ({
  majors: [],
  careers: [],
  skills: [],
  opportunityTypes: [],
  advisorRules: [],
});

function slug(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function unique<T extends string>(items: T[]) {
  return [...new Set(items.filter(Boolean))];
}

export function knowledgeId(domain: "major", value: string): MajorKnowledgeId;
export function knowledgeId(domain: "career", value: string): CareerKnowledgeId;
export function knowledgeId(domain: "skill", value: string): SkillKnowledgeId;
export function knowledgeId(domain: "opportunity_type", value: string): OpportunityTypeKnowledgeId;
export function knowledgeId(domain: "advisor_rule", value: string): AdvisorRuleKnowledgeId;
export function knowledgeId(domain: KnowledgeDomain, value: string): KnowledgeId {
  return `${domain}:${slug(value || "unknown")}` as KnowledgeId;
}

export function mergeKnowledgeReferences(...groups: (KnowledgeReferences | undefined)[]): KnowledgeReferences {
  return {
    majors: unique(groups.flatMap((group) => group?.majors ?? [])),
    careers: unique(groups.flatMap((group) => group?.careers ?? [])),
    skills: unique(groups.flatMap((group) => group?.skills ?? [])),
    opportunityTypes: unique(groups.flatMap((group) => group?.opportunityTypes ?? [])),
    advisorRules: unique(groups.flatMap((group) => group?.advisorRules ?? [])),
  };
}

export function profileKnowledgeReferences(profile: Pick<StudentProfile, "major" | "careerGoal" | "interests" | "goals" | "topics" | "preferredOpportunityTypes">): KnowledgeReferences {
  return {
    majors: profile.major ? [knowledgeId("major", profile.major)] : [],
    careers: unique([profile.careerGoal, ...(profile.goals ?? [])].filter(Boolean).map((value) => knowledgeId("career", value))),
    skills: unique([profile.interests, ...(profile.topics ?? [])].flatMap((value) => value.split(",").map((part) => part.trim()).filter(Boolean)).map((value) => knowledgeId("skill", value))),
    opportunityTypes: unique((profile.preferredOpportunityTypes ?? []).map((value) => knowledgeId("opportunity_type", value))),
    advisorRules: [],
  };
}

export function opportunityKnowledgeReferences(opportunity: Pick<Opportunity, "majors" | "type" | "category" | "tags">): KnowledgeReferences {
  return {
    majors: unique(opportunity.majors.filter((major) => major !== "Any Major").map((major) => knowledgeId("major", major))),
    careers: [],
    skills: unique(opportunity.tags.map((tag) => knowledgeId("skill", tag))),
    opportunityTypes: unique([opportunity.type, opportunity.category].map((value) => knowledgeId("opportunity_type", value))),
    advisorRules: [],
  };
}

export function milestoneKnowledgeReferences(milestone: Pick<RoadmapMilestone, "major" | "requiredSkills" | "relatedOpportunityCategories">): KnowledgeReferences {
  return {
    majors: milestone.major && milestone.major !== "General" ? [knowledgeId("major", milestone.major)] : [],
    careers: [],
    skills: unique(milestone.requiredSkills.map((skill) => knowledgeId("skill", skill))),
    opportunityTypes: unique(milestone.relatedOpportunityCategories.map((category) => knowledgeId("opportunity_type", category))),
    advisorRules: [],
  };
}

export function advisorRuleKnowledgeReference(rule: string): KnowledgeReferences {
  return {
    ...emptyKnowledgeReferences(),
    advisorRules: [knowledgeId("advisor_rule", rule)],
  };
}
