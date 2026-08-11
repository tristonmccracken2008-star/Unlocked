# Information Hierarchy Audit

Date: August 11, 2026

## Scope

Reviewed Discover, For You, opportunity details, Journey, the Application Command Center, Deadline Calendar, Notifications, Profile, Learn UnlockED, Universal Search, Smart Return, contextual guidance, empty states, next actions, and feedback/Undo surfaces.

The audit preserved existing routes, persistence, structured recommendation logic, account security, and feature availability. Changes were limited to presentation order, emphasis, copy, and progressive disclosure.

## Meaningful Changes

### Journey priorities

**Before:** Upcoming dates appeared before the bounded Needs attention list. On application rows, Continue application and Update carried similar visual weight, while the last-updated value occupied a separate desktop column. Students had to scan several controls before finding the task most likely to move an application forward.

**After:** Needs attention appears before the schedule. Continue application is the visually dominant row action, Update status is secondary, and updated metadata sits quietly with the organization. Opportunity identity, stage, deadline or task progress, and the next action now form one scan path.

### Journey depth

**Before:** Every calendar group could expose several rows at once, including passed dates, and an unavailable Journey Card rendered as a full empty-state panel. Both increased page length even when they were secondary to active applications.

**After:** Upcoming shows the five nearest current dates, with all remaining and passed dates available through an accessible disclosure. An unavailable Journey Card is a compact disclosure that explains the requirement when opened. Calendar mode, date creation, editing, reminders, history, and Journey Card eligibility remain unchanged.

### Application workspace

**Before:** Verified requirements and private tasks shared the same visual treatment, and completed work could interrupt the unfinished workflow.

**After:** Unfinished tasks are listed first under a clear “What’s left” heading. Every row identifies whether it is a verified requirement or the student’s private task. Completed tasks remain directly available and reversible, while progress, deadlines, provider updates, submission, task creation, source access, feedback, and Undo remain intact.

### For You

**Before:** Recommendation cards could show four simultaneous match badges before their detailed explanation disclosure.

**After:** The immediate surface is limited to the three strongest structured signals. Full recommendation reasoning, trust evidence, related paths, and feedback controls remain available through the existing disclosures.

## Surfaces Retained

- Discover remains search-first; its existing filter disclosure and opportunity actions already establish a clear hierarchy.
- Opportunity detail pages continue to lead with identity, deadline/status, eligibility, value, and the official action before supporting details and changelog history.
- Notifications already group by time, distinguish unread state quietly, and expose one contextual action without metadata overload.
- Smart Return remains bounded and continues to replace, rather than duplicate, Journey summary content when present.
- Profile, Learn UnlockED, Universal Search, contextual guidance, smart empty states, action feedback, and Undo retain their established interaction contracts.

## Accessibility And Performance

The new disclosures use native `details` and `summary`, preserve chronological DOM order, remain keyboard accessible, and inherit reduced-motion and forced-color handling. Calendar projection and recommendation calculations were not changed. No client geometry, new data request, or UI framework was introduced.
