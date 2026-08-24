# Application Materials

Application Materials is the private, account-owned record of reusable application work. It connects material metadata to official, verified opportunity requirements without creating a second application or Journey state system.

## Current storage boundary

UnlockED does not currently have an audited private object store. The feature therefore stores metadata only:

- material type, title, version label, status, contexts, and an optional private note
- which material version the student selected for a verified application requirement
- a bounded historical snapshot of that association so deleting a material does not rewrite application history

The product does not accept document uploads, store document contents, generate public file URLs, parse transcripts, or index private notes in Universal Search. File upload and preview remain deferred until authenticated private object storage, authorization, malware scanning, quotas, deletion, and signed-download behavior have been designed and audited.

## Ownership and persistence

- `AccountData.applicationMaterials` is the canonical store.
- `/api/materials` is the only mutation boundary.
- Mutations require a valid session, same-origin request validation, rate limiting, an account-scoped security lock, and expected-version checks.
- Generic account synchronization preserves the canonical material store and cannot overwrite it.
- Materials remain available on Free accounts and after a downgrade.
- Public account projections omit all material data.
- Account export includes the student's material metadata and associations; account deletion removes them with the account.

## Requirement intelligence

Requirement mapping is deterministic and limited to `verifiedApplicationRequirements`. Controlled rules map official requirement text to a canonical material type. Unknown or unverified requirements are not guessed.

`Ready` is a student-owned organization status, not an UnlockED quality assessment. A material can be available while still needing changes for an opportunity's exact instructions.

## Product integration

- **Materials:** create and organize versions, choose a preferred version, archive records, and see cross-application reuse.
- **Application Command Center:** select an existing matching version for a verified requirement. Selection is separate from task completion and application submission.
- **Planner:** approaching verified deadlines can surface a factual missing-material count.
- **Universal Search:** indexes title, version, type, and controlled context only. Notes and contents are excluded.
- **Guidance and Learn:** explain the metadata-only storage boundary and the relationship between Journey, applications, and Materials.

Recommendations do not treat a material as relevant until the opportunity is in Journey. Material readiness never changes eligibility or recommendation ranking.

## Data integrity

- Multiple versions of the same material type are supported.
- One version may be preferred for candidate ordering.
- Associations are idempotent and scoped to an opportunity plus canonical requirement type.
- Archived or deleted records stop counting as available.
- Deleted associations retain a minimal immutable snapshot for historical integrity.
- Active projections exclude terminal Journey records.

## Validation

Run:

```bash
npm run check:application-materials
npm run test:application-materials-browser
```

The deterministic check covers requirement mapping, three-application reuse, version preservation, deletion history, downgrade safety, account isolation, and bounded projection performance. The browser suite covers the protected page, Command Center selection, persistence, mobile, dark mode, reduced motion, Chromium, and WebKit.
