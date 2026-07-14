import { authenticatedFetch } from "./authenticated-request";

export const studentActivityStorageKey = "unlocked-student-activity";
export const studentActivityEvent = "unlocked-student-activity-change";
export const studentActivitySyncFailedEvent = "unlocked-student-activity-sync-failed";

export const opportunityTrackerStatuses = ["Saved", "Interested", "Applying", "Submitted", "Interview", "Accepted", "Rejected", "Completed"] as const;
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

export function replaceStudentActivity(activity: StudentActivity) {
  localStorage.setItem(studentActivityStorageKey, JSON.stringify(activity));
  window.dispatchEvent(new CustomEvent(studentActivityEvent, { detail: activity }));
}

export async function persistStudentActivity(activity: StudentActivity) {
  const response = await authenticatedFetch("/api/account/data", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activity }) });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Activity could not be saved.");
  return await response.json();
}

function writeStudentActivity(activity: StudentActivity, persist = true) {
  replaceStudentActivity(activity);
  if (!persist) return;
  void persistStudentActivity(activity).catch((error) => window.dispatchEvent(new CustomEvent(studentActivitySyncFailedEvent, { detail: { activity, error: error instanceof Error ? error.message : "Activity sync failed." } })));
}

export function trackOpportunityView(id: string) {
  const activity = readStudentActivity();
  if (activity.viewed.includes(id)) return activity;
  activity.viewed.push(id); writeStudentActivity(activity); return activity;
}

export function saveOpportunity(id: string, status: OpportunityTrackerStatus = "Saved", persist = true) {
  const activity = readStudentActivity();
  const tracked = activity.tracked ?? {};
  const existing = tracked[id];
  tracked[id] = { id, status, savedAt: existing?.savedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
  activity.tracked = tracked;
  activity.saved = [...new Set([...activity.saved, id])];
  writeStudentActivity(activity, persist); return activity;
}

export function updateOpportunityStatus(id: string, status: OpportunityTrackerStatus, persist = true) {
  return saveOpportunity(id, status, persist);
}

export function removeTrackedOpportunity(id: string) {
  const activity = readStudentActivity();
  const tracked = activity.tracked ?? {};
  delete tracked[id];
  activity.tracked = tracked;
  activity.saved = activity.saved.filter((item) => item !== id);
  writeStudentActivity(activity); return activity;
}
