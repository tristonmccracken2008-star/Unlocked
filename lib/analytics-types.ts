export const analyticsEvents = [
  "page_visit",
  "homepage_visit",
  "dashboard_visit",
  "journey_opened",
  "discover_opened",
  "search",
  "search_performed",
  "filter_applied",
  "opportunity_view",
  "opportunity_saved",
  "status_changed",
  "application_recorded",
  "for_you_opened",
  "recommendation_viewed",
  "recommendation_clicked",
  "upgrade_preview_viewed",
  "upgrade_clicked",
  "milestone_completed",
  "recap_viewed",
  "share_card_generated",
  "share_initiated",
  "share_completed",
  "sign_in",
  "onboarding_completed",
  "report_outdated",
] as const;
export type AnalyticsEventName = (typeof analyticsEvents)[number];
export type AnalyticsEventProperties = {
  opportunityId?: string;
  recommendationId?: string;
  milestoneId?: string;
  status?: string;
  section?: string;
  searchType?: "school" | "major" | "global" | "opportunity";
  searchValue?: string;
  filterName?: string;
  filterValue?: string;
};
export type AnalyticsSummary = { dailyUsers: number; weeklyUsers: number; mostViewed: [string, number][]; searchedSchools: [string, number][]; searchedMajors: [string, number][]; mostSaved: [string, number][]; funnel: { homepage: number; onboarding: number; dashboard: number } };
