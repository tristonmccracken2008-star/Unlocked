# Calendar Intelligence

Calendar Intelligence is a read-only, account-scoped projection inside Journey Calendar. Calendar owns dates; Conflict Planning explains when those dates bunch together. Planner remains the longer-range view of what is coming, and Applications remains the place to execute application work.

## Date sources

- **Application deadline:** a current, verified, fixed provider deadline for an actively prepared application.
- **Private application task:** an incomplete dated task from the existing Application Command Center store.
- **Opening date:** a verified exact opening date for an active or watched opportunity.
- **Journey date:** an existing student-managed date or verified program date already projected by Calendar.

Unknown, estimated, stale, and rolling deadlines never receive an invented date. Submitted, interviewed, accepted, rejected, and completed applications leave active pre-submission deadline analysis. Completed tasks and past dates are excluded.

## Identity and clustering

Provider dates use a canonical identity based on event kind, opportunity ID, and date. A deadline referenced by Journey, Calendar, and Application Workspace therefore counts once. Private tasks retain their own task-derived identities.

Events are sorted once. The projection scans non-overlapping seven-day windows and creates a cluster when the window contains:

- at least two application deadlines;
- at least three private application tasks; or
- at least one application deadline and at least three total dated items.

Two or more deadlines on the same date form a same-day cluster. A lone date remains a normal upcoming date; the system never manufactures a conflict. Cluster order is chronological. The “busiest period” fact is selected deterministically by deadline count, task count, missing-Materials context, and then date.

## Context and control

Provider deadlines and verified openings are labeled **fixed**. Private tasks and student-managed Journey dates are labeled **user-editable**. Conflict Planning never moves a provider date and never schedules work automatically.

Application and Materials context comes from the existing Application Workspace projection. Missing reusable Materials, uncovered verified requirements, and recent verified requirement changes can explain a deadline cluster, but they do not create synthetic dated events. Actions hand off to Applications or Materials.

Application tasks do not currently support editing after creation through the authoritative task API. Conflict Planning therefore offers “Review task dates” as an Applications handoff instead of introducing a second or weaker mutation path.

## Access, privacy, and performance

Calendar Intelligence is available to Free and Pro accounts because it organizes dates the student already owns. A downgrade cannot hide or delete those dates. No conflict records or preferences are persisted or exported.

The server projection is built from the authenticated account and request catalog only. It uses no global mutable account cache and no external request. Analytics contain only bounded view/action tokens; titles, dates, task text, Materials, and counts are not sent.

After sorting, cluster detection is a forward window scan. Request-scoped Material indexes are reused across applications. Strict regression coverage includes same-day deadlines, multi-day and mixed clusters, sparse data, watched openings, rolling and submitted exclusions, canonical deduplication, completed and undated tasks, timezone-safe dates, deterministic 500-event output, and a performance ceiling.

## Intentionally deferred

- Automatic task rescheduling or effort estimates.
- A separate Calendar Intelligence route or navigation item.
- New notifications for clusters.
- Persisted conflict snapshots for Smart Return.
- Task-date editing until the existing authoritative Application Command Center supports it.
