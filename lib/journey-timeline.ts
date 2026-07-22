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
  filters: JourneyTimelineFilterKey[];
};

export type JourneyTimelineFilterKey = "everything" | "applications" | "interviews" | "offers" | "scholarships" | "research" | "competitions" | "benefits" | "milestones";

export type JourneySummaryMetric = {
  id: "saved" | "submitted" | "interviewed" | "offers" | "scholarships" | "research" | "competitions" | "milestones";
  label: string;
  value: number;
};

export type JourneyHighlight = {
  id: string;
  label: string;
  title: string;
  description: string;
  occurredAt: string;
  opportunity?: Opportunity;
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
  periodTitle: string;
  stats: JourneyCardStat[];
  highlights: Array<{ id: string; date: string; title: string; label: string; organization?: string }>;
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
  summary: JourneySummaryMetric[];
  highlights: JourneyHighlight[];
  filterCounts: Record<JourneyTimelineFilterKey, number>;
  story: { title: string; description: string };
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
  if (status === "Applying") return { type: "application_started" as const, label: "Application started", title: `Started ${opportunity.title}`, description: "A possibility became active work." };
  if (status === "Submitted") return { type: "application_submitted" as const, label: "Submitted", title: `Submitted ${opportunity.title}`, description: "You now have real application experience to build on." };
  if (status === "Interview") return { type: "interview" as const, label: "Interview", title: `Interviewed for ${opportunity.title}`, description: "Your work received a response from outside UnlockED." };
  if (status === "Accepted" && opportunity.type === "Scholarship") return { type: "scholarship_awarded" as const, label: "Scholarship awarded", title: `Earned ${opportunity.title}`, description: "Recorded this scholarship as awarded." };
  if (status === "Accepted") return { type: "accepted" as const, label: "Accepted", title: `Accepted into ${opportunity.title}`, description: "A direction you pursued became a real opportunity." };
  if (status === "Completed") return { type: "completed" as const, label: "Completed", title: `Completed ${opportunity.title}`, description: "This experience is now evidence you can use in future applications." };
  if (status === "Paused") return { type: "paused" as const, label: "Paused", title: `Paused ${opportunity.title}`, description: "Paused this opportunity without removing its history." };
  return { type: "closed" as const, label: "Closed", title: `Closed ${opportunity.title}`, description: "Closed this opportunity while keeping it in the Journey record." };
}

function isApplicationOpportunity(opportunity?: Opportunity): opportunity is Opportunity {
  return Boolean(opportunity && opportunity.type !== "Benefit" && opportunity.type !== "AI" && opportunity.category !== "Software");
}

function filtersFor(type: JourneyTimelineEventType, opportunity?: Opportunity): JourneyTimelineFilterKey[] {
  const filters: JourneyTimelineFilterKey[] = ["everything"];
  const applicationOpportunity = isApplicationOpportunity(opportunity);
  if (applicationOpportunity && ["application_started", "application_submitted", "interview", "accepted", "scholarship_awarded", "completed"].includes(type)) filters.push("applications");
  if (type === "interview" && applicationOpportunity) filters.push("interviews");
  if (["accepted", "completed"].includes(type) && applicationOpportunity && opportunity?.type !== "Scholarship") filters.push("offers");
  if (type === "scholarship_awarded" || opportunity?.type === "Scholarship") filters.push("scholarships");
  if (opportunity?.type === "Research") filters.push("research");
  if (/competition/i.test(opportunity?.category ?? "") || /competition/i.test(opportunity?.type ?? "")) filters.push("competitions");
  if (opportunity?.type === "Benefit" || opportunity?.type === "AI" || ["Benefits", "Software"].includes(opportunity?.category ?? "")) filters.push("benefits");
  if (type === "milestone") filters.push("milestones");
  return [...new Set(filters)];
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
  events.push({ id: `saved:${record.id}`, occurredAt: savedAt, ...savedCopy, status: "Saved", opportunity, filters: filtersFor(savedCopy.type, opportunity) });

  const history = [...(record.history ?? [])].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  for (const item of history) {
    const status = item.resultingStatus ?? statusFromTransition[item.transition];
    const copy = eventCopy(status, opportunity, item.transition === "resume");
    events.push({ id: `transition:${record.id}:${item.id}`, occurredAt: safeDate(item.occurredAt, record.updatedAt), ...copy, status, opportunity, filters: filtersFor(copy.type, opportunity) });
  }

  const finalHistoryStatus = history.at(-1)?.resultingStatus;
  if (record.status !== "Saved" && finalHistoryStatus !== record.status) {
    const copy = eventCopy(record.status, opportunity);
    events.push({ id: `legacy-status:${record.id}:${record.status}`, occurredAt: safeDate(record.updatedAt, fallbackDate), ...copy, status: record.status, opportunity, filters: filtersFor(copy.type, opportunity) });
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

function journeyPeriodTitle(events: readonly JourneyTimelineEvent[]) {
  if (!events.length) return "My Journey";
  const dates = events.map((event) => new Date(event.occurredAt)).filter((date) => Number.isFinite(date.getTime()));
  const years = [...new Set(dates.map((date) => date.getUTCFullYear()))];
  if (years.length !== 1) return "My Journey";
  const months = dates.map((date) => date.getUTCMonth());
  const year = years[0];
  if (months.every((month) => month >= 5 && month <= 7)) return `Summer ${year}`;
  if (months.every((month) => month >= 8)) return `Fall ${year}`;
  if (months.every((month) => month <= 4)) return `Spring ${year}`;
  return `My ${year}`;
}

function buildHighlights(events: readonly JourneyTimelineEvent[], records: readonly TrackedOpportunity[], opportunityById: ReadonlyMap<string, Opportunity>, fallbackDate: string): JourneyHighlight[] {
  const candidates: JourneyHighlight[] = [];
  const firstApplication = events.find((event) => event.type === "application_submitted" && isApplicationOpportunity(event.opportunity));
  if (firstApplication) candidates.push({ id: "first-application", label: "First application", title: firstApplication.title, description: "The first submitted application recorded in your Journey.", occurredAt: firstApplication.occurredAt, opportunity: firstApplication.opportunity });
  const firstInterview = events.find((event) => event.type === "interview" && isApplicationOpportunity(event.opportunity));
  if (firstInterview) candidates.push({ id: "first-interview", label: "First interview", title: firstInterview.title, description: "The first interview-stage opportunity recorded in your Journey.", occurredAt: firstInterview.occurredAt, opportunity: firstInterview.opportunity });
  const firstOffer = events.find((event) => event.type === "scholarship_awarded" || (event.type === "accepted" && isApplicationOpportunity(event.opportunity)));
  if (firstOffer) candidates.push({ id: "first-offer", label: firstOffer.type === "scholarship_awarded" ? "First scholarship" : "First offer", title: firstOffer.title, description: firstOffer.type === "scholarship_awarded" ? "The first awarded scholarship recorded in your Journey." : "The first accepted opportunity recorded in your Journey.", occurredAt: firstOffer.occurredAt, opportunity: firstOffer.opportunity });

  const wonScholarships = records
    .filter((record) => ["Accepted", "Completed"].includes(record.status))
    .map((record) => ({ record, opportunity: opportunityById.get(record.id) }))
    .filter((item): item is { record: TrackedOpportunity; opportunity: Opportunity } => item.opportunity?.type === "Scholarship" && typeof item.opportunity.estimated_value === "number")
    .sort((left, right) => (right.opportunity.estimated_value ?? 0) - (left.opportunity.estimated_value ?? 0));
  const largestScholarship = wonScholarships[0];
  if (largestScholarship) candidates.push({ id: "largest-scholarship", label: "Largest scholarship", title: largestScholarship.opportunity.title, description: `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(largestScholarship.opportunity.estimated_value ?? 0)} recorded value.`, occurredAt: safeDate(largestScholarship.record.updatedAt, fallbackDate), opportunity: largestScholarship.opportunity });

  const competitive = records
    .filter((record) => ["Submitted", "Interview", "Accepted", "Completed"].includes(record.status))
    .map((record) => ({ record, opportunity: opportunityById.get(record.id) }))
    .find((item) => item.opportunity?.difficulty === "Highly Competitive");
  if (competitive?.opportunity) candidates.push({ id: "competitive-opportunity", label: "Competitive pursuit", title: competitive.opportunity.title, description: "Recorded as highly competitive in the verified opportunity catalog.", occurredAt: safeDate(competitive.record.updatedAt, fallbackDate), opportunity: competitive.opportunity });

  const newest = [...events].reverse().find((event) => event.type === "milestone" || event.type === "scholarship_awarded" || (["application_submitted", "interview", "accepted", "completed"].includes(event.type) && isApplicationOpportunity(event.opportunity)));
  if (newest) candidates.push({ id: "newest-achievement", label: "Newest achievement", title: newest.title, description: newest.description, occurredAt: newest.occurredAt, opportunity: newest.opportunity });

  const seenEvents = new Set<string>();
  return candidates.filter((highlight) => {
    const key = `${highlight.title}|${highlight.occurredAt}`;
    if (seenEvents.has(key)) return false;
    seenEvents.add(key);
    return true;
  }).slice(0, 4);
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
      filters: filtersFor("milestone"),
    });
  }

  events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
  const records = Object.values(recordsById);
  const applicationRecords = records.filter((record) => isApplicationOpportunity(opportunityById.get(record.id)));
  const acceptedStatuses: OpportunityTrackerStatus[] = ["Accepted", "Completed"];
  const values: Record<JourneyCardStat["id"], number> = {
    saved: records.length,
    submitted: countAtOrBeyond(applicationRecords, ["Submitted", "Interview", "Accepted", "Completed"]),
    interviewed: countAtOrBeyond(applicationRecords, ["Interview", "Accepted", "Completed"]),
    accepted: countAtOrBeyond(applicationRecords, acceptedStatuses),
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
  const summaryValues: Record<JourneySummaryMetric["id"], number> = {
    saved: records.length,
    submitted: values.submitted,
    interviewed: values.interviewed,
    offers: applicationRecords.filter((record) => acceptedStatuses.includes(record.status) && opportunityById.get(record.id)?.type !== "Scholarship").length,
    scholarships: values.scholarships,
    research: records.filter((record) => record.status === "Completed" && opportunityById.get(record.id)?.type === "Research").length,
    competitions: records.filter((record) => ["Accepted", "Completed"].includes(record.status) && /competition/i.test(opportunityById.get(record.id)?.category ?? "")).length,
    milestones: Object.values(input.account.journeyProgress ?? {}).filter(Boolean).length,
  };
  const summaryLabels: Record<JourneySummaryMetric["id"], string> = {
    saved: "Saved opportunities",
    submitted: "Applications submitted",
    interviewed: "Interviews earned",
    offers: "Offers received",
    scholarships: "Scholarships won",
    research: "Research experiences",
    competitions: "Competitions completed",
    milestones: "Personal milestones",
  };
  const summary = (Object.keys(summaryValues) as JourneySummaryMetric["id"][]).filter((id) => summaryValues[id] > 0).map((id) => ({ id, label: summaryLabels[id], value: summaryValues[id] }));
  const filterCounts = Object.fromEntries((["everything", "applications", "interviews", "offers", "scholarships", "research", "competitions", "benefits", "milestones"] as JourneyTimelineFilterKey[]).map((key) => [key, key === "everything" ? events.length : events.filter((event) => event.filters.includes(key)).length])) as Record<JourneyTimelineFilterKey, number>;
  const highlights = buildHighlights(events, records, opportunityById, fallbackDate);
  const meaningfulTypes = new Set<JourneyTimelineEventType>(["application_submitted", "interview", "accepted", "scholarship_awarded", "completed", "milestone"]);
  const meaningful = events.filter((event) => meaningfulTypes.has(event.type));
  const cardHighlights = (meaningful.length ? meaningful : events).slice(-4).map((event) => ({ id: event.id, date: event.occurredAt, title: event.title, label: event.label, organization: event.opportunity?.organization }));
  const profile = input.account.profile;
  const firstName = profile?.firstName?.trim() || input.user.name.trim().split(/\s+/)[0] || "Student";
  const profileName = [profile?.firstName, profile?.lastName].map((part) => part?.trim()).filter(Boolean).join(" ");
  const school = profile ? schools.find((item) => item.slug === profile.schoolSlug)?.name : undefined;
  const appearance = input.account.preferences?.appearance ?? "light";
  const theme = input.resolvedTheme ?? (isProUser(input.account.billing) && (appearance === "midnight" || appearance === "forest") ? "dark" : "light");

  return {
    events,
    summary,
    highlights,
    filterCounts,
    story: {
      title: `${firstName}'s story`,
      description: highlights[0]?.description ?? (events.length === 1 ? "One recorded moment marks the beginning of this Journey." : "A factual record of the opportunities and milestones that shaped your progress."),
    },
    theme,
    card: {
      identity: { firstName, fullName: profileName || input.user.name.trim() || firstName, school },
      dateRange: cardDateRange(events),
      headline: cardHeadline(values),
      periodTitle: journeyPeriodTitle(events),
      stats,
      highlights: cardHighlights,
    },
  };
}
