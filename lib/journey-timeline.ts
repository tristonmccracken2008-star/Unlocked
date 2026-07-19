import type { Opportunity } from "@/data/opportunities";
import { getJourneyTransitionActions, type JourneyTransitionAction } from "@/data/journey-transformations";
import type { JourneyProgressTransition, OpportunityTrackerStatus, TrackedOpportunity } from "@/data/student-activity";
import { schools } from "@/data/index";
import type { AccountData, AuthUser } from "@/lib/account-types";
import { isProUser } from "@/lib/billing";

export type JourneyTimelineEventType =
  | "saved"
  | "interested"
  | "application_started"
  | "application_submitted"
  | "interview"
  | "accepted"
  | "scholarship_awarded"
  | "completed"
  | "paused"
  | "resumed"
  | "closed"
  | "milestone";

export type JourneyTimelineControl = {
  opportunityId: string;
  opportunityTitle: string;
  status: OpportunityTrackerStatus;
  version: number;
  actions: JourneyTransitionAction[];
};

export type JourneyTimelineEvent = {
  id: string;
  occurredAt: string;
  type: JourneyTimelineEventType;
  label: string;
  title: string;
  description: string;
  status: OpportunityTrackerStatus | "Milestone";
  opportunity?: Opportunity;
  control?: JourneyTimelineControl;
};

export type JourneyCardStat = {
  id: "saved" | "submitted" | "interviewed" | "accepted" | "completed" | "scholarships" | "milestones";
  label: string;
  value: number;
};

export type JourneyCardData = {
  identity: { firstName: string; fullName: string; school?: string };
  dateRange: string;
  headline: string;
  stats: JourneyCardStat[];
  highlights: Array<{ id: string; date: string; title: string; label: string }>;
};

export const journeyCardLayouts = {
  story: { label: "Instagram Story", width: 1080, height: 1920 },
  square: { label: "Square", width: 1080, height: 1080 },
  linkedin: { label: "LinkedIn", width: 1200, height: 627 },
} as const;

export type JourneyCardLayout = keyof typeof journeyCardLayouts;
export type JourneyCardPrivacy = {
  nameMode: "anonymous" | "first_name" | "full_name";
  includeSchool: boolean;
  includeDates: boolean;
};

export type JourneyTimelineModel = {
  events: JourneyTimelineEvent[];
  card: JourneyCardData;
  theme: "light" | "dark";
};

const statusFromTransition: Record<JourneyProgressTransition, OpportunityTrackerStatus> = {
  choose: "Interested",
  start: "Applying",
  submit: "Submitted",
  interview: "Interview",
  accept: "Accepted",
  complete: "Completed",
  pause: "Paused",
  resume: "Interested",
  close: "Rejected",
};

function safeDate(value: string | undefined, fallback: string) {
  return value && Number.isFinite(Date.parse(value)) ? value : fallback;
}

function eventCopy(status: OpportunityTrackerStatus, opportunity: Opportunity, resumed = false) {
  if (resumed) return { type: "resumed" as const, label: "Resumed", title: `Resumed ${opportunity.title}`, description: "This opportunity is active in your Journey again." };
  if (status === "Saved") return { type: "saved" as const, label: "Saved", title: `Saved ${opportunity.title}`, description: "Added this opportunity to your Journey." };
  if (status === "Interested") return { type: "interested" as const, label: "Interested", title: `Chose to explore ${opportunity.title}`, description: "Marked this opportunity as worth pursuing." };
  if (status === "Applying") return { type: "application_started" as const, label: "Application started", title: `Started ${opportunity.title}`, description: "Began preparing an application." };
  if (status === "Submitted") return { type: "application_submitted" as const, label: "Submitted", title: `Submitted ${opportunity.title}`, description: "Recorded the application as submitted." };
  if (status === "Interview") return { type: "interview" as const, label: "Interview", title: `Interviewed for ${opportunity.title}`, description: "Recorded that the application reached an interview." };
  if (status === "Accepted" && opportunity.type === "Scholarship") return { type: "scholarship_awarded" as const, label: "Scholarship awarded", title: `Earned ${opportunity.title}`, description: "Recorded this scholarship as awarded." };
  if (status === "Accepted") return { type: "accepted" as const, label: "Accepted", title: `Accepted into ${opportunity.title}`, description: "Recorded that the opportunity was received." };
  if (status === "Completed") return { type: "completed" as const, label: "Completed", title: `Completed ${opportunity.title}`, description: "Recorded this opportunity as completed." };
  if (status === "Paused") return { type: "paused" as const, label: "Paused", title: `Paused ${opportunity.title}`, description: "Paused this opportunity without removing its history." };
  return { type: "closed" as const, label: "Closed", title: `Closed ${opportunity.title}`, description: "Closed this opportunity while keeping it in the Journey record." };
}

function controlFor(record: TrackedOpportunity, opportunity: Opportunity): JourneyTimelineControl | undefined {
  const actions = getJourneyTransitionActions(record);
  if (!actions.length) return undefined;
  return {
    opportunityId: record.id,
    opportunityTitle: opportunity.title,
    status: record.status,
    version: record.version ?? 0,
    actions,
  };
}

function recordEvents(record: TrackedOpportunity, opportunity: Opportunity, fallbackDate: string) {
  const events: JourneyTimelineEvent[] = [];
  const savedAt = safeDate(record.savedAt, fallbackDate);
  const savedCopy = eventCopy("Saved", opportunity);
  events.push({ id: `saved:${record.id}`, occurredAt: savedAt, ...savedCopy, status: "Saved", opportunity });

  const history = [...(record.history ?? [])].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  for (const item of history) {
    const status = item.resultingStatus ?? statusFromTransition[item.transition];
    const copy = eventCopy(status, opportunity, item.transition === "resume");
    events.push({ id: `transition:${record.id}:${item.id}`, occurredAt: safeDate(item.occurredAt, record.updatedAt), ...copy, status, opportunity });
  }

  const finalHistoryStatus = history.at(-1)?.resultingStatus;
  if (record.status !== "Saved" && finalHistoryStatus !== record.status) {
    const copy = eventCopy(record.status, opportunity);
    events.push({ id: `legacy-status:${record.id}:${record.status}`, occurredAt: safeDate(record.updatedAt, fallbackDate), ...copy, status: record.status, opportunity });
  }

  const last = events.at(-1);
  if (last) last.control = controlFor(record, opportunity);
  return events;
}

function readableMilestone(value: string) {
  return value.replace(/^milestone[-_:]?/i, "").replace(/[-_:]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim() || "Personal milestone";
}

function countAtOrBeyond(records: readonly TrackedOpportunity[], statuses: readonly OpportunityTrackerStatus[]) {
  const included = new Set(statuses);
  return records.filter((record) => included.has(record.status)).length;
}

function cardHeadline(stats: Record<JourneyCardStat["id"], number>) {
  if (stats.completed) return stats.completed === 1 ? "One opportunity completed." : `${stats.completed} opportunities completed.`;
  if (stats.accepted) return stats.accepted === 1 ? "One opportunity earned." : `${stats.accepted} opportunities earned.`;
  if (stats.interviewed) return stats.interviewed === 1 ? "Reached my first interview." : `Reached ${stats.interviewed} interviews.`;
  if (stats.submitted) return stats.submitted === 1 ? "Submitted my first application." : `Submitted ${stats.submitted} applications.`;
  if (stats.saved) return "My opportunity journey so far.";
  if (stats.milestones) return "A milestone worth remembering.";
  return "My Journey starts here.";
}

function cardDateRange(events: readonly JourneyTimelineEvent[]) {
  const years = [...new Set(events.map((event) => new Date(event.occurredAt).getUTCFullYear()).filter(Number.isFinite))].sort();
  if (!years.length) return String(new Date().getUTCFullYear());
  return years.length === 1 ? String(years[0]) : `${years[0]}–${years.at(-1)}`;
}

export function buildJourneyTimelineModel(input: {
  user: Pick<AuthUser, "name">;
  account: AccountData;
  opportunities: readonly Opportunity[];
  resolvedTheme?: "light" | "dark";
}): JourneyTimelineModel {
  const opportunityById = new Map(input.opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const recordsById = { ...(input.account.activity?.tracked ?? {}), ...(input.account.tracker ?? {}) };
  const fallbackDate = safeDate(input.account.updatedAt, new Date().toISOString());
  const events = Object.values(recordsById).flatMap((record) => {
    const opportunity = opportunityById.get(record.id);
    return opportunity ? recordEvents(record, opportunity, fallbackDate) : [];
  });

  for (const [milestoneId, complete] of Object.entries(input.account.journeyProgress ?? {})) {
    if (!complete) continue;
    const title = readableMilestone(milestoneId);
    events.push({
      id: `milestone:${milestoneId}`,
      occurredAt: fallbackDate,
      type: "milestone",
      label: "Milestone",
      title,
      description: "Recorded as a completed personal milestone.",
      status: "Milestone",
    });
  }

  events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
  const records = Object.values(recordsById);
  const acceptedStatuses: OpportunityTrackerStatus[] = ["Accepted", "Completed"];
  const values: Record<JourneyCardStat["id"], number> = {
    saved: records.length,
    submitted: countAtOrBeyond(records, ["Submitted", "Interview", "Accepted", "Completed"]),
    interviewed: countAtOrBeyond(records, ["Interview", "Accepted", "Completed"]),
    accepted: countAtOrBeyond(records, acceptedStatuses),
    completed: countAtOrBeyond(records, ["Completed"]),
    scholarships: records.filter((record) => acceptedStatuses.includes(record.status) && opportunityById.get(record.id)?.type === "Scholarship").length,
    milestones: Object.values(input.account.journeyProgress ?? {}).filter(Boolean).length,
  };
  const labels: Record<JourneyCardStat["id"], string> = {
    saved: "Saved",
    submitted: "Submitted",
    interviewed: "Interviewed",
    accepted: "Accepted",
    completed: "Completed",
    scholarships: "Scholarships",
    milestones: "Milestones",
  };
  const stats = (Object.keys(values) as JourneyCardStat["id"][])
    .filter((id) => values[id] > 0)
    .slice(0, 6)
    .map((id) => ({ id, label: labels[id], value: values[id] }));
  const meaningfulTypes = new Set<JourneyTimelineEventType>(["application_submitted", "interview", "accepted", "scholarship_awarded", "completed", "milestone"]);
  const meaningful = events.filter((event) => meaningfulTypes.has(event.type));
  const highlights = (meaningful.length ? meaningful : events).slice(-4).map((event) => ({ id: event.id, date: event.occurredAt, title: event.title, label: event.label }));
  const profile = input.account.profile;
  const firstName = profile?.firstName?.trim() || input.user.name.trim().split(/\s+/)[0] || "Student";
  const profileName = [profile?.firstName, profile?.lastName].map((part) => part?.trim()).filter(Boolean).join(" ");
  const school = profile ? schools.find((item) => item.slug === profile.schoolSlug)?.name : undefined;
  const appearance = input.account.preferences?.appearance ?? "light";
  const theme = input.resolvedTheme ?? (isProUser(input.account.billing) && (appearance === "midnight" || appearance === "forest") ? "dark" : "light");

  return {
    events,
    theme,
    card: {
      identity: { firstName, fullName: profileName || input.user.name.trim() || firstName, school },
      dateRange: cardDateRange(events),
      headline: cardHeadline(values),
      stats,
      highlights,
    },
  };
}
