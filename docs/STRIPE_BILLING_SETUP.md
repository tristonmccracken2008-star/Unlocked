# Stripe Billing Setup

UnlockED uses Stripe Checkout, Stripe Billing, Stripe Customer Portal, and webhooks. Card data is collected only by Stripe.

## Required Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`STRIPE_PRO_PRICE_ID` remains accepted only as a legacy fallback for monthly pricing. New deployments should use the monthly and annual variables.

Never mix test-mode price IDs with live-mode keys.

Production must use a canonical HTTPS `NEXT_PUBLIC_APP_URL`. Store every Stripe secret only in the deployment platform's encrypted environment settings; never expose a secret key or webhook secret through a `NEXT_PUBLIC_` variable.

## Stripe Dashboard

1. Create product: `UnlockED Pro`.
2. Add recurring monthly price: intended public copy `$4.99/month`.
3. Add recurring annual price: intended public copy `$39.99/year`.
4. Copy the monthly and annual Price IDs into the matching environment variables.
5. Enable Customer Portal features for payment method updates, invoice viewing, cancellation, and plan changes if desired.
6. Configure tax collection in Stripe if required for launch. UnlockED does not claim tax is enabled automatically.

## Webhook

Create a webhook endpoint:

```text
https://YOUR_DOMAIN/api/billing/webhook
```

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Paste the signing secret into `STRIPE_WEBHOOK_SECRET`.

The endpoint verifies the signature against the untouched raw body with a five-minute timestamp tolerance. It also verifies live/test mode, event shape, configured Price IDs, Checkout metadata ownership, existing customer ownership, and event ordering. Event IDs are claimed atomically for replay protection, and events for the same Stripe customer are serialized to prevent stale concurrent updates. Browser redirects and success pages never grant Pro access.

## Subscription Data

The public account model exposes a redacted `AccountData.billing` view. Canonical billing state is stored in a dedicated server-side account billing record so concurrent profile writes cannot overwrite Stripe state:

- `tier`: `free` or `pro`
- `status`: `free`, `trialing`, `active`, `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `canceled`, or `paused`
- `stripeCustomerId`
- `stripeSubscriptionId`
- `stripePriceId`
- `billingInterval`: `month`, `year`, or `null`
- `currentPeriodStart`
- `currentPeriodEnd`
- `cancelAtPeriodEnd`

Stripe webhooks are the source of truth for Pro access. Checkout success pages do not grant access by themselves.

## Entitlement Policy

Pro access is granted for:

- `trialing`
- `active`
- `past_due` during Stripe retry/grace
- `canceled` only while `cancelAtPeriodEnd` is true and `currentPeriodEnd` is still in the future

No Pro access:

- `free`
- `unpaid`
- `incomplete`
- `incomplete_expired`
- expired `canceled`
- `paused`

## Test Mode Checklist

1. Set all Stripe test-mode environment variables.
2. Run `stripe listen --forward-to localhost:3000/api/billing/webhook`.
3. Copy the CLI webhook secret into `STRIPE_WEBHOOK_SECRET`.
4. Start the app.
5. Sign in and complete onboarding.
6. Open `/pricing`.
7. Choose Monthly or Annual Pro.
8. Complete Checkout with a Stripe test card.
9. Confirm webhook delivery updates Profile billing.
10. Confirm For You unlocks the full feed.
11. Open Customer Portal from Profile.
12. Schedule cancellation and verify Pro remains active through the period end.
13. Simulate failed payment and verify `past_due` messaging.

## Live Launch Checklist

- Replace test keys with live keys.
- Replace test price IDs with live price IDs.
- Configure the live webhook endpoint.
- Verify the webhook signing secret belongs to that exact endpoint and environment.
- Enable Stripe webhook delivery alerts and monitor non-2xx responses.
- If the deployment firewall supports it, allow Stripe webhook source IPs using Stripe's current published list in addition to signature verification.
- Configure Customer Portal cancellation and invoice settings.
- Confirm tax settings operationally.
- Confirm Terms, Privacy, and cancellation language are public.
- Run `npm run check:billing`.
- Run `npm run check:security` and `npm audit --omit=dev`.
- Run `npm run build`.
