# UnlockED Notifications

## Audit

Before this implementation, UnlockED had Journey reminder timestamps but no delivery model, notification preferences, notification center, email provider, scheduled worker, provider webhook, or cron configuration. Opportunity deadlines and verification fields already existed, Journey already owned application status, account data already lived in the authenticated KV-backed account store, and account writes already used same-origin checks and security locks. Those systems remain authoritative.

The notification system reuses:

- the existing account ID and session;
- Journey records, statuses, reminder dates, and transition history;
- canonical opportunity deadlines, verification status, and official links;
- the existing KV/Upstash deployment;
- the account security lock, same-origin validation, request limits, and rate limits;
- the existing aggregate analytics store.

It does not create another saved-opportunity model, application status model, account identity, entitlement system, or marketing-consent flag.

## Product rules

Notifications exist only for a verified deadline, an explicit reminder, a material tracked-opportunity change, a factual Journey follow-up, or an optional useful digest. Inactivity alone never creates a notification.

Default preferences:

| Setting | Default |
| --- | --- |
| In-app notifications | On |
| Email notifications | On |
| Verified deadline reminders | On |
| User-created Journey reminders | On |
| Material opportunity changes | On |
| Weekly digest | Off |
| Recommendation email | Off |
| Frequency | Important only |
| Timezone | America/New_York until the user saves another |
| Quiet hours | 10 PM–8 AM |

Marketing consent is not represented by these settings and must remain separate.

## Eligibility and timing

- Saved and Interested items receive restrained 7-day and 1-day schedules.
- Applying items receive 7-day, 3-day, and 1-day schedules.
- Only fixed, future, verified deadlines verified within the last 366 days are eligible.
- Rolling, unknown, varied, closed-cycle, malformed, stale, or expired deadlines do not create deadline reminders.
- Date-only deadlines are described by day, never by a fabricated hour.
- A custom reminder takes priority and suppresses an inferred reminder within 12 hours.
- Accepted, Completed, Rejected, and Paused items do not create deadline schedules.
- All schedules are revalidated against current account, Journey, preference, opportunity, and verification state at delivery time.
- Non-urgent email that falls in quiet hours is queued for the first allowed 15-minute boundary. Explicit custom reminders keep the time the student selected.

The current Vercel cron runs daily at `12:05 UTC` because Vercel Hobby projects support only daily cron frequency. This safely processes due work but does not guarantee minute-precise delivery. Production requiring precise custom reminders must move the same bounded worker endpoint to a more frequent durable scheduler; the notification model and idempotency keys do not need to change.

## Priority and channels

- `critical`: reserved for rare account issues; never used for ordinary opportunities.
- `high`: explicit reminders, next-day deadlines, and urgent application-state changes.
- `normal`: several-day deadlines, ordinary material changes, factual follow-ups, and weekly digests.
- `low`: future opt-in recommendation updates.

Free users retain essential deadline, Journey, and material-change notifications. No notification query runs per opportunity card, and no Pro gate is applied to deadline protection.

Email is limited to one non-urgent message per day. High-priority messages use an hourly cap. Weekly and recommendation email remain opt-in. In-app history is bounded to 200 records and active views omit dismissed or expired records.

## Deduplication, retries, and ownership

Each logical notification has a deterministic HMAC-safe idempotency key based on the user, category, related record, scheduled time, and content version. Server storage rejects a duplicate before delivery. Cron claims use a five-minute lease, provider requests use the same idempotency key, and provider webhooks use a 30-day replay claim.

Transient provider failures retry after 15 and 30 minutes. Permanent provider rejection does not retry. A failed email never removes the in-app record. Provider acceptance is recorded as `sent`; only a signed provider webhook records `delivered`. Bounce and complaint webhooks suppress later email for that account.

Notification history, schedules, provider ownership, recipient indexes, and suppression keys are HMAC-keyed. Reads and mutations are scoped to the authenticated account. Notification IDs cannot be used to read or mutate another account. Actions contain only internal paths and require authentication for account-changing work.

## Material change detection

The content administration path compares normalized canonical fields after a successful write. It detects deadline, open/closed state, official URL, eligibility, award or compensation, location/work mode, and program-date changes. Tracking parameters, whitespace, punctuation-only edits, description edits, internal metadata, and verification refreshes do not notify. Non-status changes require the resulting record to be verified.

## Email provider

UnlockED uses one adapter: Resend's HTTPS API. Automated tests never send real mail. Development suppresses external delivery unless `NOTIFICATION_EMAIL_TEST_SEND=1` is explicitly set.

Required production variables:

```text
CRON_SECRET
RESEND_API_KEY
RESEND_WEBHOOK_SECRET
NOTIFICATION_EMAIL_FROM
NEXT_PUBLIC_APP_URL
KV_REST_API_URL
KV_REST_API_TOKEN
AUTH_SECRET
```

Set `NOTIFICATION_EMAIL_FROM` to a sender on an authenticated domain, for example `UnlockED <updates@notify.unlockededu.com>`. Configure the Resend-provided SPF and DKIM DNS records and confirm the domain is verified before enabling production mail. Configure the signed webhook at:

```text
https://www.unlockededu.com/api/notifications/webhook
```

Subscribe to delivered, bounced, complained, and failed email events. The webhook secret begins with `whsec_`. The implementation verifies the raw body, Svix ID, timestamp tolerance, and every `v1` signature without exposing environment values.

## Scheduler and operations

Vercel invokes:

```text
GET /api/notifications/schedule
Authorization: Bearer $CRON_SECRET
```

The due queue is a sorted set, the batch is capped at 100, remote store and provider calls have timeouts, and failures release the claim for a later retry. No scheduler run scans all accounts. Opportunity updates fan out only through the bounded tracked-recipient index.

Run aggregate diagnostics without reminder text:

```bash
NOTIFICATION_DIAGNOSTIC_USER_ID=<internal-user-id> npm run diagnose:notifications
```

## Privacy and analytics

Analytics include bounded notification type, priority, channel, suppression reason, and action. They exclude email addresses, names, opportunity titles, private reminder wording, Journey notes, provider IDs, profile answers, and message bodies. Email HTML contains no tracking pixel.

## Validation

`npm run check:notifications` remains deployment-blocking. It covers correctness, privacy, security, account isolation, idempotency, and a broad two-second ceiling for a complete 250-item notification-generation batch. That ceiling catches severe algorithmic regressions without treating shared build-worker scheduling as product failure.

`npm run benchmark:notifications` is the controlled performance suite. It warms the runtime and enforces strict average, p95, and maximum budgets for schedule generation, material-change detection, email rendering, preference normalization, notification-center reads, mutations, deduplication, and due-queue access. Run it during performance work and scheduled CI; millisecond-level percentile gates do not run in Vercel's deployment-blocking build because shared workers have variable CPU scheduling and garbage collection.

```bash
npm run check:notifications
npm run benchmark:notifications
npm run test:notifications-browser
npm run lint
npm run check:security
npm run check:auth
npm run build
npm run postbuild
```

Real email delivery and actual cron execution must be reported only after credentials, domain authentication, deployment, provider events, and a production scheduler invocation have been directly observed.
