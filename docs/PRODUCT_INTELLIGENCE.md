# Product Intelligence

UnlockED analytics answer four questions: whether students understood an experience, used it, became blocked, or returned. Analytics are not a student record and are never used to reconstruct a Journey.

## Architecture

`trackProductEvent()` is the only browser transport. It validates properties before writing a bounded local queue, retries after reconnect with exponential backoff, batches up to 20 events, and uses event IDs for server-side idempotency. Account changes and logout discard queued data, the anonymous visitor ID, and recommendation attribution. Global Privacy Control, Do Not Track, and the local disabled setting prevent collection.

`/api/analytics/event` enforces same-origin requests, rate limits, a 32 KiB body limit, schema version, event names, timestamps, identifiers, batch size, and the same property allowlist used in the browser. The store keeps daily aggregates, approximate unique counts, timing buckets, and error counts. It does not retain raw event bodies.

Schema changes require a new event suffix and `analyticsSchemaVersion`. Existing `_v1` meanings and fields must not be repurposed.

## Common Envelope

| Field | Purpose | Privacy |
| --- | --- | --- |
| `id` | Idempotency for retries | Random event ID; retained for two days only as a one-way HMAC key |
| `version` | Payload contract | Integer schema version (`1`) |
| `name` | Stable product question | Allowlisted `_v1` event name |
| `visitorId` | Anonymous aggregate uniqueness | Random browser ID; HMACed before aggregation and rotated on account change/logout |
| `occurredAt` | Daily aggregation | ISO timestamp accepted only within a bounded 25-hour window |
| `properties` | Minimal event context | Per-event allowlist; free-form text is rejected |

Optional context fields are limited to opaque opportunity/recommendation IDs; coarse canonical recommendation category, feed role, and repeat-exposure count; bounded status, action, transition, source, format, appearance, privacy-control, and semester-relation tokens; safe browser/theme/device classes; error categories; and clamped timing values. Position, prose, URLs, names, email, school profile data, GPA, citizenship, financial data, essays, notes, explanations, narrative text, private branches, and exported content are prohibited.

## Notification events

Notification analytics use the same aggregate-only contract. They may retain a bounded notification category, priority, channel, suppression reason, action, and bundled yes/no or capped count. They never retain titles, organizations, email addresses, private reminder wording, Journey notes, opportunity-change values, provider identifiers, or email contents.

- `notification_generated_v1`: a canonical notification record was created.
- `notification_suppressed_v1`: an event was ineligible or blocked for a bounded operational reason.
- `notification_delivered_v1`: a provider webhook confirmed channel delivery.
- `notification_viewed_v1`: the authenticated notification center was loaded.
- `notification_read_v1`: one or all notifications were marked read.
- `notification_dismissed_v1`: a notification was explicitly dismissed.
- `notification_acted_v1`: the primary notification action was selected.
- `notification_preference_changed_v1`: notification settings were saved.
- `notification_digest_generated_v1`: a non-empty optional digest was created.
- `notification_digest_skipped_v1`: an optional digest had no meaningful content.
- `notification_email_bounced_v1`: a provider reported a bounce or complaint using a safe error category.

Provider acceptance is not counted as delivery. Only the signed delivery webhook emits `notification_delivered_v1`.

## Contextual guidance events

Guidance analytics retain only an allowlisted guide ID in `control`. They never include guide copy, profile answers, Journey content, opportunity details, or account identifiers.

- `guide_shown_v1`: an eligible guide was presented.
- `guide_completed_v1`: the user finished or acknowledged a guide.
- `guide_dismissed_v1`: the user dismissed a guide.
- `guide_show_me_clicked_v1`: the user asked to move to the real feature anchor.
- `learn_unlocked_opened_v1`: the permanent Learn UnlockED reference was opened.

## Planner events

Planner analytics are aggregate navigation signals. They never include dates, task text, watched titles, recommendation contents, Journey records, or profile fields.

- `planner_viewed_v1`: the private Planner was opened.
- `calendar_intelligence_opened_v1`: the account-scoped Conflict Planning view was opened.
- `calendar_cluster_opened_v1`: a same-day or multi-day cluster was expanded; no dates, titles, or counts are retained.
- `calendar_cluster_to_application_v1`: a cluster handed off to Applications.
- `calendar_view_changed_v1`: a bounded Calendar view was selected.
- `planner_month_opened_v1`: a calendar month disclosure was opened; only a `YYYY-MM` section token is retained.
- `planner_handoff_v1`: Planner led to Journey, For You, Discover, or Calendar; only the destination and optional canonical category are retained.

## Insights events

`opportunity_insights_opened_v1` measures whether students use their private historical summary. It retains only the fixed section token `insights`; application counts, outcomes, material names, opportunity names, accomplishments, profile data, dates, and chart values are prohibited. Insights itself is a server-side projection of account records and is never reconstructed from product analytics.

## Opportunity Path Events

Path events measure whether goal-oriented exploration leads into existing product workflows. They retain only canonical Path IDs, opaque opportunity IDs, bounded category labels, and action/source labels. They never include profile goals, Path copy, eligibility reasons, Journey notes, accomplishment content, or recommendation explanations.

- `opportunity_path_opened_v1`: a Path was opened.
- `opportunity_path_followed_v1`: an account followed a Path.
- `opportunity_path_unfollowed_v1`: an account unfollowed a Path.
- `opportunity_path_opportunity_opened_v1`: a catalog record was opened from a Path.
- `opportunity_path_to_watch_v1`: passive monitoring changed from a Path.
- `opportunity_path_to_journey_v1`: an opportunity entered the existing Journey workflow from a Path.
- `opportunity_path_to_discover_v1`: a stage handed off to filtered Discover.
- `materials_page_opened_v1`: the private Materials workspace was opened.
- `material_created_v1`: a material record was created; names, notes, and document contents are excluded.
- `material_selected_for_application_v1`: a reusable material was selected for an application; document metadata is excluded.
- `material_archived_v1`: a material record was archived; document metadata is excluded.

## Applications Workspace Events

Applications events measure whether the cross-application workspace helps students reach existing application controls. They retain only bounded state, filter, category, and source tokens. Application titles, organization names, requirement text, task text, Material names, document metadata, dates, outcomes, and private notes are prohibited.

- `applications_workspace_opened_v1`: the private Applications workspace was opened; only `active` or `empty` is retained.
- `application_summary_opened_v1`: an inline application summary was opened; only bounded readiness state and the generic `application` category are retained.
- `application_task_completed_v1`: an existing task update succeeded; only bounded application state and `private` or `verified` source are retained.
- `application_filter_changed_v1`: one of the fixed Applications views was selected.
- `application_command_center_opened_v1`: Applications handed off to the existing single-application Command Center; only bounded readiness state is retained.

## Opportunity Explorer Events

Explorer events measure whether structured exploration leads students toward the existing catalog, Paths, Watch, or Journey. They retain only curated area/type identifiers, opaque opportunity IDs, and bounded action/source labels. They never include profile fields, eligibility details, search text, private history, or recommendation contents.

- `explorer_opened_v1`: Explorer was opened.
- `explorer_area_opened_v1`: a curated field landscape or current example was opened.
- `explorer_type_opened_v1`: an experience-type explanation was opened.
- `explorer_to_discover_v1`: Explorer handed off to deterministic Discover filters.
- `explorer_to_path_v1`: Explorer handed off to an existing Path.
- `explorer_to_watch_v1`: Watch intent changed from Explorer.
- `explorer_to_journey_v1`: an opportunity entered the existing Journey workflow from Explorer.
- `explorer_serendipity_opened_v1`: the deterministic adjacent-area suggestion was opened.

## Opportunity Collection Events

Collection events measure whether curated starting points help students reach the existing catalog, Paths, Watch, or Journey. They retain only curated collection identifiers, opaque opportunity IDs, and bounded action/source labels. They never include profile values, eligibility decisions, search text, or private Journey contents.

- `collections_opened_v1`: the Collections index was opened.
- `collection_opened_v1`: a launched collection or one of its examples was opened.
- `collection_to_discover_v1`: a collection handed off to its deterministic Discover filters.
- `collection_to_path_v1`: a collection handed off to an existing Path.
- `collection_to_watch_v1`: Watch intent changed from a collection.
- `collection_to_journey_v1`: an opportunity entered the existing Journey workflow from a collection.

## Journey Events

All Journey action aggregates are retained for 90 days.

| Event | Allowed fields | Product question |
| --- | --- | --- |
| `journey_viewed_v1` | `status` | Did students reach Journey in a meaningful state? |
| `journey_returned_v1` | none | Did a student return on a later UTC day? |
| `return_briefing_shown_v1` | `status`, `category`, `priority` | Was a concise return briefing available without recording its content? |
| `return_briefing_action_v1` | `category`, `priority`, `action` | Did the briefing lead into an existing product workflow? |
| `return_briefing_dismissed_v1` | `category`, `priority` | Did a student dismiss a non-critical return item? |
| `journey_opportunity_added_v1` | `opportunityId`, `source` | Did an opportunity enter Journey from Discover or For You? |
| `first_opportunity_saved_v1` | `source` | Did the account complete its first server-confirmed save? |
| `activation_achieved_v1` | `source` | Did the account reach the first-session activation definition? |
| `smart_default_interaction_v1` | `action`, `source` | Was a deterministic default accepted, changed, or expanded? |
| `journey_waypoint_clicked_v1` | `source` | Was the current next step clear enough to act on? |
| `journey_waypoint_completed_v1` | `transition` | Did the presented step reach a canonical completion? |
| `journey_history_expanded_v1` | none | Did students ask for historical detail? |
| `journey_history_explored_v1` | none | Did students explore the available history? |
| `journey_horizon_opened_v1` | none | Did students inspect future directions? |
| `journey_transition_started_v1` | `opportunityId`, `transition` | Where does status-update friction begin? |
| `journey_transition_completed_v1` | `opportunityId`, `transition` | Did the canonical transition succeed? |
| `journey_transition_failed_v1` | `component`, `errorType`, `action`, browser/theme/device | Which safe failure category blocked progress? |
| `accomplishment_created_v1` | `source`, `category` | Did a successful Journey outcome create a private accomplishment? |
| `outcome_recorded_v1` | `source`, `category` | Did a student record or refine a factual outcome? |
| `accomplishment_viewed_v1` | none | Did a student open their private college record? |
| `manual_accomplishment_added_v1` | `source`, `category` | Did a student preserve an accomplishment from outside UnlockED? |
| `journey_application_management_opened_v1` | none | Did students need the operational workspace? |
| `journey_card_creator_opened_v1` | `format` | Did students open the privacy-controlled Journey Card creator? |
| `journey_card_downloaded_v1` | `format` | Did a Journey Card download complete? |
| `journey_card_template_selected_v1` | `control` | Which factual card templates help students tell their story? |
| `journey_card_appearance_changed_v1` | `appearance` | Which card appearances are useful? |
| `journey_card_format_changed_v1` | `format` | Which export formats are useful? |
| `journey_card_privacy_changed_v1` | `control` | Which privacy controls are useful, without recording their values? |
| `journey_card_shared_v1` | `format` | Did a native Journey Card share complete? |
| `journey_card_copied_v1` | `format` | Did an image copy complete? |

Journey Card events never include the card headline, identity choice, school, dates, statistics, highlights, image bytes, or share destination.

Return briefing events contain no greeting, item copy, opportunity title, profile answer, notification content, or account identifier. First-save and activation events are emitted only by the authenticated Journey-add service after persistence succeeds. Replayed requests and opportunities already present in Journey do not increment them. They contain no profile answers, recommendation content, or account identifiers in their properties.

Accomplishment events contain no title, organization, notes, description, role, award amount, dates, reflection text, or document data. They record only bounded source/category labels needed to evaluate the feature.

## Path Moment Events

Actions are retained for 90 days. Timing and errors are retained for 30 days.

| Event | Allowed fields | Product question |
| --- | --- | --- |
| `path_moment_creator_opened_v1` | `format` | Was the creator opened? |
| `path_moment_privacy_changed_v1` | `control` | Which privacy controls are useful? The selected value is not collected. |
| `path_moment_appearance_changed_v1` | `appearance` | Is appearance customization used? |
| `path_moment_preview_rendered_v1` | `format` | Did the creator reach a usable preview? |
| `path_moment_downloaded_v1` | `format` | Did a PNG download complete? |
| `path_moment_shared_v1` | `format` | Did native sharing complete? |
| `path_moment_copied_v1` | `format` | Did image copy complete? |
| `path_moment_canceled_v1` | none | Was the creator closed without a completed export action? |

No image bytes, moment types, headlines, explanations, identity settings, or included profile values are collected.

## Semester Story Events

Actions are retained for 90 days. Timing and errors are retained for 30 days.

| Event | Allowed fields | Product question |
| --- | --- | --- |
| `semester_story_creator_opened_v1` | `format` | Was the story creator opened? |
| `semester_story_previous_viewed_v1` | `semesterRelation` | Did students inspect an earlier term? |
| `semester_story_comparison_viewed_v1` | none | Did students use evidence-based term comparison? |
| `semester_story_privacy_changed_v1` | `control` | Which privacy controls are useful? The selected value is not collected. |
| `semester_story_appearance_changed_v1` | `appearance` | Is appearance customization used? |
| `semester_story_downloaded_v1` | `format` | Did a PNG download complete? |
| `semester_story_shared_v1` | `format` | Did native sharing complete? |
| `semester_story_canceled_v1` | none | Was the creator closed without a completed export action? |

No story text, comparison prose, dates, schools, majors, opportunities, organizations, counts, image bytes, or profile links are collected.

## Recommendation Conversion

These 90-day events measure outcomes without changing ranking and intentionally omit recommendation position. Category and exposure are coarse bounded values used only in aggregate conversion analysis.

| Event | Allowed fields | Product question |
| --- | --- | --- |
| `for_you_briefing_viewed_v1` | `source`, `category` | Did Pro students reach the structured opportunity briefing and which bounded briefing state was available? |
| `for_you_radar_opened_v1` | `opportunityId`, `category`, `source` | Did a factual Radar update lead to opportunity review? |
| `for_you_priority_view_used_v1` | `control` | Did a student use a factual deadline or workload ordering? |
| `for_you_comparison_opened_v1` | `status` | Did a Pro student open the bounded comparison view? |
| `for_you_opportunity_compared_v1` | `opportunityId` | Which opaque opportunity IDs entered a comparison? |
| `for_you_watch_changed_v1` | `opportunityId`, `action`, `source` | Did a student add or remove an opportunity from Watch? |
| `recommendation_feed_viewed_v1` | `diversityScore` | Did the visible shortlist maintain a healthy mix? |
| `recommendation_impression_v1` | `opportunityId`, `recommendationId`, `category`, `feedRole`, `exposureCount` | Which coarse recommendation cohort was shown? |
| `recommendation_opportunity_opened_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did a recommendation lead to review? |
| `recommendation_opportunity_saved_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did it enter Journey? |
| `recommendation_opportunity_started_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did it become active work? |
| `recommendation_opportunity_submitted_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did it reach submission? |
| `recommendation_opportunity_completed_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did the recommended opportunity complete? |
| `recommendation_dismissed_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did the student explicitly reject it? |
| `recommendation_feedback_v1` | `opportunityId`, `recommendationId`, `category`, `feedRole`, `exposureCount`, `action` | Which bounded feedback or undo action refined the feed? |

Attribution is browser-session scoped and cleared on logout or account switch. For You briefing, priority, comparison, and Watch events never include profile answers, recommendation titles, explanations, scores, deadlines, comparison values, or Radar copy; `category`, `control`, and `action` are restricted to bounded classifications.

## Discover Events

These 90-day events measure search usefulness and catalog quality without collecting search queries, filter values, URLs, or student profile data.

| Event | Allowed fields | Product question |
| --- | --- | --- |
| `discover_result_impression_v1` | `opportunityId`, `category`, `source` | Which bounded catalog cohorts were visible? |
| `discover_result_opened_v1` | `opportunityId`, `category`, `source` | Did a visible result lead to a detail review? |
| `discover_zero_result_v1` | `source` | How often did Discover return no results? |
| `discover_report_submitted_v1` | `opportunityId`, `action`, `source` | Which bounded catalog-quality issue was reported? |

Discover events intentionally omit raw search text and serialized filters. `action` on a submitted report is restricted to the documented issue taxonomy.

## Product Health And Errors

`product_health_timing_v1` accepts only `component`, `metric`, clamped `durationMs`, browser, theme, and device class. It measures server projection, initial Open Line render, hydration, dialog open, transition, PNG generation, copy, and share latency. Only count, total, and broad duration buckets are retained for 30 days; individual traces are not retained.

`product_operational_error_v1` accepts only `component`, `errorType`, `action`, browser, theme, and device class. It classifies network, timeout, session, security, conflict, invalid response/transition, unsupported, export, unavailable, and unknown errors. It never accepts messages, stack traces, request bodies, or student content. Aggregates are retained for 30 days.

## Aggregate Model

`getAnalyticsSummary()` provides deterministic inputs for a future internal dashboard: Journey views and returns; waypoint, history, Horizon, transition, and application-management counts and rates; creator and export rates; recommendation impression-to-open/save/application conversion, dismissals, category conversion, repeat-exposure performance, and average feed diversity; component-level error counts/rate; and aggregate timing samples, averages, and buckets. No admin UI is part of this sprint.

## Operations

- Keep correctness and privacy checks deployment-blocking with `npm run check:journey-analytics`.
- Run `npm run test:journey-analytics-browser` for Chromium/WebKit queue, reconnect, disabled-mode, logout, and account-switch behavior.
- Review retention and event usefulness before adding a new schema version.
- Remove events that no longer answer a product question.
- Analytics failures are intentionally swallowed by the transport and must never block product work.
