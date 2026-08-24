export const universalSearchGroups = ["Materials", "Paths", "Accomplishments", "Your Journey", "Upcoming", "Application tasks", "Opportunities"] as const;

export type UniversalSearchGroup = (typeof universalSearchGroups)[number];
export type UniversalSearchKind = "material" | "path" | "accomplishment" | "journey" | "deadline" | "task" | "opportunity";

export type UniversalSearchResult = {
  id: string;
  kind: UniversalSearchKind;
  group: UniversalSearchGroup;
  title: string;
  subtitle: string;
  href: string;
  score: number;
};

export type UniversalSearchPayload = {
  query: string;
  results: UniversalSearchResult[];
  totalOpportunityMatches: number;
};
