# First-Session Audit

## Scope

The audited path is landing page, Google authentication, account creation, onboarding, For You, Discover, first save, Journey, first Journey update, and return.

## Weaknesses Found

- Required onboarding asked for a minor and GPA before either was needed to produce a useful cold-start shortlist. GPA is sensitive and unknown GPA can be handled safely by the eligibility gate.
- Free accounts received an explanation of For You but no actual recommendation, so they could not experience or save the product's core value.
- Add to Journey wrote to browser storage first and synchronized in the background. A failed account write could leave the interface claiming success.
- The save action had no pending or recoverable error state and did not protect the visible interaction from repeated clicks.
- The first Journey presented a saved item as timeline progress without plainly distinguishing a bookmark from an application milestone.
- Existing activation analytics were client-generated and could not establish a server-confirmed first save.

## Preserved Strengths

- OAuth state, PKCE, server sessions, onboarding redirects, and protected routes remain server-authoritative.
- Onboarding drafts already survive refreshes and are scoped to the current account.
- Profile completion waits for cloud persistence before redirecting to For You.
- Recommendation eligibility, quality, ranking, and entitlement rules remain unchanged.
- Journey status updates remain explicit, authenticated, idempotent, and user-reported.

## Implemented Flow

1. Onboarding collects school, graduation year, major, career direction, opportunity interests, and current priority.
2. Minor and GPA remain available in Profile but are deferred from required onboarding. Their safe defaults are `none` and `none_yet`.
3. The server-authenticated For You document renders immediately while one bounded API request prepares a missing snapshot. Existing snapshots render without a request waterfall.
4. Free accounts receive one fully eligible recommendation. Hidden Pro recommendations are omitted from the payload and markup.
5. Add to Journey calls one authenticated, same-origin, rate-limited server endpoint.
6. The server validates the published opportunity, serializes the account write, and returns the canonical Saved record.
7. The card confirms success only after server acceptance and explains that actual milestones are recorded later in Journey.
8. A saved-only Journey states that nothing advances automatically and points to Update Journey.

## Analytics

Existing bounded events cover sign-in, onboarding, For You, Discover, Journey views, Journey updates, upgrades, and checkout. The first save now emits `first_opportunity_saved_v1` and `activation_achieved_v1` only from the authenticated server mutation. No profile answers, names, email addresses, billing identifiers, or recommendation contents are recorded.

## Product Boundaries

No tutorial, checklist, coaching system, new recommendation logic, new billing plan, or second Journey status model was added.
