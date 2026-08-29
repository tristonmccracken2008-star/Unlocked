import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import type { JourneyCommandRecord } from "../lib/journey-command-center";
import type { JourneyCalendarItem, JourneyCalendarModel } from "../lib/journey-calendar";
import type { CalendarIntelligenceModel } from "../lib/calendar-intelligence";
import type { PersonalOpportunityStrategy } from "../lib/personal-opportunity-strategy";
import { projectJourneyWorkspace } from "../lib/journey-workspace";

function record(id: string, overrides: Partial<JourneyCommandRecord> = {}): JourneyCommandRecord {
  return {
    id, title: `Opportunity ${id}`, organization: `Organization ${id}`, category: "Internships",
    status: "Applying", stageLabel: "Preparing application", stageFilter: "preparing",
    savedAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-20T12:00:00.000Z",
    statusDetail: "Preparation in progress", history: [], historyFullyProjected: true, unavailable: false,
    ...overrides,
  };
}

function calendar(items: JourneyCalendarItem[] = []): JourneyCalendarModel {
  return { items, groups: [], initialMonth: "2026-08", timezone: "UTC", trackedOptions: [] };
}

const emptyPeriod = (days: 30 | 60 | 90) => ({ horizonDays: days, clusters: [], unclustered: [], fixedCount: 0, userEditableCount: 0, deadlineCount: 0, taskCount: 0, openingCount: 0, monthSummaries: [] });
const intelligence: CalendarIntelligenceModel = {
  version: "calendar-intelligence-v1", timezone: "UTC", generatedForDate: "2026-08-28",
  periods: { "30": emptyPeriod(30), "60": emptyPeriod(60), "90": emptyPeriod(90) }, undatedTaskCount: 0,
};
const strategy = {
  version: "personal-opportunity-strategy-v1", generatedAt: "2026-08-28T12:00:00.000Z", pro: false,
  currentCount: 3, pursuingCount: 3, watchingCount: 0, activeApplicationCount: 2, unknownRecordCount: 0,
  typeMix: [{ id: "internship", label: "Internships", count: 2 }, { id: "research", label: "Research", count: 1 }],
  fieldMix: [], organizationContext: [], timing: { knownDeadlineCount: 1, clusterCount: 0, summary: "One known deadline." },
  similarities: [], goals: [], watching: { count: 0, overlappingCount: 0 },
  applications: { activeCount: 2, openRequirementCount: 2, recurringRequirements: [] }, historyContext: [],
} satisfies PersonalOpportunityStrategy;
const workspace = {
  opportunityId: "deadline", eligible: true, requirementsVerified: true, tasks: [], completedCount: 0, totalCount: 2,
  progressPercent: 0, readyForSubmission: false, submitted: false, workspaceVersion: 0,
  officialSource: "https://example.test", sourceVerified: true, deadline: "2026-09-03", deadlineDaysRemaining: 6,
  unfinishedCount: 2, materials: { opportunityId: "deadline", storeVersion: 0, requirementsVerified: true, mappedRequirements: [], missingCount: 0, availableCount: 0, summary: "No reusable materials required." },
} satisfies NonNullable<JourneyCommandRecord["applicationWorkspace"]>;

const provider = record("provider", { recentChange: { label: "Deadline changed to September 2", detectedAt: "2026-08-27T12:00:00.000Z", importance: "critical" }, applicationWorkspace: { ...workspace, opportunityId: "provider", unfinishedCount: 0, totalCount: 0, deadline: undefined, deadlineDaysRemaining: undefined } });
const deadline = record("deadline", { applicationWorkspace: workspace });
const generic = record("generic", { applicationWorkspace: { ...workspace, opportunityId: "generic", requirementsVerified: false, unfinishedCount: 0, totalCount: 0, deadline: undefined, deadlineDaysRemaining: undefined } });
const projected = projectJourneyWorkspace({ records: [generic, deadline, provider], calendar: calendar(), calendarIntelligence: intelligence, strategy });
assert.equal(projected.nextAction?.kind, "provider_change");
assert.equal(projected.secondaryActions[0]?.kind, "deadline_requirements");
assert.ok(projected.secondaryActions.length <= 2);
assert.equal(new Set([projected.nextAction, ...projected.secondaryActions].map((item) => item?.recordId)).size, 3);
assert.doesNotMatch(projected.secondaryActions.map((item) => item.reason).join(" "), /unknown|unverified requirement/i);

const submitted = projectJourneyWorkspace({ records: [record("submitted", { status: "Submitted", stageFilter: "applied", applicationWorkspace: { ...workspace, opportunityId: "submitted", submitted: true } })], calendar: calendar(), calendarIntelligence: intelligence, strategy });
assert.equal(submitted.nextAction, undefined, "A quiet submitted pursuit must not receive a generic continue action.");

const task: JourneyCalendarItem = { id: "task", type: "personal_target", title: "Request transcript", date: "2026-08-29", opportunityId: "task-record", opportunityTitle: "Task opportunity", source: "application_task", completed: false, dismissed: false, version: 0, urgency: "tomorrow", timingLabel: "Tomorrow", statusAwarePassed: false };
const taskProjection = projectJourneyWorkspace({ records: [record("task-record", { applicationWorkspace: { ...workspace, opportunityId: "task-record", requirementsVerified: false, unfinishedCount: 0, totalCount: 0, deadline: undefined, deadlineDaysRemaining: undefined } })], calendar: calendar([task]), calendarIntelligence: intelligence, strategy });
assert.equal(taskProjection.nextAction?.kind, "task_due");

const many = Array.from({ length: 50 }, (_, index) => record(`large-${index}`, { applicationWorkspace: { ...workspace, opportunityId: `large-${index}`, deadlineDaysRemaining: index % 15 } }));
const timings: number[] = [];
for (let run = 0; run < 40; run += 1) {
  const started = performance.now();
  projectJourneyWorkspace({ records: many, calendar: calendar(), calendarIntelligence: intelligence, strategy });
  timings.push(performance.now() - started);
}
timings.sort((left, right) => left - right);
const p95 = timings[Math.ceil(timings.length * .95) - 1]!;
assert.ok(p95 < 10, `50-record Journey home projection p95 must remain under 10ms; received ${p95.toFixed(2)}ms.`);
console.log(JSON.stringify({ message: "Journey precedence, bounded attention, uncertainty safety, and performance checks passed.", p95Ms: Number(p95.toFixed(2)) }, null, 2));
