import { opportunityTrackerStatuses, type StudentActivity, type TrackedOpportunity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountData, SavedOpportunityRecord, UserPreferencesRecord } from "./account-types";

const maxTrackedOpportunities = 1_000;
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

function stringValue(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]) {
  return allowed.includes(value as T) ? value as T : undefined;
}

function stringList(value: unknown, maxItems = 30, maxLength = 120) {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.map((item) => stringValue(item, maxLength)).filter((item): item is string => Boolean(item)))].slice(0, maxItems);
}

function safeId(value: unknown) {
  return typeof value === "string" && safeIdPattern.test(value) ? value : null;
}

function safeTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const earliest = Date.UTC(2000, 0, 1);
  const latest = Date.now() + 5 * 60 * 1000;
  if (date.getTime() < earliest || date.getTime() > latest) return null;
  return date.toISOString();
}

export function cleanStudentProfile(value: unknown): StudentProfile | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const schoolSlug = stringValue(input.schoolSlug, 160);
  const major = stringValue(input.major, 160);
  const year = stringValue(input.year, 60);
  const careerGoal = stringValue(input.careerGoal, 500);
  const interests = stringValue(input.interests, 1_000);
  if (!schoolSlug || !major || !year || !careerGoal || !interests) return undefined;

  const minorStatus = enumValue(input.minorStatus, ["declared", "none"] as const);
  const gpaStatus = enumValue(input.gpaStatus, ["reported", "none_yet", "nonstandard"] as const);
  const rawGpa = typeof input.gpa === "number" && Number.isFinite(input.gpa) ? Math.min(4, Math.max(0, input.gpa)) : undefined;
  const advisorInput = input.advisorInterview && typeof input.advisorInterview === "object" && !Array.isArray(input.advisorInterview)
    ? input.advisorInterview as Record<string, unknown>
    : null;
  const advisorInterview = advisorInput ? {
    careerGoal: stringValue(advisorInput.careerGoal, 500),
    currentExperience: stringValue(advisorInput.currentExperience, 500),
    interests: stringList(advisorInput.interests),
    primaryGoals: stringList(advisorInput.primaryGoals),
    weeklyAvailability: stringValue(advisorInput.weeklyAvailability, 120),
    preferredOpportunityTypes: stringList(advisorInput.preferredOpportunityTypes),
    completedAt: safeTimestamp(advisorInput.completedAt) ?? undefined,
  } : undefined;

  return {
    firstName: stringValue(input.firstName, 80),
    lastName: stringValue(input.lastName, 100),
    schoolSlug,
    major,
    graduationYear: /^\d{4}$/.test(String(input.graduationYear ?? "")) ? String(input.graduationYear) : undefined,
    year,
    careerGoal,
    interests,
    currentExperience: stringValue(input.currentExperience, 500),
    weeklyAvailability: stringValue(input.weeklyAvailability, 120),
    preferredOpportunityTypes: stringList(input.preferredOpportunityTypes),
    advisorInterview,
    minor: stringValue(input.minor, 160),
    minorStatus,
    gpaStatus,
    gpa: gpaStatus === "reported" ? rawGpa : undefined,
    gpaScale: gpaStatus === "reported" ? "4.0" : undefined,
    currentPriority: stringValue(input.currentPriority, 300),
    onboardingCompletedAt: safeTimestamp(input.onboardingCompletedAt) ?? undefined,
    goals: stringList(input.goals),
    topics: stringList(input.topics),
    clubs: stringValue(input.clubs, 1_000),
    institutionType: enumValue(input.institutionType, ["college", "university", "community_college", "liberal_arts_college", "unknown"] as const),
    enrollmentStatus: enumValue(input.enrollmentStatus, ["enrolled", "incoming", "recent_graduate", "not_enrolled", "unknown"] as const),
    degreeLevel: enumValue(input.degreeLevel, ["associate", "undergraduate", "graduate", "unknown"] as const),
    citizenshipStatus: enumValue(input.citizenshipStatus, ["us_citizen", "permanent_resident", "international", "unknown"] as const),
    workAuthorization: enumValue(input.workAuthorization, ["us_authorized", "not_us_authorized", "unknown"] as const),
    residency: stringValue(input.residency, 160),
    age: typeof input.age === "number" && Number.isInteger(input.age) && input.age >= 13 && input.age <= 120 ? input.age : undefined,
    transferStatus: enumValue(input.transferStatus, ["community_college_student", "transfer_applicant", "not_transfer", "unknown"] as const),
    financialNeedStatus: enumValue(input.financialNeedStatus, ["demonstrated", "not_demonstrated", "unknown"] as const),
    meritStatus: enumValue(input.meritStatus, ["demonstrated", "not_demonstrated", "unknown"] as const),
    eligibilityAttributes: stringList(input.eligibilityAttributes, 50),
  };
}

function cleanActivity(value: unknown): StudentActivity | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Partial<StudentActivity>;
  const cleanIds = (items: unknown) => Array.isArray(items)
    ? [...new Set(items.map(safeId).filter((item): item is string => Boolean(item)))].slice(0, maxTrackedOpportunities)
    : [];
  const tracker = cleanTracker(input.tracked);
  return {
    viewed: cleanIds(input.viewed),
    saved: [...new Set([...cleanIds(input.saved), ...Object.keys(tracker)])].slice(0, maxTrackedOpportunities),
    claimed: cleanIds(input.claimed),
    tracked: tracker,
  };
}

function cleanTracker(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries: Array<[string, TrackedOpportunity]> = [];
  for (const [rawId, rawRecord] of Object.entries(value).slice(0, maxTrackedOpportunities)) {
    const id = safeId(rawId);
    if (!id || !rawRecord || typeof rawRecord !== "object" || Array.isArray(rawRecord)) continue;
    const record = rawRecord as Partial<TrackedOpportunity>;
    const status = enumValue(record.status, opportunityTrackerStatuses);
    const savedAt = safeTimestamp(record.savedAt);
    const updatedAt = safeTimestamp(record.updatedAt);
    if (!status || !savedAt || !updatedAt) continue;
    entries.push([id, { id, status, savedAt, updatedAt }]);
  }
  return Object.fromEntries(entries);
}

function cleanSavedOpportunities(value: unknown): SavedOpportunityRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const records: SavedOpportunityRecord[] = [];
  for (const item of value.slice(0, maxTrackedOpportunities)) {
    if (!item || typeof item !== "object") continue;
    const input = item as Partial<SavedOpportunityRecord>;
    const opportunityId = safeId(input.opportunityId);
    const savedAt = safeTimestamp(input.savedAt);
    if (opportunityId && savedAt) records.push({ opportunityId, savedAt });
  }
  return records;
}

function cleanPreferences(value: unknown): UserPreferencesRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Partial<UserPreferencesRecord>;
  const updatedAt = safeTimestamp(input.updatedAt);
  if (!updatedAt) return undefined;
  return {
    preferredTypes: stringList(input.preferredTypes, 30),
    hiddenDismissedIds: Array.isArray(input.hiddenDismissedIds)
      ? input.hiddenDismissedIds.map(safeId).filter((item): item is string => Boolean(item)).slice(0, maxTrackedOpportunities)
      : undefined,
    appearance: enumValue(input.appearance, ["light", "midnight", "forest"] as const) ?? "light",
    updatedAt,
  };
}

function cleanJourneyProgress(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value).slice(0, maxTrackedOpportunities).filter(([id, state]) => Boolean(safeId(id)) && typeof state === "boolean"));
}

export function cleanAccountDataInput(value: unknown): Partial<AccountData> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Partial<AccountData>;
  const profile = input.profile ? cleanStudentProfile(input.profile) : undefined;
  const activity = cleanActivity(input.activity);
  const tracker = cleanTracker(input.tracker);
  const savedOpportunities = cleanSavedOpportunities(input.savedOpportunities);
  const preferences = cleanPreferences(input.preferences);
  const journeyProgress = cleanJourneyProgress(input.journeyProgress);
  return {
    profile,
    onboardingComplete: typeof input.onboardingComplete === "boolean" ? input.onboardingComplete : undefined,
    activity,
    savedOpportunities,
    tracker: Object.keys(tracker).length ? tracker : undefined,
    preferences,
    journeyProgress,
  };
}
