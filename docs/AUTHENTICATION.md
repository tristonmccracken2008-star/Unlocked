# UnlockED Google Sign-In

UnlockED uses Google OAuth for authenticated accounts.

## Required environment variables

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate `AUTH_SECRET` with at least 32 random bytes, for example `openssl rand -base64 32`. For Vercel, set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS production origin, for example:

```bash
NEXT_PUBLIC_APP_URL=https://unlocked-sable.vercel.app
```

## Google OAuth redirect URI

Add this redirect URI in Google Cloud Console:

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

For local development:

```text
http://localhost:3000/api/auth/callback/google
```

## What syncs

After sign-in, UnlockED migrates existing guest data into the account:

- student profile
- school
- major
- academic year
- interests and goals
- saved opportunities
- opportunity tracker status
- viewed / claimed opportunity progress
- journey milestone progress

## Production account data storage

OAuth uses a single-use state cookie and PKCE (`S256`). Signed session cookies are HTTP-only, Secure in production, SameSite=Lax, and contain no name or email. The cookie points to a revocable server-side session record. Account data is loaded and saved through `/api/account/data`; browser responses redact internal billing, referral, and advisor identifiers.

Starting a new same-site OAuth flow revokes any current server-side session before clearing its cookie. Cross-site login-start requests are rejected to prevent forced logout. A successful callback also revokes any session it replaces before issuing a new one. Signing out deletes the server-side session before expiring browser cookies. Rotating `AUTH_SECRET` invalidates all existing sessions and pseudonymous browser user IDs.

For production cross-device sync on Vercel, configure one of these KV-compatible REST stores:

```bash
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

or:

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

UnlockED stores authenticated account data in KV/Upstash Redis. In production, these variables are required. Local development without KV uses a temporary in-memory store only; it is not used for production persistence.

Set `RATE_LIMIT_SECRET` to an independent random value if rate-limit identifiers should remain stable across `AUTH_SECRET` rotation. Authenticated mutations require a same-origin request and are protected by bounded request parsing and distributed rate limits.
