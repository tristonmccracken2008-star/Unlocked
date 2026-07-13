export const analyticsEvents = [
  "page_visit",
  "homepage_visit",
  "dashboard_visit",
  "journey_opened",
  "journey_profile_edit_clicked",
  "journey_summary_card_clicked",
  "journey_timeline_item_opened",
  "journey_active_opportunity_opened",
  "journey_recommendation_opened",
  "journey_recommendation_reason_expanded",
  "journey_recap_share_started",
  "journey_recap_downloaded",
  "journey_board_opened",
  "college_journey_summary_viewed",
  "journey_card_generator_opened",
  "journey_card_format_changed",
  "journey_card_theme_changed",
  "journey_card_privacy_changed",
  "journey_card_generated",
  "journey_card_downloaded",
  "journey_card_share_started",
  "journey_card_share_completed",
  "journey_card_copy_link_clicked",
  "milestone_share_prompt_viewed",
  "milestone_share_prompt_clicked",
  "discover_opened",
  "search",
  "search_performed",
  "filter_applied",
  "opportunity_view",
  "opportunity_added_to_journey",
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
  "recommendation_saved",
  "recommendation_ignored",
  "recommendation_added_to_journey",
  "recommendation_explanation_expanded",
  "recommendation_refresh",
  "upgrade_preview_viewed",
  "upgrade_clicked",
  "pricing_viewed",
  "pro_plan_selected",
  "checkout_started",
  "checkout_redirected",
  "checkout_completed",
  "checkout_canceled",
  "subscription_activated",
  "subscription_renewed",
  "subscription_payment_failed",
  "subscription_canceled",
  "customer_portal_opened",
  "pro_gate_viewed",
  "pro_upgrade_clicked",
  "premium_theme_previewed",
  "premium_theme_upgrade_clicked",
  "premium_journey_theme_selected",
  "milestone_completed",
  "milestone_unlocked",
  "journey_filter_changed",
  "recap_viewed",
  "share_card_generated",
  "share_initiated",
  "share_completed",
  "sign_in",
  "onboarding_started",
  "onboarding_step_viewed",
  "onboarding_step_completed",
  "onboarding_back_clicked",
  "onboarding_validation_failed",
  "onboarding_completed",
  "onboarding_save_failed",
  "report_outdated",
  "referral_link_opened",
  "referral_link_copied",
  "referral_code_copied",
  "referral_share_started",
  "referral_completed",
  "referral_reward_unlocked",
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
  stepId?: string;
  stepIndex?: string;
  stepCount?: string;
  reason?: string;
  referralCode?: string;
  referralReward?: string;
};
export type AnalyticsSummary = { dailyUsers: number; weeklyUsers: number; mostViewed: [string, number][]; searchedSchools: [string, number][]; searchedMajors: [string, number][]; mostSaved: [string, number][]; funnel: { homepage: number; onboarding: number; dashboard: number } };
