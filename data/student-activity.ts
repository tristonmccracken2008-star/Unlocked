export const studentActivityStorageKey = "unlocked-student-activity";
export const studentActivityEvent = "unlocked-student-activity-change";

export type StudentActivity = {
  viewed: string[];
  saved: string[];
  claimed: string[];
};

const emptyActivity = (): StudentActivity => ({ viewed: [], saved: [], claimed: [] });

export function readStudentActivity(): StudentActivity {
  try {
    const parsed = JSON.parse(localStorage.getItem(studentActivityStorageKey) ?? "null") as Partial<StudentActivity> | null;
    return {
      viewed: Array.isArray(parsed?.viewed) ? [...new Set(parsed.viewed.filter((item): item is string => typeof item === "string"))] : [],
      saved: Array.isArray(parsed?.saved) ? [...new Set(parsed.saved.filter((item): item is string => typeof item === "string"))] : [],
      claimed: Array.isArray(parsed?.claimed) ? [...new Set(parsed.claimed.filter((item): item is string => typeof item === "string"))] : [],
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
  activity.saved = activity.saved.includes(id) ? activity.saved.filter((item) => item !== id) : [...activity.saved, id];
  writeStudentActivity(activity); return activity;
}

export function markOpportunityClaimed(id: string) {
  const activity = readStudentActivity();
  if (!activity.claimed.includes(id)) activity.claimed.push(id);
  if (!activity.viewed.includes(id)) activity.viewed.push(id);
  writeStudentActivity(activity); return activity;
}
