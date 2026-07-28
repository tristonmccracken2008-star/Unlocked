# UnlockED Account Center

## Purpose

The account center is the single place where a student manages the factual profile and preferences used by UnlockED. It consolidates existing profile, notification, privacy, appearance, billing, export, and deletion controls without creating a second account model.

The seven sections are:

1. Profile
2. Interests
3. Notifications
4. Privacy
5. Appearance
6. Plan and billing
7. Data and account

## Audit Findings

Before this implementation:

- Profile editing, notification preferences, and billing were exposed as separate stacked surfaces.
- Onboarding and profile editing shared persistence but did not share every option and normalization rule.
- Unlisted schools, second majors, and non-4.0 GPA scales were not represented consistently.
- Recommendation activity could not be disabled or reset independently of saved opportunities and Journey history.
- Journey Card privacy defaults were selected per export and were not account preferences.
- The application had no user-facing account export or self-service account deletion flow.
- Existing appearance and billing settings were stored correctly but lacked one clear account-management destination.

The implementation retains the canonical account record, session ownership, billing record, notification model, onboarding completion flag, and Journey status system.

## Canonical Data Flow

`StudentProfile` remains the profile used by onboarding, eligibility, For You, and profile editing. Client input is normalized again by `lib/account-input.ts` before storage. A profile edit supplies the last known account timestamp; a stale edit receives HTTP 409 instead of overwriting a newer record.

`UserPreferencesRecord` remains the canonical preference record. It now includes:

- explicit opportunity interests;
- learned-activity consent and reset timestamp;
- notification preferences;
- privacy-preserving Journey Card defaults;
- appearance and motion preferences.

Disabling learned activity removes browsing, recommendation feedback, and dismissal signals from recommendation ranking. Saved and Journey state remains available to avoid duplicate recommendations and preserve factual application context. Resetting learned signals clears behavioral recommendation state while preserving profile data, explicit interests, saved opportunities, Journey history, and billing.

## Privacy and Ownership

Every account route derives identity from the authenticated session. User IDs supplied by the browser are ignored. Mutations use the existing same-origin protection, bounded request parsing, rate limits, and server-side validation.

Account exports are generated synchronously as private, non-cacheable JSON downloads. They contain user-owned profile, preference, saved-opportunity, Journey, bounded notification, and safe subscription metadata. They exclude sessions, OAuth/provider identifiers, Stripe identifiers, secrets, internal recommendation weights, fraud data, and other users' records.

Account deletion requires an exact `DELETE` confirmation. An active Stripe subscription is canceled before deletion. Notification data and account-owned records are removed, user and lookup mappings are removed, and the session cookie is cleared. Existing sessions become invalid because their user record no longer exists. Repeated deletion is idempotent.

## Journey Card Defaults

Account preferences can define a default format, visual theme, name treatment, and whether school, organization, date, or UnlockED attribution is included. Defaults apply when the creator opens. Every card can still override them before export. Previously exported images are not changed.

## Entitlements

Profile, interests, core notifications, privacy, export, deletion, and the supported light appearance remain available to Free accounts. Existing premium themes remain protected by both normalized server input and billing-derived entitlement state. Stripe's customer portal continues to handle sensitive billing operations.

## Validation

The deterministic account-center check covers:

- field normalization and forged input;
- custom schools, undeclared and second majors, optional GPA, and multiple GPA scales;
- separate account and session ownership;
- learned-signal reset preservation rules;
- account deletion, session revocation, and idempotency;
- source-level route security and export redaction;
- preference-normalization performance.

The production-style browser suite covers Free and Pro accounts in Chromium and WebKit on desktop and mobile. It exercises every section, preference persistence, entitlement isolation, export redaction, deletion with a dedicated disposable account, account switching, overflow, and browser console failures.

## Operational Limitations

- Account export is immediate JSON. There is no asynchronous archive or expiring download link because no durable export object is created.
- Account deletion spans the account and notification stores rather than a database transaction. A failed partial cleanup is reported as incomplete and can be retried idempotently.
- Notification schedules created before the per-user schedule index was introduced are removed by their normal processing or expiry path; new schedules are deleted with the account.
- Production deletion must only be tested with a dedicated disposable account. Local automated coverage performs the destructive scenario.
- Account recovery and multi-device session management were not added because the current session architecture does not expose a reliable device inventory.
