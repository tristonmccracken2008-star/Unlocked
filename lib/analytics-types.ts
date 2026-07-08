export const analyticsEvents = ["page_visit", "homepage_visit", "dashboard_visit", "opportunity_view", "search", "opportunity_saved", "sign_in", "onboarding_completed", "report_outdated"] as const;
export type AnalyticsEventName = (typeof analyticsEvents)[number];
export type AnalyticsEventProperties = { opportunityId?: string; searchType?: "school" | "major" | "global"; searchValue?: string };
export type AnalyticsSummary = { dailyUsers: number; weeklyUsers: number; mostViewed: [string, number][]; searchedSchools: [string, number][]; searchedMajors: [string, number][]; mostSaved: [string, number][]; funnel: { homepage: number; onboarding: number; dashboard: number } };
