# UnlockED Product UX Audit

Audit date: 2026-07-28

## Scope and method

This audit covers all App Router pages, shared components, authenticated and
signed-out navigation, loading/empty/error/success states, lifecycle
presentation, account and billing returns, mobile navigation, theme tokens,
accessibility semantics, and the existing browser/regression suites.

The audit used:

- static inventory of 47 page files, two user-facing redirect aliases, and 66
  shared components;
- direct review of authentication, onboarding, Discover, For You, Journey,
  notifications, profile, billing, public, admin, and opportunity-detail code;
- local signed-out rendering at 1280 x 720 and 390 x 844;
- existing Chromium/WebKit, security, account-isolation, accessibility,
  lifecycle, recommendation, notification, Journey, and bundle test coverage.

No product code was changed before this report was written.

## Summary

Issues found: 24

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 8 |
| Medium | 12 |
| Low | 4 |

| Category | Count |
| --- | ---: |
| Functional/state | 7 |
| Accessibility | 5 |
| Navigation | 4 |
| Trust/content | 4 |
| Visual/theme | 3 |
| Performance | 1 |

## Ranked findings

| ID | Route or component | Viewport/theme | Current behavior | Expected behavior | Severity | Category | Proposed fix | Scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-01 | `/profile`, notification settings links, Stripe portal returns | All | `#notifications`, `#billing`, and `?billing=...` do not select the intended account section. Browser back cannot restore account-section state. | Deep links and billing returns open the correct section, provide a precise status, and clean one-time query state. | High | Functional/navigation | Make the URL hash authoritative for account sections and normalize billing return messages. | Local |
| UX-02 | `NotificationSettings` | All themes | A failed initial request leaves the settings skeleton visible indefinitely because the error message is hidden behind the null-preferences return. | Replace the skeleton with a persistent, retryable error state. | High | Functional/error | Model loading/error separately and render a canonical inline error with Retry. | Local |
| UX-03 | Profile billing section | All themes | A failed billing-config request leaves “Loading billing actions…” indefinitely. | Show a persistent recoverable billing error without hiding known plan state. | High | Functional/error | Add explicit loading/error/ready states and Retry. | Local |
| UX-04 | `/` signed out | All | The first client render says “Preparing your workspace” while the browser repeats the server’s session lookup. | Render the public landing page immediately when the server already proved there is no session. | High | Performance/trust | Pass the server-known initial session into the landing component and avoid duplicate first-load work. | Local |
| UX-05 | Scholarship, research, career, AI, and legacy benefit surfaces | All | Older rows use verification badges and raw deadline labels rather than the canonical lifecycle presentation. Some source actions do not communicate lifecycle uncertainty. | All opportunity surfaces use the same lifecycle label and conservative action language. | High | Trust/functional | Resolve lifecycle once per row and use `LifecycleBadge` plus lifecycle-aware dates/actions. | System-wide family |
| UX-06 | Global layout | Keyboard, zoom | No skip link or stable content target exists. Keyboard users must traverse the full header on every page. | First focus offers “Skip to main content,” with a stable target that works despite route-specific `<main>` elements. | High | Accessibility | Add a visually hidden skip link and focusable content wrapper. | System-wide |
| UX-07 | `/pricing` | Signed-in Pro | Pricing is rendered without account context, so a Pro subscriber still sees upgrade calls until the API rejects them. | Current Pro users see their plan as active and a restrained link to billing. | High | Billing/trust | Resolve session server-side and render current-plan treatment without changing checkout rules. | Local |
| UX-08 | Client error boundary | All | The full client `Error` object is logged to the browser console. | Browser logging uses a safe category; server diagnostics remain authoritative. | High | Privacy/error | Log only name/digest presence in the client and keep user-facing recovery. | Local |
| UX-09 | Primary header and mobile navigation | Mobile/desktop | Referral is presented as a fourth primary product destination, competing with Discover, For You, and Journey. | Primary navigation reflects the three core product responsibilities; Referrals remains reachable as a secondary account destination. | Medium | Navigation | Move Referrals to the account center and reduce mobile nav to three equal destinations. | System-wide |
| UX-10 | Footer with mobile navigation | Small mobile | Footer controls can sit beneath the fixed bottom navigation and device safe area. | Footer provides enough bottom clearance for the fixed navigation. | Medium | Responsive | Add mobile safe-area padding; preserve desktop spacing. | System-wide |
| UX-11 | Global/AuthBoundary loading | Screen reader/dark | The protected-route loading view lacks `aria-busy`, a polite status, reduced-motion skeleton semantics, and uses a second visual pattern. | Protected loading uses the same accessible workspace-loading pattern. | Medium | Accessibility/visual | Add shared semantic loading attributes and restrained skeleton blocks. | System-wide |
| UX-12 | Root Journey loading | Dark themes | The root loading canvas hard-codes light cream. | Loading uses product theme tokens. | Medium | Theme | Replace hard-coded background with `bg-paper`. | Local |
| UX-13 | `/profile` success messages | All | Several settings report generic “Changes saved,” while other flows report the exact result. | Confirmation states what changed and appears only after server confirmation. | Medium | Success/copy | Pass action-specific success copy through preference saves. | Local |
| UX-14 | Notification preference result | Screen reader/dark | Save failure and save success share one `role="status"` and green styling. | Failure is an alert with semantic error styling; success is polite status. | Medium | Accessibility/error | Track message kind explicitly. | Local |
| UX-15 | `/billing/success` and portal return | All | “Open billing” targets the Profile default section. A verified checkout can remain “finalizing” without an explicit refresh route. | Billing links target `#billing`; status language remains webhook-authoritative. | Medium | Navigation/billing | Correct destinations and preserve conservative status copy. | Local |
| UX-16 | Account deletion return | Signed out | `?account=deleted` is neither explained nor cleared, so a completed destructive flow has no confirmation. | Show a one-time signed-out confirmation and remove the query parameter. | Medium | Success/trust | Handle the safe return code alongside auth query handling. | Local |
| UX-17 | Notification action links | Network failure | The background “acted” update ignores rejection; the destination still opens but read state can contradict the center on return. | Navigation remains available and a failed state update is safely observable. | Medium | Functional/error | Catch and report the non-blocking state failure without blocking navigation. | Local |
| UX-18 | Global buttons | All | Button radii and casing vary by page family; older category/admin surfaces use square uppercase controls while product surfaces use sentence-case rounded controls. | Product-facing actions use sentence case and canonical primary/secondary styles; admin may remain denser. | Medium | Visual/copy | Add small shared UX utility classes and migrate only product-facing outliers. | System-wide |
| UX-19 | Legacy scholarship heading | All | “Scholarships For You” competes with the branded For You destination and uses inconsistent title casing. | Describe profile relevance without renaming the destination. | Medium | Copy | Use “Scholarships for your profile.” | Local |
| UX-20 | External source links | Screen reader | New-tab behavior is visually indicated inconsistently and not always included in the accessible name. | Important official-source actions consistently announce the new-tab destination without adding visual noise everywhere. | Medium | Accessibility/trust | Add visually hidden “opens in a new tab” text to primary official-source actions. | Family |
| UX-21 | 404 and global error | Mobile | Action styling is older square/uppercase language and does not match current product controls. | Recovery pages use the canonical header, action, and alert rhythm. | Low | Visual/copy | Apply existing rounded sentence-case action patterns. | Local |
| UX-22 | Public SEO landing shortlist | All | “Updated July 6, 2026” is hard-coded presentation rather than derived content metadata. | Maintenance dates should be sourced or omitted when not authoritative. | Low | Trust/content | Defer until the public benefit data exposes a canonical collection review date. | Deferred |
| UX-23 | Admin form family | Dark/mobile | Admin controls remain denser and some semantic error colors are light-theme-specific. | Admin remains efficient but uses shared semantic alert tokens. | Low | Theme | Defer broad admin visual migration; retain functional security coverage. | Deferred |
| UX-24 | Full real-provider checkout and two live Google accounts | Production | Local automation cannot complete real OAuth/Stripe provider UI without configured accounts and credentials. | Validate these in a bound production environment with controlled Free and Pro accounts. | Low | Validation | Keep deterministic two-account and billing ownership tests; perform live production verification after push/deploy access exists. | Deferred |

## Route coverage

| Route family | Routes inventoried | High/medium findings |
| --- | ---: | ---: |
| Signed-out/public/legal | 18 | 3 |
| Authentication/onboarding | 2 pages + 4 auth routes | 2 |
| Discover/opportunity details/categories/schools | 13 | 4 |
| For You | 1 page + API/client states | 0 new defects |
| Journey and Journey redirects | 2 | 1 |
| Notifications | 1 page + settings/APIs | 3 |
| Profile/account | 1 page + account APIs | 6 |
| Pricing/billing | 3 pages + APIs/webhook | 3 |
| Referral | 1 page + redirect/API | 1 |
| Admin | 7 | 1 deferred |

## Intentional deferrals

- No broad redesign of stable Discover, For You, Journey, onboarding, or admin
  page families.
- No new toast framework, dialog framework, styling framework, or navigation
  destination.
- No live OAuth, Stripe, Vercel, or two-real-account claim without the required
  configured external environment.
- No migration of every admin utility class; this pass prioritizes public and
  student-facing consistency.
- No fabricated collection-level verification date for SEO pages.
