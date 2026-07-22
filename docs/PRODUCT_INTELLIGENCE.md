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

## Journey Events

All Journey action aggregates are retained for 90 days.

| Event | Allowed fields | Product question |
| --- | --- | --- |
| `journey_viewed_v1` | `status` | Did students reach Journey in a meaningful state? |
| `journey_returned_v1` | none | Did a student return on a later UTC day? |
| `journey_opportunity_added_v1` | `opportunityId`, `source` | Did an opportunity enter Journey from Discover or For You? |
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
| `journey_card_shared_v1` | `format` | Did a native Journey Card share complete? |
| `journey_card_copied_v1` | `format` | Did an image copy complete? |

Journey Card events never include the card headline, identity choice, school, dates, statistics, highlights, image bytes, or share destination.

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
| `recommendation_feed_viewed_v1` | `diversityScore` | Did the visible shortlist maintain a healthy mix? |
| `recommendation_impression_v1` | `opportunityId`, `recommendationId`, `category`, `feedRole`, `exposureCount` | Which coarse recommendation cohort was shown? |
| `recommendation_opportunity_opened_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did a recommendation lead to review? |
| `recommendation_opportunity_saved_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did it enter Journey? |
| `recommendation_opportunity_started_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did it become active work? |
| `recommendation_opportunity_submitted_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did it reach submission? |
| `recommendation_opportunity_completed_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did the recommended opportunity complete? |
| `recommendation_dismissed_v1` | `opportunityId`, `recommendationId`, `category`, `exposureCount` | Did the student explicitly reject it? |

Attribution is browser-session scoped and cleared on logout or account switch.

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
