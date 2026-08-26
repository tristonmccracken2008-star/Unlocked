# Application Packets

Application Packets are a private, server-derived view of one pursued opportunity. They do not introduce a packet store.

## Ownership

- Journey owns pursuit status, submission, outcomes, and lifecycle history.
- Application Workspace owns verified-requirement tasks and private application tasks.
- Materials owns reusable records, versions, readiness labels, and application associations.
- Resume Lab owns resume content and opportunity targets.
- Calendar Intelligence owns cross-application timing and deadline clusters.
- Opportunity Changelog owns verified provider changes.
- Application Packet composes those sources for one application and delegates every mutation to the owning API.

## Readiness semantics

`Known materials assembled` means all currently verified material requirements have a selected record marked Ready and all known requirement tasks are recorded complete. It is not a quality score, competitiveness assessment, submission confirmation, or claim that the provider's full requirement set is known.

If requirements are unverified, the Packet says so and does not use an artificial denominator. Unknown requirements remain unknown.

## Historical behavior

Journey remains authoritative for submission. Material associations retain their selection snapshots. Once an application reaches a submitted or later state, Packet treats those snapshots as historical and Materials rejects replacement or removal of the submitted selection.

## Deterministic next action

The Packet selects one next action in this order: provider change, missing or unselected verified Material, available Material needing review, selected Material needing review, incomplete verified-requirement task, incomplete private task, official-requirements review, then final review. A submitted or later application instead hands back to Journey outcome tracking. Deadline urgency remains visible in the header and Calendar context; it does not replace a concrete preparation action.

## Derived material state

Packet derives `Selected`, `Available`, `Needs attention`, and `Missing` from the existing Materials records and associations. It also reports factual reuse when the exact selected Material record is associated with another pursued application. It never chooses a Material automatically.

Materials currently has record versions but no trustworthy ancestry between separately created records. Packet therefore preserves the selected version label and historical snapshot, but deliberately does not claim that another record is a newer version. That signal remains deferred until Materials can prove lineage.

Core Packet preparation remains available without a Pro entitlement, and historical Packets remain visible after downgrade. Existing account export and deletion cover the authoritative Journey, Workspace, Materials, Resume Lab, and Calendar records from which Packets are derived; there is no additional Packet data to export or delete.

## Privacy

Packets are authenticated, account-isolated, non-indexable, and rendered server-first. Analytics use bounded state tokens only; material names, task text, notes, and document contents are never sent.
