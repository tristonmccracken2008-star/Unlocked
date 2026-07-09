# UnlockED Production Data Architecture

UnlockED separates guest data from authenticated user data.

## Guest mode

Guests use browser `localStorage` only. Guest data is not synced across devices.

## Authenticated mode

Signed-in users use Google OAuth plus a secure HTTP-only signed session cookie. User data is read and written through API routes and the reusable data layer in `lib/auth-store.ts`.

Production persistence uses Vercel KV or Upstash Redis over REST:

```bash
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

or:

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Production deployments must also define:

```bash
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=
```

Optional Stripe billing infrastructure uses:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRO_PRICE_ID=
```

See `docs/STRIPE_BILLING_SETUP.md` for checkout, portal, and webhook setup.

## Database models

The application models authenticated data as:

- `DatabaseUser`
- `ProfileRecord`
- `SavedOpportunityRecord`
- `OpportunityTrackerRecord`
- `UserPreferencesRecord`
- `JourneyProgressRecord`
- `AccountData`

`AccountData` includes a `billing` record for the Free and Pro account tiers. Free users retain access to the normal product.

These types live in `lib/account-types.ts`.

## Keys

The data layer hashes identifiers before using them as database keys.

- User: `unlocked:user:{hash}`
- Email index: `unlocked:user-email:{hash}`
- Account data: `unlocked:account-data:{hash}`

The email index prevents duplicate users for the same Google email address.

## API boundary

Frontend code should not access production storage directly.

Use:

- `GET /api/auth/session`
- `GET /api/account/data`
- `PUT /api/account/data`
- `POST /api/auth/logout`

Client-side sync helpers live in `data/account-sync.ts`.

## Duplicate prevention

- Users are deduplicated by normalized email.
- Saved opportunities are deduplicated by `opportunityId`.
- Tracker statuses are keyed by `opportunityId`.
- Journey progress is keyed by milestone id.

## Error handling

Production data store misconfiguration fails closed. If KV/Upstash env vars are missing in production, authenticated data routes throw rather than pretending data was saved.
