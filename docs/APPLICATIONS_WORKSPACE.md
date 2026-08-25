# Applications Workspace

`/applications` is the cross-application execution layer. It answers which active applications need attention, what factual work remains, which verified deadlines are near, and which reusable Materials are selected or available.

## Source systems

The route stores no application workspace of its own. `buildApplicationsWorkspace()` projects:

- Journey tracker records for lifecycle and optimistic-concurrency versions;
- Application Command Center records for verified-requirement and private tasks;
- Materials records and explicit per-application associations;
- current canonical opportunity records for verified requirements, official links, deadlines, and provider changes.

All writes reuse the existing authenticated, same-origin, rate-limited, account-scoped APIs. Task changes use `/api/journey/application`, Material selection uses `/api/materials`, and submission uses `/api/journey/transition`. The server remains authoritative and stale versions return conflicts.

## Lifecycle boundary

- Saved-only records stay in Journey.
- Interested, Applying, and Paused application-capable records appear in active execution.
- Submitted and Interview records appear in the submitted/waiting view and no longer produce preparation attention.
- Accepted, Completed, Rejected, withdrawn, archived, and non-application resources stay outside the active workspace.

Opening a provider URL, selecting Materials, or completing tasks never marks an application as submitted. Only the existing Journey transition does that after an explicit student action.

## Deterministic states

- **Needs attention:** a verified reusable requirement is missing, unselected, or uses a Material not marked Ready; an authoritative requirement/private task is incomplete; or a provider change affects the application.
- **Ready:** all currently verified requirements UnlockED knows about are recorded complete, every mapped reusable requirement has a Ready version explicitly selected, and no private task remains incomplete.
- **Requirements not verified:** UnlockED has no verified requirement set. This state is never projected as Ready.
- **Paused:** the student paused the Journey record.
- **Submitted / Interviewing:** post-submission records shown for continuity, outside the preparation queue.

A verified deadline can place a Ready application in the factual attention list without changing its Ready state. No score, inferred workload, or synthetic urgency is used.

## Ordering and next actions

Applications sort by unresolved factual attention, then attention priority, verified deadline, latest account update, and title. Next actions are selected from the same evidence in this order: missing Material, Material needing review, provider change, incomplete task, explicit Mark as applied for Ready applications, provider review for unknown requirements, then provider application access.

Deadline clusters require at least two verified application deadlines within seven days. Personal task dates remain explicitly labeled as task dates and are never presented as provider deadlines.

## Materials

Cross-application material demand is a projection grouped by canonical Material type. Associations are never created automatically. Different applications may retain different versions, and changing a preferred version never rewrites historical associations.

## Free and Pro

The core workspace, readiness, requirements, tasks, Materials, and deadlines are available to Free users. No source record is removed or changed on downgrade. The current version does not add a Pro-only workspace mode.

## Privacy and failure isolation

The projection runs for the authenticated account on the server and receives only that account’s records. No titles, organizations, task text, Material names, or requirement text are sent to product analytics. A route composition failure renders a truthful recovery state and does not mutate Journey, Materials, Calendar, or notifications.

## Validation

Run:

```bash
npm run check:applications-workspace
npm run check:application-command-center
npm run check:application-materials
npm run check:journey-calendar
npm run lint
npm run build
```
