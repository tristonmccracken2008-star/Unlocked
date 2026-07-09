# Stripe Billing Setup

UnlockED keeps the free product available to every signed-in student. Stripe billing is infrastructure for a future Pro plan and does not gate the core experience.

## Required environment variables

Set these in local development and production:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRO_PRICE_ID=
```

Production also requires the normal UnlockED auth and data-store variables:

```bash
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

or the Upstash equivalents:

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Stripe dashboard steps

1. Create a Stripe account or open the Stripe dashboard.
2. Create a Product named `UnlockED Pro`.
3. Create a recurring Price for that product.
4. Copy the Price ID into `STRIPE_PRO_PRICE_ID`.
5. Copy your secret key into `STRIPE_SECRET_KEY`.
6. Copy your publishable key into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
7. Create a webhook endpoint pointing to:

```text
https://your-domain.com/api/billing/webhook
```

8. Subscribe the webhook endpoint to:

```text
checkout.session.completed
customer.subscription.updated
customer.subscription.deleted
```

9. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Local webhook testing

Use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Copy the displayed webhook signing secret into `STRIPE_WEBHOOK_SECRET` for local development.

## App routes

- `POST /api/billing/checkout` creates a Stripe Checkout subscription session for Pro.
- `POST /api/billing/portal` creates a Stripe customer portal session.
- `POST /api/billing/webhook` verifies Stripe signatures and updates account billing state.
- `GET /api/billing/config` tells the Profile page whether billing buttons should be shown.

## Account data

Billing status is stored inside `AccountData.billing`:

- `tier`: `free` or `pro`
- `status`: `inactive`, `active`, `past_due`, or `canceled`
- `stripeCustomerId`
- `stripeSubscriptionId`
- `stripePriceId`
- `currentPeriodEnd`

Webhook events update this record through `updateAccountBilling()` in `lib/auth-store.ts`.

## Feature gates

Use the helpers in `lib/billing.ts`:

```ts
isProUser(account.data.billing)
canAccessProFeature(account.data.billing, "advancedFilters")
```

Current Pro features are placeholders and disabled by default. Do not lock the normal UnlockED dashboard, Discover page, saved opportunities, or profile editing behind payment.
