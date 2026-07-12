# UnlockED Onboarding

UnlockED uses a mandatory one-time onboarding flow for authenticated users who have not completed a usable student profile.

## Routing

- Google OAuth redirects completed accounts to `/advisor`.
- Google OAuth redirects incomplete accounts to `/onboarding`.
- Product routes use `requireCompletedOnboarding()` server-side so incomplete accounts cannot bypass onboarding by entering URLs directly.
- `/onboarding` uses `requireOnboardingSession()` so signed-out users return home and completed users return to For You.

## Profile Fields

The onboarding flow writes to the canonical `StudentProfile` record through `writeStudentProfile()`. It does not create a separate onboarding profile.

Required persisted fields include school, graduation year, academic year, major, minor or explicit no-minor state, GPA status, career goal, opportunity interests, current priority, onboarding completion timestamp, and the existing first name field inferred from the Google account.

GPA is stored only when the student chooses the 4.0 scale numeric option. `none_yet` and `nonstandard` are explicit states and should not be interpreted as GPA values.

## Existing-User Migration

Existing users are treated as complete when their saved profile already has the legacy completion fields: first name, school, major, academic year, graduation year, career goal, and interests. During profile normalization, safe defaults are applied for newly added fields:

- `minorStatus`: `declared` when a minor exists, otherwise `none`.
- `gpaStatus`: `none_yet`.
- `currentPriority`: existing preferred opportunity type, existing goal, or `Exploring opportunities`.

This preserves existing access and does not overwrite saved Journey activity or opportunities.

## Analytics

Onboarding analytics use step identifiers and do not send sensitive answer values.

- `onboarding_started`
- `onboarding_step_viewed`
- `onboarding_step_completed`
- `onboarding_back_clicked`
- `onboarding_validation_failed`
- `onboarding_completed`
- `onboarding_save_failed`

Common properties are `stepId`, `stepIndex`, `stepCount`, and non-sensitive validation `reason`.
