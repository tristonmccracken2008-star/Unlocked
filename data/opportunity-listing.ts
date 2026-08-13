import type { Opportunity, OpportunityDifficulty, OpportunityType } from "./opportunities";
import type { OpportunityLifecycleConfidence, OpportunityLifecycleDisplayState, OpportunityLifecycleState } from "./opportunity-lifecycle-types";

// Client-safe listing primitives. This module must never import the opportunity catalog at runtime.
export const listingOpportunityTypes = ["Benefit", "AI", "Career", "Research", "Scholarship"] as const satisfies readonly OpportunityType[];
export const listingDifficultyOptions = ["Open", "Competitive", "Highly Competitive"] as const satisfies readonly Exclude<OpportunityDifficulty, null>[];

export type DiscoverSortMode = "Relevant" | "Newest" | "Deadline" | "Alphabetical";

export type DiscoverRecovery = {
  filter: "type" | "category" | "major" | "school" | "paid" | "remote" | "difficulty" | "freshmanFriendly" | "deadline";
  label: string;
  resultCount: number;
};

export type DiscoverCatalogPayload = {
  opportunities: OpportunityListing[];
  total: number;
  limit: number;
  recovery: DiscoverRecovery | null;
  facets: {
    categories: string[];
    majors: string[];
    typeCounts: Record<string, number>;
    explorationCounts: Record<string, number>;
  };
};

export type DiscoverExplorationPath = {
  label: string;
  description: string;
  type?: OpportunityType;
  category?: string;
};

// These are catalog navigation paths, not personalized recommendations.
export const discoverExplorationPaths: readonly DiscoverExplorationPath[] = [
  { label: "Scholarships", description: "Funding for tuition, projects, and study", type: "Scholarship" },
  { label: "Internships", description: "Practical experience across industries", type: "Career", category: "Internships" },
  { label: "Research", description: "Labs, summer programs, and faculty projects", type: "Research" },
  { label: "Fellowships", description: "Selective academic and career programs", type: "Career", category: "Fellowships" },
  { label: "AI tools", description: "Assistants for learning, writing, and projects", type: "AI" },
  { label: "Student benefits", description: "Discounts and services for students", type: "Benefit" },
] as const;

export const discoverSearchStarters = [
  "Paid summer research",
  "First-year internships",
  "Money for college",
  "Remote student tools",
] as const;

export type OpportunityLifecyclePresentation = {
  state: OpportunityLifecycleState;
  displayState: OpportunityLifecycleDisplayState;
  confidence: OpportunityLifecycleConfidence;
  label: string;
  actionable: boolean;
  recommendationEligible: boolean;
  recurring: boolean;
  actionLabel: "View official application" | "View official source";
  actionAllowed: boolean;
};

export type OpportunityListing = Opportunity & {
  lifecyclePresentation?: OpportunityLifecyclePresentation;
};

export function listingDeadlineLabel(item: Pick<Opportunity, "application_deadline" | "type" | "metadata">) {
  if (item.application_deadline) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${item.application_deadline}T00:00:00Z`));
  }
  if (item.metadata.deadlineType === "rolling") return "Rolling";
  if (item.metadata.deadlineType === "varies") return item.type === "Scholarship" ? "Deadline varies" : "Varies by role or site";
  if (item.metadata.deadlineType === "current_cycle_closed") return "Applications currently closed";
  if (item.metadata.deadlineType === "no_deadline") return "No application deadline";
  if (item.metadata.deadlineType === "unknown") return "Deadline unknown";
  return "Not announced";
}
