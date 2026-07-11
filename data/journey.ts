import type { Opportunity } from "./opportunities";
import type { StudentActivity, TrackedOpportunity } from "./student-activity";
import type { StudentProfile } from "./student-profile";
import type { StudentProgress } from "./student-progress";

export type JourneyMilestone = {
  id: string;
  title: string;
  description: string;
  date: string;
  category: "Profile" | "Saved" | "Application" | "Interview" | "Accepted" | "Completed";
};

export type JourneyRecap = {
  opportunitiesSaved: number;
  applicationsSubmitted: number;
  interviewsReached: number;
  acceptancesRecorded: number;
  completedOpportunities: number;
  mostExploredCategory: string | null;
  biggestMilestone: JourneyMilestone | null;
};

const applicationStatuses = new Set(["Applying", "Submitted", "Interview", "Accepted", "Rejected", "Completed"]);

function opportunityFor(id: string, opportunities: readonly Opportunity[]) {
  return opportunities.find((item) => item.id === id) ?? null;
}

function earliest(records: TrackedOpportunity[], predicate: (record: TrackedOpportunity) => boolean) {
  return records.filter(predicate).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0] ?? null;
}

function milestone(id: string, title: string, description: string, date: string, category: JourneyMilestone["category"]): JourneyMilestone {
  return { id, title, description, date, category };
}

export function buildJourneyMilestones(input: { profile: StudentProfile; activity: StudentActivity; progress?: StudentProgress; opportunities: readonly Opportunity[] }): JourneyMilestone[] {
  const tracked = Object.values(input.activity.tracked ?? {});
  const milestones: JourneyMilestone[] = [];
  const profileWithTimestamp = input.profile as StudentProfile & { updatedAt?: string };
  const profileDate = profileWithTimestamp.updatedAt ?? input.profile.advisorInterview?.completedAt;
  if (profileDate) milestones.push(milestone("profile-complete", "Completed your UnlockED profile", "Your recommendations can now use your school, major, goals, and interests.", profileDate, "Profile"));
  const firstSaved = earliest(tracked, () => true);
  if (firstSaved) {
    const item = opportunityFor(firstSaved.id, input.opportunities);
    milestones.push(milestone("first-saved", "Saved your first opportunity", item ? item.title : "You saved an opportunity to revisit later.", firstSaved.savedAt, "Saved"));
  }
  const firstApplication = earliest(tracked, (record) => applicationStatuses.has(record.status));
  if (firstApplication) {
    const item = opportunityFor(firstApplication.id, input.opportunities);
    milestones.push(milestone("first-application", "Started your first tracked application", item ? item.title : "You moved an opportunity into application progress.", firstApplication.updatedAt, "Application"));
  }
  const firstInterview = earliest(tracked, (record) => record.status === "Interview");
  if (firstInterview) milestones.push(milestone("first-interview", "Recorded an interview", opportunityFor(firstInterview.id, input.opportunities)?.title ?? "Interview reached", firstInterview.updatedAt, "Interview"));
  const firstAcceptance = earliest(tracked, (record) => record.status === "Accepted");
  if (firstAcceptance) milestones.push(milestone("first-acceptance", "Recorded an acceptance", opportunityFor(firstAcceptance.id, input.opportunities)?.title ?? "Acceptance recorded", firstAcceptance.updatedAt, "Accepted"));
  const firstCompleted = earliest(tracked, (record) => record.status === "Completed");
  if (firstCompleted) milestones.push(milestone("first-completed", "Completed an opportunity", opportunityFor(firstCompleted.id, input.opportunities)?.title ?? "Opportunity completed", firstCompleted.updatedAt, "Completed"));
  const submittedCount = tracked.filter((record) => ["Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(record.status)).length;
  if (submittedCount >= 5) milestones.push(milestone("five-submitted", "Submitted five applications", "You recorded five submitted applications in UnlockED.", tracked.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].updatedAt, "Application"));
  return milestones.sort((a, b) => b.date.localeCompare(a.date));
}

export function buildJourneyRecap(input: { activity: StudentActivity; milestones: readonly JourneyMilestone[]; opportunities: readonly Opportunity[] }): JourneyRecap {
  const tracked = Object.values(input.activity.tracked ?? {});
  const categoryCounts = new Map<string, number>();
  for (const id of input.activity.viewed) {
    const item = opportunityFor(id, input.opportunities);
    if (item) categoryCounts.set(item.type, (categoryCounts.get(item.type) ?? 0) + 1);
  }
  const mostExploredCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    opportunitiesSaved: tracked.length,
    applicationsSubmitted: tracked.filter((record) => ["Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(record.status)).length,
    interviewsReached: tracked.filter((record) => record.status === "Interview").length,
    acceptancesRecorded: tracked.filter((record) => record.status === "Accepted").length,
    completedOpportunities: tracked.filter((record) => record.status === "Completed").length,
    mostExploredCategory,
    biggestMilestone: input.milestones[0] ?? null,
  };
}
