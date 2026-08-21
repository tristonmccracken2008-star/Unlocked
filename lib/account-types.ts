import type { StudentActivity } from "@/data/student-activity";
import type { TrackedOpportunity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { AdvisorAccountData } from "./advisor/types";
import type { BillingRecord } from "./billing";
import type { ReferralAccountData } from "./referrals";
import type { NotificationPreferences } from "./notification-types";
import type { GuidanceState } from "./guidance";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  image?: string;
};

export type DatabaseUser = AuthUser & {
  provider: "google";
  providerAccountId: string;
  createdAt: string;
  updatedAt: string;
};

export type JourneyCardDefaults = {
  format: "story" | "square" | "linkedin";
  theme: "light" | "dark";
  nameMode: "anonymous" | "first_name" | "full_name";
  includeSchool: boolean;
  includeOrganization: boolean;
  includeDate: boolean;
  includeAward: boolean;
  includeBranding: boolean;
  visibility: "private";
};

export type AccountPrivacyPreferences = {
  journeyVisibility: "private";
  analyticsPersonalization: boolean;
  journeyCard: JourneyCardDefaults;
};

export type ProfileRecord = StudentProfile & {
  updatedAt?: string;
};

export type SavedOpportunityRecord = {
  opportunityId: string;
  savedAt: string;
};

export type WatchedOpportunityRecord = {
  opportunityId: string;
  watchedAt: string;
  updatedAt: string;
  version: number;
};

export type OpportunityTrackerRecord = Record<string, TrackedOpportunity>;

export type UserPreferencesRecord = {
  preferredTypes?: string[];
  hiddenDismissedIds?: string[];
  useActivityForRecommendations?: boolean;
  recommendationSignalsResetAt?: string;
  appearance?: "light" | "midnight" | "forest" | "system";
  reducedMotion?: "system" | "reduce" | "full";
  privacy?: AccountPrivacyPreferences;
  notifications?: NotificationPreferences;
  updatedAt: string;
};

export type JourneyProgressRecord = Record<string, boolean>;

export const journeyCalendarEventTypes = ["interview", "personal_target", "follow_up", "essay_deadline", "reminder"] as const;
export type JourneyCalendarEventType = (typeof journeyCalendarEventTypes)[number];

export type JourneyCalendarEventRecord = {
  id: string;
  type: JourneyCalendarEventType;
  title: string;
  date: string;
  time?: string;
  opportunityId?: string;
  source: "user" | "application_task";
  reminderMinutesBefore?: number;
  completed: boolean;
  dismissed: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type JourneyCalendarRecord = Record<string, JourneyCalendarEventRecord>;

export type ApplicationTaskRecord = {
  id: string;
  title: string;
  dueDate?: string;
  source: "verified_requirement" | "user";
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ApplicationWorkspaceRecord = {
  opportunityId: string;
  tasks: Record<string, ApplicationTaskRecord>;
  deletedTasks?: Record<string, ApplicationTaskRecord>;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ApplicationWorkspaceStore = Record<string, ApplicationWorkspaceRecord>;

export type AccountData = {
  profile: ProfileRecord | null;
  onboardingComplete: boolean;
  firstLaunchComplete?: boolean;
  firstLaunchCompletedAt?: string;
  billing: BillingRecord;
  activity: StudentActivity | null;
  savedOpportunities: SavedOpportunityRecord[];
  watchedOpportunities?: WatchedOpportunityRecord[];
  tracker: OpportunityTrackerRecord;
  preferences: UserPreferencesRecord | null;
  journeyProgress: JourneyProgressRecord;
  calendarEvents?: JourneyCalendarRecord;
  applicationWorkspaces?: ApplicationWorkspaceStore;
  guidance?: GuidanceState;
  advisor: AdvisorAccountData | null;
  referrals: ReferralAccountData | null;
  updatedAt: string;
};

export type AccountSession = {
  authenticated: boolean;
  user: AuthUser | null;
  data: AccountData | null;
};
