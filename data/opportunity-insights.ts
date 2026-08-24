export const insightsPeriods = ["all", "current_year", "previous_year"] as const;
export type InsightsPeriod = (typeof insightsPeriods)[number];

export type InsightCoverage = "fully_supported" | "partially_supported" | "unavailable";

export type InsightCoverageRecord = {
  level: InsightCoverage;
  detail: string;
};

export type OpportunityInsightsModel = {
  period: InsightsPeriod;
  periodLabel: string;
  recordedSince?: string;
  sparse: boolean;
  overview: {
    activeJourney: number;
    applicationsSubmitted: number;
    outcomesRecorded: number;
    accomplishments: number;
  };
  applications: {
    submitted: number;
    awaiting: number;
    accepted: number;
    notSelected: number;
    withdrawnOrDeclined: number;
    datedSubmissions: number;
    coverage: InsightCoverageRecord;
  };
  progression: Array<{ id: "pursued" | "submitted" | "accepted" | "completed"; label: string; count: number }>;
  categories: Array<{
    id: string;
    label: string;
    pursued: number;
    completed: number;
    discoverHref: string;
  }>;
  activity: Array<{
    month: string;
    label: string;
    added: number;
    submitted: number;
    outcomes: number;
    completed: number;
    total: number;
  }>;
  accomplishments: {
    total: number;
    groups: Array<{ label: string; count: number }>;
  };
  paths: Array<{
    id: string;
    name: string;
    followed: boolean;
    completed: number;
    inJourney: number;
    watching: number;
    stages: Array<{ name: string; completed: number; inJourney: number; watching: number }>;
  }>;
  materials: {
    reuse: Array<{ materialId: string; title: string; typeLabel: string; applicationCount: number }>;
    requirements: Array<{ type: string; label: string; applicationCount: number }>;
  };
  watch: { current: number; coverage: InsightCoverageRecord };
  seasonality?: { month: string; count: number; detail: string };
  annual: Array<{
    year: string;
    pursued: number;
    submitted: number;
    outcomes: number;
    accomplishments: number;
    materialSelections: number;
  }>;
  coverage: {
    lifecycle: InsightCoverageRecord;
    watchHistory: InsightCoverageRecord;
    recommendationAttribution: InsightCoverageRecord;
    discoverySource: InsightCoverageRecord;
    academicYear: InsightCoverageRecord;
  };
};
