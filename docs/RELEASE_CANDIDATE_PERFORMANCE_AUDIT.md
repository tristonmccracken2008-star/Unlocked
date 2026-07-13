# UnlockED v1.0 Release Candidate Performance Audit

## Root Causes Found

- Journey loaded the full opportunity catalog inside a client component and built recommendation output in the browser. That created unnecessary main-thread work and also exposed a Pro-gated recommendation path outside For You.
- Discover loaded the catalog after shell render, but then hydrated the account and built the full Advisor recommendation service client-side for sorting. This made search/filter updates compete with recommendation indexing.
- The old Journey dashboard still contained a separate recap/share experience in addition to the current Journey Card generator.
- Client account session data used a short-lived module cache without an explicit reset path for account switching.
- Premium theme CSS used broad class overrides that flattened surfaces and made dark/forest themes hard to read.

## Fixes Implemented

- Journey now fetches only tracked opportunity records via `/api/opportunities?ids=...`.
- Journey no longer imports the full opportunity catalog or builds `buildRecommendationService` client-side.
- Discover now uses a lightweight deterministic relevance score for local sorting and leaves personalized recommendation generation to the server-gated For You API.
- The retired Journey recommendation block and duplicate Journey recap sharing UI were removed from the dashboard.
- Google sign-in starts from a cleared UnlockED session cookie and still sends `prompt=select_account`.
- Logout clears session, OAuth state, referral attribution, local dashboard state, and the client session cache.
- Account session cache now has an explicit reset function and safely persists session data for theme bootstrap.
- Premium themes now use semantic CSS variables for page, paper, surface, text, muted text, and borders.

## Guardrails Added

- `npm run check:performance` now verifies Discover and Journey do not run browser-side Advisor recommendation indexing.
- `npm run check:release-candidate` verifies the six release-candidate fixes: performance, account switching, Free For You, themes, Pro gating, and retired Journey share events.
- `npm run check:recommendation-engine-v2` is available directly.
- `npm run build` runs the release-candidate check through `prebuild`.

## Expected Impact

- Less browser main-thread blocking on Discover and Journey.
- Smaller Journey data payloads for users with few tracked opportunities.
- Fewer duplicate account/session reads during sign-in, sign-out, and navigation.
- No Pro-gated recommendations rendered through Journey.
- One active Journey Card sharing model instead of two overlapping share experiences.
