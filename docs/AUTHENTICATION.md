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

## Storage note

The current implementation uses the same server API boundary that should be kept for production, with a local file-backed store for development. For production-grade cross-device persistence on Vercel, replace the file store in `lib/auth-store.ts` with a persistent database or KV store.
