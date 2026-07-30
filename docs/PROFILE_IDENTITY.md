# Profile Identity

The Profile identity card is a private projection of account data that UnlockED already owns. It does not introduce another profile record, save path, request, provider, or recommendation signal.

## Data flow

- `app/profile/page.tsx` supplies the server-confirmed account session.
- `components/profile-page.tsx` retains that session while the normal client refresh runs.
- `lib/profile-identity.ts` formats the canonical `StudentProfile` and aggregates canonical Journey tracker records in one linear pass.
- `components/profile-identity-card.tsx` renders the resulting read-only projection.
- Every edit affordance focuses the existing `StudentProfileForm`; the card has no editor or save action.
- The card updates only after the existing authenticated profile write succeeds and the canonical account snapshot refreshes.

## Recommendation isolation

The card displays the existing `careerGoal` value but does not create, transform, or submit it. Existing recommendation behavior is unchanged: the canonical profile continues to drive For You exactly as it did before this component existed. Rendering the identity model creates no analytics event and no recommendation input.

Journey counts are descriptive only. They are derived from `activity.tracked`, `tracker`, and `journeyProgress`, are not persisted separately, and never enter recommendation generation.

## Privacy and performance

The identity card exists only on the authenticated, non-indexed `/profile` route. It creates no public profile, metadata, or share artifact. Avatar URLs are taken from the authenticated session and use the same no-referrer treatment as the navigation avatar.

No additional network or database query is made. Profile and Journey data are already present in the account session, and aggregation is `O(n)` over deduplicated Journey records.
