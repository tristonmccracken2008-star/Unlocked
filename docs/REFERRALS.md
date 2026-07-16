# UnlockED Referral System

UnlockED referrals use the existing account, onboarding, billing, analytics, and Journey systems. They do not create a separate tracking model.

## Flow

1. Every account receives a permanent `referrals.code` when account data is read or created.
2. `/r/[code]` validates the code, stores it in the HTTP-only `unlocked_referral` cookie, records `referral_link_opened`, and redirects to `/`.
3. During Google OAuth callback, the server consumes the referral cookie and attaches `referredBy` only if the account has not completed onboarding and has no existing referrer.
4. When onboarding completion is saved through the trusted account merge path, `completeReferralOnboarding()` credits the referrer.
5. Referral rewards are applied from threshold rules in `lib/referrals.ts`.

## Abuse Prevention

- Self-referrals are rejected and flagged.
- A user can only have one `referredBy` value.
- Completed referrals cannot be credited twice.
- Referral loops are rejected.
- Referrer changes are not accepted through the client account save API.
- Completion credit requires a completed profile and `onboardingComplete`.
- Referral ledger mutations use a distributed lock so concurrent onboarding requests cannot double-credit a referral or Pro reward.
- Partial writes are repaired idempotently on retry; billing is stored only after the referral ledger records the reward.
- Referral codes use cryptographically random values and cannot be chosen by the browser.

## Rewards

- 1 successful referral: reserved Path Moment treatment entitlement.
- 3 successful referrals: Founder account designation.
- 5 successful referrals: one month of referral-earned Pro.
- 15 successful referrals: reserved Path Moment treatment pack.
- 50 successful referrals: Campus Ambassador badge and early access marker.

Referral-earned Pro uses `billing.referralProGrantedUntil`. It extends from the later of now, the current referral grant, or the current paid period end. It does not create, duplicate, or cancel Stripe subscriptions.

## User Surfaces

- `/referral`: authenticated referral page with link copy/share, progress, rewards, pending referrals, and completed referrals.
- Signed-in navigation includes `Refer`.
- Path Moment export is available to every user and does not expose account tiers.
- Existing visual-reward keys remain stored for backward compatibility but are not rendered by Path Moments V1.

## Admin

`/admin/referrals` is protected by the existing `ADMIN_EMAILS` allowlist. It shows top referrers, pending referrals, reward history, and abuse flags from the referral admin summary snapshot.

## Analytics

Referral events:

- `referral_link_opened`
- `referral_link_copied`
- `referral_code_copied`
- `referral_share_started`
- `referral_completed`
- `referral_reward_unlocked`
