export const opportunityCollectionVersion = 1 as const;

export type OpportunityCollectionArchetype = "situation" | "goal" | "experience" | "timing" | "discovery";
export type OpportunityCollectionSelector =
  | { kind: "first_year" }
  | { kind: "research" }
  | { kind: "summer" }
  | { kind: "scholarship" }
  | { kind: "explorer_area"; areaId: string; terms?: readonly string[] }
  | { kind: "competition" }
  | { kind: "international" }
  | { kind: "transfer" }
  | { kind: "open_now" }
  | { kind: "deadline_window"; days: number }
  | { kind: "next_cycle" }
  | { kind: "unfamiliar_ecosystems" };

export type OpportunityCollectionThreshold = {
  minimumSafe: number;
  minimumOrganizations: number;
  minimumCategories: number;
  minimumTypes?: number;
  requireVerifiedDeadlineShare?: number;
  requireExplicitEligibilityShare?: number;
};

export type OpportunityCollectionDefinition = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  archetype: OpportunityCollectionArchetype;
  selector: OpportunityCollectionSelector;
  threshold: OpportunityCollectionThreshold;
  discoverHref: string;
  explorerAreaId?: string;
  pathId?: string;
  profileAliases: readonly string[];
  factualLabel: string;
};

const defaultThreshold = { minimumSafe: 5, minimumOrganizations: 4, minimumCategories: 2, minimumTypes: 2 } as const;

export const opportunityCollections: readonly OpportunityCollectionDefinition[] = [
  { id: "first-year", title: "First-Year Opportunities", shortTitle: "First Year", description: "Opportunities with positively supported first-year eligibility.", archetype: "situation", selector: { kind: "first_year" }, threshold: { ...defaultThreshold, minimumSafe: 8, minimumOrganizations: 7, requireExplicitEligibilityShare: 1 }, discoverHref: "/opportunities?freshmanFriendly=true", profileAliases: ["First year", "Freshman"], factualLabel: "Verified first-year eligibility" },
  { id: "research-starter", title: "Research Starter Pack", shortTitle: "Research", description: "Undergraduate research programs, laboratories, and project funding worth knowing about.", archetype: "goal", selector: { kind: "research" }, threshold: { ...defaultThreshold, minimumSafe: 6, minimumOrganizations: 6, minimumTypes: 1 }, discoverHref: "/opportunities?type=Research", explorerAreaId: "research-science", pathId: "research-graduate-study", profileAliases: ["Research", "Graduate School", "Biology", "Chemistry", "Physics"], factualLabel: "Undergraduate research" },
  { id: "summer", title: "Summer Opportunities", shortTitle: "Summer", description: "Programs with explicit summer timing in verified catalog data.", archetype: "timing", selector: { kind: "summer" }, threshold: { ...defaultThreshold, minimumSafe: 8, minimumOrganizations: 7 }, discoverHref: "/opportunities?query=summer", profileAliases: ["Summer opportunities"], factualLabel: "Explicit summer timing" },
  { id: "scholarships", title: "Scholarships", shortTitle: "Scholarships", description: "Verified funding opportunities from official sources.", archetype: "experience", selector: { kind: "scholarship" }, threshold: { ...defaultThreshold, minimumSafe: 6, minimumOrganizations: 6, minimumTypes: 1 }, discoverHref: "/opportunities?type=Scholarship", profileAliases: ["Scholarships", "Financial support", "Funding"], factualLabel: "Verified scholarship" },
  { id: "finance-quant", title: "Finance & Quant", shortTitle: "Finance & Quant", description: "Finance, quantitative, economics, and analytical programs worth knowing about.", archetype: "goal", selector: { kind: "explorer_area", areaId: "business-finance", terms: ["finance", "quant", "economic", "bank", "market", "business"] }, threshold: { ...defaultThreshold, minimumSafe: 7, minimumOrganizations: 6 }, discoverHref: "/opportunities?major=Finance", explorerAreaId: "mathematics-data", pathId: "quantitative-data", profileAliases: ["Finance", "Economics", "Quantitative Finance", "Mathematics", "Accounting"], factualLabel: "Finance or quantitative program" },
  { id: "computer-science", title: "Computer Science", shortTitle: "Computer Science", description: "Software, cybersecurity, technical research, and computing programs.", archetype: "goal", selector: { kind: "explorer_area", areaId: "computer-science" }, threshold: { ...defaultThreshold, minimumSafe: 8, minimumOrganizations: 7 }, discoverHref: "/opportunities?major=Computer%20Science", explorerAreaId: "computer-science", pathId: "software-cybersecurity", profileAliases: ["Computer Science", "Software Engineering", "Cybersecurity", "Data Science", "AI"], factualLabel: "Computing opportunity" },
  { id: "public-service", title: "Public Service", shortTitle: "Public Service", description: "Government, policy, civic, and public-institution programs.", archetype: "goal", selector: { kind: "explorer_area", areaId: "public-policy-service" }, threshold: { ...defaultThreshold, minimumSafe: 8, minimumOrganizations: 7 }, discoverHref: "/opportunities?category=Public%20Service", explorerAreaId: "public-policy-service", pathId: "public-policy-service", profileAliases: ["Public Policy", "Political Science", "Government", "Public Service", "Law"], factualLabel: "Public-service program" },
  { id: "humanities", title: "Humanities & Culture", shortTitle: "Humanities", description: "Writing, museums, archives, cultural institutions, research, and public work.", archetype: "goal", selector: { kind: "explorer_area", areaId: "humanities-communication" }, threshold: { ...defaultThreshold, minimumSafe: 7, minimumOrganizations: 6 }, discoverHref: "/opportunities?major=English", explorerAreaId: "humanities-communication", pathId: "journalism-public-humanities", profileAliases: ["English", "History", "Humanities", "Writing", "Journalism", "Communications"], factualLabel: "Humanities or cultural program" },
  { id: "competitions", title: "Competitions", shortTitle: "Competitions", description: "Structured challenges where students build, analyze, present, or compete.", archetype: "experience", selector: { kind: "competition" }, threshold: { ...defaultThreshold, minimumSafe: 5, minimumOrganizations: 5, minimumTypes: 1 }, discoverHref: "/opportunities?category=Competitions", profileAliases: ["Competitions", "Hackathons"], factualLabel: "Student competition" },
  { id: "international-friendly", title: "International-Friendly", shortTitle: "International", description: "Opportunities with explicit evidence supporting international eligibility.", archetype: "situation", selector: { kind: "international" }, threshold: { ...defaultThreshold, minimumSafe: 6, minimumOrganizations: 6, requireExplicitEligibilityShare: 1 }, discoverHref: "/opportunities?query=international", profileAliases: ["International student"], factualLabel: "International eligibility supported" },
  { id: "transfer-friendly", title: "Transfer-Friendly", shortTitle: "Transfer Students", description: "Opportunities with explicit transfer-student eligibility.", archetype: "situation", selector: { kind: "transfer" }, threshold: { ...defaultThreshold, minimumSafe: 5, minimumOrganizations: 5, requireExplicitEligibilityShare: 1 }, discoverHref: "/opportunities?query=transfer", profileAliases: ["Transfer student", "Community college"], factualLabel: "Transfer eligibility supported" },
  { id: "open-now", title: "Applications Open Now", shortTitle: "Open Now", description: "Verified opportunities with an actionable current application cycle.", archetype: "timing", selector: { kind: "open_now" }, threshold: { ...defaultThreshold, minimumSafe: 8, minimumOrganizations: 8 }, discoverHref: "/opportunities?deadline=open", profileAliases: [], factualLabel: "Applications open" },
  { id: "deadlines-coming-up", title: "Deadlines Coming Up", shortTitle: "Deadlines", description: "Verified application deadlines within the next 60 days.", archetype: "timing", selector: { kind: "deadline_window", days: 60 }, threshold: { ...defaultThreshold, minimumSafe: 5, minimumOrganizations: 5, requireVerifiedDeadlineShare: 1 }, discoverHref: "/opportunities?deadline=open&sort=Deadline", profileAliases: [], factualLabel: "Verified deadline" },
  { id: "next-cycle", title: "Worth Watching for Next Cycle", shortTitle: "Next Cycle", description: "Strong recurring opportunities with a supported future cycle.", archetype: "timing", selector: { kind: "next_cycle" }, threshold: { ...defaultThreshold, minimumSafe: 5, minimumOrganizations: 5 }, discoverHref: "/opportunities?deadline=recurring", profileAliases: [], factualLabel: "Recurring opportunity" },
  { id: "unexpected", title: "Opportunities You Might Not Know Exist", shortTitle: "Something Different", description: "National laboratories, museums, public agencies, competitions, and specialized programs.", archetype: "discovery", selector: { kind: "unfamiliar_ecosystems" }, threshold: { ...defaultThreshold, minimumSafe: 8, minimumOrganizations: 8 }, discoverHref: "/opportunities", profileAliases: [], factualLabel: "Specialized opportunity ecosystem" },
] as const;

export function opportunityCollectionById(id: string) {
  return opportunityCollections.find((collection) => collection.id === id);
}
