export const studentActivityStorageKey = "unlocked-student-activity";
export const studentActivityEvent = "unlocked-student-activity-change";

export const opportunityTrackerStatuses = ["Saved", "Interested", "Applying", "Submitted", "Interview", "Accepted", "Completed"] as const;
export type OpportunityTrackerStatus = (typeof opportunityTrackerStatuses)[number];

export type TrackedOpportunity = {
  id: string;
  status: OpportunityTrackerStatus;
  savedAt: string;
  updatedAt: string;
};

export type StudentActivity = {
  viewed: string[];
  saved: string[];
  claimed: string[];
  tracked?: Record<string, TrackedOpportunity>;
};

const emptyActivity = (): StudentActivity => ({ viewed: [], saved: [], claimed: [], tracked: {} });
const uniqueStrings = (items: unknown) => Array.isArray(items) ? [...new Set(items.filter((item): item is string => typeof item === "string"))] : [];

function normalizeStatus(status: unknown): OpportunityTrackerStatus {
  return opportunityTrackerStatuses.includes(status as OpportunityTrackerStatus) ? status as OpportunityTrackerStatus : "Saved";
}

export function readStudentActivity(): StudentActivity {
  try {
    const parsed = JSON.parse(localStorage.getItem(studentActivityStorageKey) ?? "null") as Partial<StudentActivity> | null;
    const saved = uniqueStrings(parsed?.saved);
    const trackedEntries = parsed?.tracked && typeof parsed.tracked === "object" ? Object.entries(parsed.tracked) : [];
    const tracked = Object.fromEntries(trackedEntries.filter(([id]) => typeof id === "string").map(([id, record]) => {
      const fallbackDate = new Date().toISOString();
      const value = record && typeof record === "object" ? record as Partial<TrackedOpportunity> : {};
      return [id, { id, status: normalizeStatus(value.status), savedAt: typeof value.savedAt === "string" ? value.savedAt : fallbackDate, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : fallbackDate }];
    }));
    for (const id of saved) {
      if (!tracked[id]) tracked[id] = { id, status: "Saved", savedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
    return {
      viewed: uniqueStrings(parsed?.viewed),
      saved: [...new Set([...saved, ...Object.keys(tracked)])],
      claimed: uniqueStrings(parsed?.claimed),
      tracked,
    };
  } catch { return emptyActivity(); }
}

function writeStudentActivity(activity: StudentActivity) {
  localStorage.setItem(studentActivityStorageKey, JSON.stringify(activity));
  window.dispatchEvent(new CustomEvent(studentActivityEvent, { detail: activity }));
}

export function trackOpportunityView(id: string) {
  const activity = readStudentActivity();
  if (activity.viewed.includes(id)) return activity;
  activity.viewed.push(id); writeStudentActivity(activity); return activity;
}

export function toggleSavedOpportunity(id: string) {
  const activity = readStudentActivity();
  const tracked = activity.tracked ?? {};
  if (activity.saved.includes(id)) {
    activity.saved = activity.saved.filter((item) => item !== id);
    delete tracked[id];
  } else {
    activity.saved = [...activity.saved, id];
    tracked[id] = { id, status: "Saved", savedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  activity.tracked = tracked;
  writeStudentActivity(activity); return activity;
}

export function saveOpportunity(id: string, status: OpportunityTrackerStatus = "Saved") {
  const activity = readStudentActivity();
  const tracked = activity.tracked ?? {};
  const existing = tracked[id];
  tracked[id] = { id, status, savedAt: existing?.savedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
  activity.tracked = tracked;
  activity.saved = [...new Set([...activity.saved, id])];
  writeStudentActivity(activity); return activity;
}

export function updateOpportunityStatus(id: string, status: OpportunityTrackerStatus) {
  return saveOpportunity(id, status);
}

export function removeTrackedOpportunity(id: string) {
  const activity = readStudentActivity();
  const tracked = activity.tracked ?? {};
  delete tracked[id];
  activity.tracked = tracked;
  activity.saved = activity.saved.filter((item) => item !== id);
  writeStudentActivity(activity); return activity;
}

export function markOpportunityClaimed(id: string) {
  const activity = readStudentActivity();
  if (!activity.claimed.includes(id)) activity.claimed.push(id);
  if (!activity.viewed.includes(id)) activity.viewed.push(id);
  const tracked = activity.tracked ?? {};
  tracked[id] = { id, status: "Completed", savedAt: tracked[id]?.savedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
  activity.tracked = tracked;
  activity.saved = [...new Set([...activity.saved, id])];
  writeStudentActivity(activity); return activity;
}
