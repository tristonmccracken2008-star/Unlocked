export const analyticsSchemaVersion = 1 as const;

export const productIntelligenceEvents = {
  journeyViewed: "journey_viewed_v1",
  journeyReturned: "journey_returned_v1",
  waypointClicked: "journey_waypoint_clicked_v1",
  waypointCompleted: "journey_waypoint_completed_v1",
  historyExpanded: "journey_history_expanded_v1",
  historyExplored: "journey_history_explored_v1",
  horizonOpened: "journey_horizon_opened_v1",
  transitionStarted: "journey_transition_started_v1",
  transitionCompleted: "journey_transition_completed_v1",
  transitionFailed: "journey_transition_failed_v1",
  applicationManagementOpened: "journey_application_management_opened_v1",
  pathMomentCreatorOpened: "path_moment_creator_opened_v1",
  pathMomentPrivacyChanged: "path_moment_privacy_changed_v1",
  pathMomentAppearanceChanged: "path_moment_appearance_changed_v1",
  pathMomentPreviewRendered: "path_moment_preview_rendered_v1",
  pathMomentDownloaded: "path_moment_downloaded_v1",
  pathMomentShared: "path_moment_shared_v1",
  pathMomentCopied: "path_moment_copied_v1",
  pathMomentCanceled: "path_moment_canceled_v1",
  semesterStoryCreatorOpened: "semester_story_creator_opened_v1",
  semesterStoryPreviousViewed: "semester_story_previous_viewed_v1",
  semesterStoryComparisonViewed: "semester_story_comparison_viewed_v1",
  semesterStoryPrivacyChanged: "semester_story_privacy_changed_v1",
  semesterStoryAppearanceChanged: "semester_story_appearance_changed_v1",
  semesterStoryDownloaded: "semester_story_downloaded_v1",
  semesterStoryShared: "semester_story_shared_v1",
  semesterStoryCanceled: "semester_story_canceled_v1",
  recommendationOpened: "recommendation_opportunity_opened_v1",
  recommendationSaved: "recommendation_opportunity_saved_v1",
  recommendationStarted: "recommendation_opportunity_started_v1",
  recommendationSubmitted: "recommendation_opportunity_submitted_v1",
  recommendationCompleted: "recommendation_opportunity_completed_v1",
  productHealthTiming: "product_health_timing_v1",
  operationalError: "product_operational_error_v1",
} as const;

export type ProductIntelligenceEventName = (typeof productIntelligenceEvents)[keyof typeof productIntelligenceEvents];

export const legacyAnalyticsEvents = [
  "page_visit", "homepage_visit", "dashboard_visit", "journey_opened", "journey_profile_edit_clicked",
  "journey_summary_card_clicked", "journey_timeline_item_opened", "journey_active_opportunity_opened",
  "journey_board_opened", "college_journey_summary_viewed", "journey_card_generator_opened",
  "journey_card_format_changed", "journey_card_theme_changed", "journey_card_privacy_changed",
  "journey_card_generated", "journey_card_downloaded", "journey_card_share_started",
  "journey_card_share_completed", "journey_card_copy_link_clicked", "milestone_share_prompt_viewed",
  "milestone_share_prompt_clicked", "path_moment_preview_opened", "path_moment_downloaded",
  "path_moment_copied", "path_moment_shared", "discover_opened", "search", "search_performed",
  "filter_applied", "opportunity_view", "opportunity_added_to_journey", "opportunity_saved", "status_changed",
  "opportunity_status_menu_opened", "opportunity_status_changed", "opportunity_drag_started",
  "opportunity_drag_completed", "opportunity_drag_failed", "application_recorded", "for_you_opened",
  "for_you_error", "for_you_auto_retry", "recommendation_viewed", "recommendation_clicked",
  "recommendation_saved", "recommendation_ignored", "recommendation_dismissed", "recommendation_applied",
  "recommendation_completed", "upgrade_preview_viewed", "upgrade_clicked", "pricing_viewed",
  "pro_plan_selected", "checkout_started", "checkout_redirected", "checkout_completed", "checkout_canceled",
  "subscription_activated", "subscription_renewed", "subscription_payment_failed", "subscription_canceled",
  "customer_portal_opened", "pro_gate_viewed", "pro_upgrade_clicked", "premium_theme_previewed",
  "premium_theme_upgrade_clicked", "premium_journey_theme_selected", "milestone_completed", "milestone_unlocked",
  "journey_filter_changed", "sign_in", "sign_out", "onboarding_started", "onboarding_step_viewed",
  "onboarding_step_completed", "onboarding_back_clicked", "onboarding_validation_failed", "onboarding_completed",
  "onboarding_save_failed", "report_outdated", "referral_link_opened", "referral_link_copied",
  "referral_code_copied", "referral_share_started", "referral_completed", "referral_reward_unlocked",
] as const;

export const analyticsEvents = [...legacyAnalyticsEvents, ...Object.values(productIntelligenceEvents)] as const;
export type AnalyticsEventName = (typeof analyticsEvents)[number];

export type AnalyticsEventProperties = {
  opportunityId?: string;
  recommendationId?: string;
  milestoneId?: string;
  status?: string;
  section?: string;
  source?: string;
  action?: string;
  transition?: string;
  format?: string;
  control?: string;
  appearance?: string;
  semesterRelation?: string;
  component?: string;
  metric?: string;
  errorType?: string;
  browser?: string;
  theme?: string;
  deviceClass?: string;
  durationMs?: number;
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

type PropertyKey = keyof AnalyticsEventProperties;
type EventKind = "user_action" | "product_health" | "operational_error";
export type AnalyticsEventDefinition = {
  kind: EventKind;
  purpose: string;
  allowedProperties: readonly PropertyKey[];
  retentionDays: number;
};

const action = (purpose: string, allowedProperties: readonly PropertyKey[] = []): AnalyticsEventDefinition => ({ kind: "user_action", purpose, allowedProperties, retentionDays: 90 });
const timing = (purpose: string): AnalyticsEventDefinition => ({ kind: "product_health", purpose, allowedProperties: ["component", "metric", "durationMs", "browser", "theme", "deviceClass"], retentionDays: 30 });
const error = (purpose: string): AnalyticsEventDefinition => ({ kind: "operational_error", purpose, allowedProperties: ["component", "errorType", "browser", "theme", "deviceClass", "action"], retentionDays: 30 });

export const productIntelligenceDefinitions: Record<ProductIntelligenceEventName, AnalyticsEventDefinition> = {
  journey_viewed_v1: action("Measure whether students reach and understand Journey.", ["status"]),
  journey_returned_v1: action("Measure whether Journey gives students a reason to return."),
  journey_waypoint_clicked_v1: action("Measure whether the current next step is clear.", ["source"]),
  journey_waypoint_completed_v1: action("Measure whether students complete the next step presented by Journey.", ["transition"]),
  journey_history_expanded_v1: action("Measure whether students use historical explanation."),
  journey_history_explored_v1: action("Measure whether students explore all available history."),
  journey_horizon_opened_v1: action("Measure whether students inspect future directions."),
  journey_transition_started_v1: action("Locate friction before a Journey status update.", ["opportunityId", "transition"]),
  journey_transition_completed_v1: action("Measure successful Journey status updates.", ["opportunityId", "transition"]),
  journey_transition_failed_v1: error("Measure safe categories of Journey update failures."),
  journey_application_management_opened_v1: action("Measure whether students need the operational application workspace."),
  path_moment_creator_opened_v1: action("Measure use of Path Moment creation.", ["format"]),
  path_moment_privacy_changed_v1: action("Measure whether privacy controls are useful.", ["control"]),
  path_moment_appearance_changed_v1: action("Measure appearance control use.", ["appearance"]),
  path_moment_preview_rendered_v1: action("Confirm the creator reaches a usable preview.", ["format"]),
  path_moment_downloaded_v1: action("Measure completed Path Moment downloads.", ["format"]),
  path_moment_shared_v1: action("Measure completed native shares.", ["format"]),
  path_moment_copied_v1: action("Measure completed image copies.", ["format"]),
  path_moment_canceled_v1: action("Measure creator abandonment without inspecting content."),
  semester_story_creator_opened_v1: action("Measure use of Semester Story creation.", ["format"]),
  semester_story_previous_viewed_v1: action("Measure whether previous-term recaps are useful.", ["semesterRelation"]),
  semester_story_comparison_viewed_v1: action("Measure use of evidence-based term comparison."),
  semester_story_privacy_changed_v1: action("Measure whether Semester Story privacy controls are useful.", ["control"]),
  semester_story_appearance_changed_v1: action("Measure Semester Story appearance control use.", ["appearance"]),
  semester_story_downloaded_v1: action("Measure completed Semester Story downloads.", ["format"]),
  semester_story_shared_v1: action("Measure completed Semester Story shares.", ["format"]),
  semester_story_canceled_v1: action("Measure Semester Story abandonment without inspecting content."),
  recommendation_opportunity_opened_v1: action("Measure whether a recommendation leads to opportunity review.", ["opportunityId", "recommendationId"]),
  recommendation_opportunity_saved_v1: action("Measure whether a recommendation enters Journey.", ["opportunityId", "recommendationId"]),
  recommendation_opportunity_started_v1: action("Measure whether a recommended opportunity becomes active work.", ["opportunityId", "recommendationId"]),
  recommendation_opportunity_submitted_v1: action("Measure whether a recommended opportunity reaches submission.", ["opportunityId", "recommendationId"]),
  recommendation_opportunity_completed_v1: action("Measure completed recommended opportunities.", ["opportunityId", "recommendationId"]),
  product_health_timing_v1: timing("Aggregate bounded performance timings without retaining individual traces."),
  product_operational_error_v1: error("Aggregate safe error categories without messages, content, or stack traces."),
};

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const safeToken = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const safeStatus = /^(empty|sparse|active|validated|saved|interested|applying|submitted|interview|accepted|paused|rejected|completed)$/i;
const safeFormat = /^(story|square|linkedin)$/;
const safeAppearance = /^(light|dark|midnight|system)$/;
const safeDevice = /^(mobile|tablet|desktop)$/;
const safeBrowser = /^(chromium|webkit|firefox|other)$/;
const safeError = /^(network|timeout|session|security|conflict|invalid_response|invalid_transition|unsupported|export|unavailable|unknown)$/;

function safeString(key: PropertyKey, value: unknown) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().slice(0, 120);
  if (!cleaned) return undefined;
  if (["opportunityId", "recommendationId", "milestoneId"].includes(key)) return identifier.test(cleaned) ? cleaned : undefined;
  if (key === "status") return safeStatus.test(cleaned) ? cleaned.toLowerCase() : undefined;
  if (key === "format") return safeFormat.test(cleaned) ? cleaned : undefined;
  if (key === "appearance" || key === "theme") return safeAppearance.test(cleaned) ? cleaned : undefined;
  if (key === "deviceClass") return safeDevice.test(cleaned) ? cleaned : undefined;
  if (key === "browser") return safeBrowser.test(cleaned) ? cleaned : undefined;
  if (key === "errorType") return safeError.test(cleaned) ? cleaned : undefined;
  if (["component", "metric", "source", "action", "transition", "control", "semesterRelation", "section"].includes(key)) return safeToken.test(cleaned) ? cleaned : undefined;
  if (key === "searchType") return ["school", "major", "global", "opportunity"].includes(cleaned) ? cleaned : undefined;
  if (["stepId", "stepIndex", "stepCount", "filterName", "referralReward"].includes(key)) return safeToken.test(cleaned) ? cleaned : undefined;
  if (key === "searchValue") return cleaned;
  if (key === "filterValue") return !/[{}\[\]"]/u.test(cleaned) ? cleaned : undefined;
  // Free-form reasons, titles, and referral codes are intentionally not accepted.
  return undefined;
}

const legacyAllowed = new Set<PropertyKey>(["opportunityId", "recommendationId", "milestoneId", "status", "section", "searchType", "searchValue", "filterName", "filterValue", "stepId", "stepIndex", "stepCount", "referralReward"]);

export function sanitizeAnalyticsProperties(name: AnalyticsEventName, properties: unknown): AnalyticsEventProperties {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return {};
  const definition = productIntelligenceDefinitions[name as ProductIntelligenceEventName];
  const allowed = new Set<PropertyKey>(definition?.allowedProperties ?? legacyAllowed);
  const result: AnalyticsEventProperties = {};
  for (const [rawKey, rawValue] of Object.entries(properties).sort(([left], [right]) => left.localeCompare(right)).slice(0, 16)) {
    const key = rawKey as PropertyKey;
    if (!allowed.has(key)) continue;
    if (key === "durationMs") {
      const duration = typeof rawValue === "number" ? rawValue : Number.NaN;
      if (Number.isFinite(duration) && duration >= 0) result.durationMs = Math.min(120_000, Math.round(duration));
      continue;
    }
    const value = safeString(key, rawValue);
    if (value !== undefined) (result as Record<string, string | number>)[key] = value;
  }
  // Search values are retained only for explicit school/major catalog searches.
  if (result.searchValue && result.searchType !== "school" && result.searchType !== "major") delete result.searchValue;
  return result;
}

export type AnalyticsEnvelope = {
  id: string;
  version: typeof analyticsSchemaVersion;
  name: AnalyticsEventName;
  visitorId: string;
  occurredAt: string;
  properties: AnalyticsEventProperties;
};

export type ProductIntelligenceSummary = {
  journey: { views: number; returns: number; waypointClicks: number; waypointCompletions: number; historyExpansions: number; historyExplorations: number; horizonOpens: number; transitionStarts: number; transitionCompletions: number; transitionFailures: number; applicationManagementOpens: number; transitionSuccessRate: number; waypointCompletionRate: number; historyExpansionRate: number; horizonEngagementRate: number; returnRate: number };
  exports: { creatorOpens: number; downloads: number; shares: number; copies: number; cancellations: number; exportRate: number };
  recommendations: { opens: number; saves: number; starts: number; submissions: number; completions: number; saveRate: number; completionRate: number };
  errors: { total: number; errorRate: number; byComponent: [string, number][] };
  performance: Record<string, { samples: number; averageMs: number; buckets: Record<string, number> }>;
};

export type AnalyticsSummary = {
  dailyUsers: number;
  weeklyUsers: number;
  mostViewed: [string, number][];
  searchedSchools: [string, number][];
  searchedMajors: [string, number][];
  mostSaved: [string, number][];
  funnel: { homepage: number; onboarding: number; dashboard: number };
  productIntelligence: ProductIntelligenceSummary;
};
