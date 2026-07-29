# Journey Command Center Audit

Date: 2026-07-29

## Current architecture

- `/` authenticates on the server, loads every tracked opportunity, builds a full
  `JourneyTimelineModel`, and renders a chronological Journey document.
- Journey state is stored in the account `tracker` and mirrored in
  `activity.tracked`. The canonical status enum is `Saved`, `Interested`,
  `Applying`, `Submitted`, `Interview`, `Accepted`, `Paused`, `Rejected`, and
  `Completed`.
- Professional workflow stages refine those canonical statuses by opportunity
  type. Mutations use `/api/journey/transition`, expected status/version checks,
  idempotency keys, ownership from the server session, and a per-account security
  lock.
- Public opportunity lifecycle is resolved independently and is already rendered
  as informational context rather than a Journey mutation.
- Notes, dates, reminders, and document-reference metadata live on transition
  history entries. History is bounded to 100 entries per record.
- Journey Cards are generated from factual Journey events and export square,
  story, and LinkedIn images. They are private until the user exports or shares
  them.

## Why the current page becomes messy

1. The primary unit is an event, not an opportunity. A student with ten active
   opportunities can see dozens of repeated event blocks before understanding
   which records still need work.
2. Summary, highlights, timeline, annual archive, and sharing repeat many of the
   same facts at different visual weights.
3. Every event can repeat organization, category, lifecycle, date, detail,
   controls, and status copy. The most recent event is the only one that can
   update the record, but that distinction is not obvious.
4. Historical records and saved-only records share the same chronological surface
   as active applications.
5. The chronological document renders all events into the initial DOM. CSS
   containment helps rendering, but does not reduce DOM size, server payload, or
   search effort.
6. Filters operate on events rather than current records, so they do not answer
   the common question, "Which applications am I actively managing?"
7. The update dialog is authoritative and safe, but presents a full stage rail and
   several optional fields before the student has chosen a change.

## Duplicated or overlapping concepts

- `tracker` and `activity.tracked` are compatibility mirrors. The server merge
  layer already resolves them; no third Journey store should be introduced.
- Canonical statuses and professional stages overlap by design. Canonical status
  remains the persistence contract; professional stage is the more precise
  display label.
- `Rejected` currently also represents the professional "Archived" terminal
  stage. The rebuild must call this "Archived" only when the professional stage
  says archived, and otherwise retain factual "Closed" language.
- Saved milestones, timeline saved events, summary saved counts, and highlights
  can repeat the same low-signal action.

## Weak interactions

- Finding an active record requires scanning a chronological history.
- Updating requires locating the newest event for that record.
- History filters do not preserve a compact opportunity-level view.
- Search is absent.
- An API failure during Profile hydration is converted into an unauthenticated
  client session, producing a false "session has ended" message.

## Scrolling and large-data risks

- The old model sends every event and all event metadata to the browser.
- A 300-record fixture can produce more than 500 timeline nodes.
- Annual archives summarize history but do not remove it from the initial page.
- Journey Card data, highlights, filters, and event history are composed together
  even when the user only needs active records.

## Systems retained

- Server session and route protection.
- Account ownership and account security locks.
- Canonical tracker and compatibility activity mirror.
- Professional workflow stages.
- Versioned, idempotent, server-authoritative transitions.
- Lifecycle resolver and notification scheduling.
- Journey Card artwork/export pipeline.
- Existing transition history and private metadata.
- Existing analytics transport and privacy restrictions.

## Systems replaced in the primary experience

- The full chronological document becomes a compact opportunity-level command
  center.
- The event-first filter model becomes current-stage filters and deterministic
  sorting.
- Historical events move behind collapsed, year-grouped History.
- Repeated summary/highlight sections become four factual overview values and a
  bounded Needs Attention list.
- The update control is presented from each current record instead of only from
  the final timeline event.

## Legacy and migration risks

- Records with unknown status already normalize to `Saved`; these must be counted
  and reported, not silently advanced.
- Records whose public opportunity was deleted do not contain an identity
  snapshot. They can be preserved as unavailable records, but historic title and
  organization cannot be recovered when no snapshot was ever stored.
- Existing notes and reminders are transition metadata rather than editable
  first-class records. The first command-center version preserves and displays
  them; it does not create a duplicate reminder model.
- Existing `Rejected` records may mean closed, rejected, or archived. The
  professional stage ID is used where available; otherwise the conservative
  display is "Closed".
