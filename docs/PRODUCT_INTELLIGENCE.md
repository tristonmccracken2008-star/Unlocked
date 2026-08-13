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
| `recommendation_feed_viewed_v1` | `diversityScore` | Did the visible shortlist maintain a healthy mix? |
| `recommendation_impression_v1` | `opportunityId`, `recommendationId`, `category`, `feedRole`, `exposureCount` | Which coarse recommendation cohort was shown? |
| `recommendation_opportunity_opened_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did a recommendation lead to review? |
| `recommendation_opportunity_saved_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did it enter Journey? |
| `recommendation_opportunity_started_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did it become active work? |
| `recommendation_opportunity_submitted_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did it reach submission? |
| `recommendation_opportunity_completed_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did the recommended opportunity complete? |
| `recommendation_dismissed_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did the student explicitly reject it? |
| `recommendation_feedback_v1` | `opportunityId`, `recommendationId`, `category`, `feedRole`, `exposureCount`, `action` | Which bounded feedback or undo action refined the feed? |

Attribution is browser-session scoped and cleared on logout or account switch. For You briefing events never include profile answers, recommendation titles, explanations, scores, deadlines, or Radar copy; `category` is restricted to a bounded briefing or Radar classification.

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
