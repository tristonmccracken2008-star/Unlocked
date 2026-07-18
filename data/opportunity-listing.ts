import type { Opportunity, OpportunityDifficulty, OpportunityType } from "./opportunities";

// Client-safe listing primitives. This module must never import the opportunity catalog at runtime.
export const listingOpportunityTypes = ["Benefit", "AI", "Career", "Research", "Scholarship"] as const satisfies readonly OpportunityType[];
export const listingDifficultyOptions = ["Open", "Competitive", "Highly Competitive"] as const satisfies readonly Exclude<OpportunityDifficulty, null>[];

export type DiscoverSortMode = "Relevant" | "Newest" | "Deadline" | "Alphabetical";

export type DiscoverCatalogPayload = {
  opportunities: Opportunity[];
  total: number;
  limit: number;
  facets: {
    categories: string[];
    majors: string[];
    typeCounts: Record<string, number>;
  };
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

