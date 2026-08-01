# First-launch walkthrough

The four-step walkthrough introduces Discover, For You, and Journey after a new account successfully completes onboarding. It is not a tutorial and does not alter any product page.

## Persistence and migration

New account records begin with `firstLaunchComplete: false`. Completion is authenticated, same-origin protected, rate limited, serialized by an account-scoped lock, and monotonic. The client cannot reset the field.

Accounts created before this field existed migrate as complete when they already have a valid completed onboarding profile. This prevents returning users from being forced through a newly introduced first-launch experience. Accounts with the explicit `false` value retain it when onboarding completes and are routed to `/welcome`.

In-progress slide position is stored only as an account-scoped session convenience. Server state is the sole authority for completion.

## Routing

New account: Google sign-in → onboarding → `/welcome` → Discover.

Returning account: Google sign-in → existing For You destination. A completed account visiting `/welcome` is redirected to Discover. Protected product routes redirect an incomplete first launch to `/welcome`.

## Product previews

The six responsive assets in `public/walkthrough` are cropped browser captures of the real UnlockED Discover, For You, and Journey pages. They are decorative, softened behind the walkthrough copy, and the next slide is preloaded after the current slide renders.
