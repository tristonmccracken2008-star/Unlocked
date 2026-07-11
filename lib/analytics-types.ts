export const analyticsEvents = [
  "page_visit",
  "homepage_visit",
  "dashboard_visit",
  "journey_opened",
  "journey_board_opened",
  "discover_opened",
  "search",
  "search_performed",
  "filter_applied",
  "opportunity_view",
  "opportunity_saved",
  "status_changed",
  "opportunity_status_menu_opened",
  "opportunity_status_changed",
  "opportunity_drag_started",
  "opportunity_drag_completed",
  "opportunity_drag_failed",
  "application_recorded",
  "for_you_opened",
  "recommendation_viewed",
  "recommendation_clicked",
  "upgrade_preview_viewed",
  "upgrade_clicked",
  "milestone_completed",
  "milestone_unlocked",
  "journey_filter_changed",
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
  milestoneTitle?: string;
};
export type AnalyticsSummary = { dailyUsers: number; weeklyUsers: number; mostViewed: [string, number][]; searchedSchools: [string, number][]; searchedMajors: [string, number][]; mostSaved: [string, number][]; funnel: { homepage: number; onboarding: number; dashboard: number } };
