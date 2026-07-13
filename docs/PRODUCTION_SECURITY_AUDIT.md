# UnlockED Production Security Audit

Audit date: 2026-07-13

## Scope

This review covered every Next.js route handler and protected page, Google OAuth, cookies and session persistence, account and profile writes, administrator authorization, Stripe Checkout and Customer Portal creation, Stripe webhooks and entitlements, referrals and referral-earned Pro access, advisor APIs, analytics, content management, redirects, browser-visible account data, response headers, request limits, dependency advisories, and tracked-secret exposure.

The threat model included unauthenticated callers, authenticated users modifying privileged fields, cross-site requests, forged or replayed Stripe events, out-of-order concurrent events, referral races, stolen or revoked sessions, open redirects, oversized payloads, stored script injection through managed content, datastore outages, brute-force traffic, and accidental disclosure through API responses or logs.

## Findings Remediated

### Critical and High

- Sessions were signed but not revocable. Sessions now have random server-side records with expiry and immediate logout revocation. The cookie contains no name, email, provider subject, or billing data.
- OAuth lacked PKCE. Google sign-in now uses state plus PKCE S256, constant-time state comparison, bounded provider timeouts, strict verified identity checks, and generic browser failures while preserving sanitized server logs.
- Account writes accepted broad nested data. Client input now uses a strict allowlist and cannot write billing, Stripe IDs, referrals, advisor audit data, or arbitrary tracker states.
- Stripe webhook ownership and replay controls were incomplete. Webhooks now validate the raw signature and timestamp, live/test environment, event shape, configured Price IDs, existing customer mapping, Checkout metadata and client reference, event ordering, and atomic event claims.
- Concurrent Stripe events could overwrite newer subscription state. Events for the same customer now use a distributed critical-section lock and stale events are ignored.
- Concurrent referral completion could duplicate rewards, including Pro time. Referral ledger writes are serialized, completion is idempotent, and partial completion writes are repaired on retry.
- Account/profile saves could overwrite recent Stripe updates. Canonical billing state now uses a separate server-side record and is merged into account reads.
- Managed opportunity content could close a JSON-LD script tag. Structured data now escapes HTML-significant characters before script injection.

### Medium

- Authenticated mutation routes did not consistently enforce CSRF protection. Every cookie-authenticated POST, PUT, PATCH, and DELETE route now requires the configured same origin.
- Routes accepted unbounded or loosely typed bodies. JSON, form, and webhook bodies have explicit limits and content-type requirements; profile, analytics, CMS, identifiers, URLs, arrays, dates, and statuses are bounded and validated.
- Abuse controls were process-local or absent. API routes now use hashed distributed rate-limit keys backed by production KV and fail closed when that control is unavailable.
- Admin APIs could reflect implementation errors. Browser responses are generic, logs contain only bounded categories or sanitized reasons, and admin identity remains controlled by the production `ADMIN_EMAILS` allowlist.
- Browser account responses exposed internal identifiers. Stripe customer/subscription/price/event IDs, Google subject IDs, internal account IDs, referral relationship IDs, abuse reasons, and advisor internal IDs are redacted or replaced with pseudonymous values.
- Billing redirects trusted provider output. Checkout and portal URLs now require HTTPS Stripe hosts; application redirects use the configured canonical origin.
- A vulnerable nested PostCSS release was present through Next. A package override pins all consumers to `postcss@8.5.10`; the production dependency audit reports zero known vulnerabilities.

### Defense in Depth

- Global CSP, HSTS, `nosniff`, `DENY` frame policy, strict referrer policy, permissions policy, COOP, and disabled DNS prefetch are configured. The Next technology header is disabled.
- External OAuth, Stripe, KV, content, analytics, and recommendation operations are bounded by timeouts or hard request deadlines.
- Published content excludes archived/unreliable records, route IDs are constrained, and official-source URLs require HTTPS.
- Tracked files are scanned for live Stripe, Google, and private-key signatures during `check:security`.

## Regression Coverage

`npm run check:security` verifies:

- same-origin acceptance and cross-site rejection
- body limits and content types
- privileged account-field stripping
- CMS URL, date, and size validation
- safe JSON-LD serialization
- Stripe signature rotation, timestamp tolerance, event shape, Price allowlisting, and Checkout ownership
- webhook replay claims and release-on-retry
- distributed critical-section exclusion
- billing persistence across profile writes
- concurrent referral completion idempotency
- server-backed session creation and revocation
- absence of PII in signed session payloads
- redacted browser account fields
- route security controls and global response headers
- tracked credential-pattern scanning

The release build also runs the existing authentication, billing, onboarding, referral, advisor, recommendation, data integrity, performance, and release-candidate checks.

## Verification Result

- `npm run lint`: passed
- `npm run check:security`: passed
- full `npm run build` prebuild matrix: passed
- Next.js production compile, type check, 80-page generation, and postbuild verification: passed
- `npm audit --omit=dev --audit-level=moderate`: zero vulnerabilities
- production route probes: hardened headers `200`; protected profile redirect `307`; unsigned webhook `400`; webhook GET `405`; unauthenticated account `401`; unauthorized admin `403`; cross-site analytics, Checkout, and logout `403`

## Required Production Operations

These controls depend on deployment configuration and must be verified before accepting public payments:

1. Use a canonical HTTPS `NEXT_PUBLIC_APP_URL`; generate independent 32-byte-or-longer `AUTH_SECRET` and `RATE_LIMIT_SECRET` values.
2. Store Google, Stripe, KV, and auth credentials only in encrypted deployment settings. Rotate any credential ever exposed outside that system.
3. Configure non-empty `ADMIN_EMAILS`, require MFA for those Google accounts, and restrict production deployment access.
4. Use production KV with backups/retention appropriate to account, session, billing, and referral records. Alert on datastore availability and rate-limit fail-closed responses.
5. Configure the exact live Stripe webhook endpoint and signing secret, delivery alerts, replay tests, and platform firewall rules using Stripe's current published IP ranges where supported.
6. Perform staging and production smoke tests with real Google OAuth and Stripe test/live environments. Local tests cannot prove third-party dashboard configuration.
7. Alert on repeated OAuth failures, webhook 4xx/5xx responses, admin denials, rate-limit failures, and unexpected server errors without collecting profile answers or payment identifiers.
8. Establish secret rotation, account deletion, incident response, backup restore, dependency update, and security-contact ownership.

## Residual Risk

The CSP retains `unsafe-inline` for scripts and styles because the current Next.js hydration and theme bootstrap use inline content. User-controlled JSON-LD is escaped and the application does not render arbitrary HTML, substantially reducing exploitability. Moving to request-specific CSP nonces remains worthwhile defense in depth, but requires framework-wide rendering changes and should be performed as a dedicated compatibility-tested change.

The application performs synchronous bounded processing for Stripe webhooks. Stripe retries failed deliveries, and replay controls make retries safe. A durable webhook queue would improve resilience at materially higher payment volume; it is an operational scalability improvement rather than an authorization gap.

No audit can prove the absence of all vulnerabilities. At the end of this review there are no known unresolved critical or high-severity code vulnerabilities. Public payment launch still depends on completing the production operations above.
