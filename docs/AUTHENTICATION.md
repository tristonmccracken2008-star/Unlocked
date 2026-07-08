# UnlockED Google Sign-In

UnlockED supports guest mode and Google OAuth sign-in.

## Required environment variables

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For Vercel, set `NEXT_PUBLIC_APP_URL` to the production URL, for example:

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

Signed sessions are stored in secure HTTP-only cookies. Account data is loaded and saved through `/api/account/data`.

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

When these variables are present, UnlockED stores account data in KV/Upstash Redis. The local `.unlocked-auth-store.json` file is only a development fallback and should not be used as production persistence.
