export const universalSearchGroups = [
  "My College List",
  "Colleges",
  "Activities & Experiences",
  "Passport",
  "Careers",
  "Collections",
  "Explore",
  "Resume Lab",
  "Materials",
  "Paths",
  "Accomplishments",
  "Your Journey",
  "Upcoming",
  "Application tasks",
  "Opportunities",
] as const;

export type UniversalSearchGroup = (typeof universalSearchGroups)[number];
export type UniversalSearchKind =
  | "college"
  | "college_application"
  | "experience"
  | "passport"
  | "career"
  | "collection"
  | "explorer"
  | "resume"
  | "material"
  | "path"
  | "accomplishment"
  | "journey"
  | "deadline"
  | "task"
  | "opportunity";

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
