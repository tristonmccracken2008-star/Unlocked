# UnlockED content management

The internal CMS is available at `/admin/content`. It is not linked from public navigation and is marked `noindex`.

## Production configuration

The CMS uses the same Vercel KV or Upstash Redis REST store as account sync. Configure one pair:

```text
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

or:

```text
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Set the administrator allowlist using lowercase or mixed-case emails separated by commas:

```text
ADMIN_EMAILS=admin@example.edu,editor@example.edu
```

Only a signed-in Google account whose email appears in `ADMIN_EMAILS` can load the CMS or call its APIs. In local development only, any authenticated account is accepted when `ADMIN_EMAILS` is empty.

## Data behavior

- `data/db/opportunities.json` is the bootstrap catalog.
- Creates and edits are stored as production records in KV/Redis.
- Managed records override bootstrap records with the same ID.
- Archive hides a record without deleting its content.
- Delete writes a persistent tombstone, including for bootstrap records, so a deployment cannot restore deleted content accidentally.
- The opportunity directory, opportunity detail pages, global search, and sitemap read the managed catalog.
- The most recent 500 edit-log entries are retained. Each contains the timestamp, admin email, action, opportunity ID, and changed field names.

Every write is validated server-side. Required fields, HTTPS official sources, dates, status values, scope, school association, and estimated values are checked before storage.
