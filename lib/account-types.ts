import type { StudentActivity } from "@/data/student-activity";
import type { TrackedOpportunity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { AdvisorAccountData } from "./advisor/types";
import type { BillingRecord } from "./billing";
import type { ReferralAccountData } from "./referrals";
import type { NotificationPreferences } from "./notification-types";
import type { GuidanceState } from "./guidance";
import type { AccomplishmentStore } from "@/data/accomplishments";
import type { OpportunityPathPreferences } from "@/data/opportunity-paths";
import type { ApplicationMaterialStore } from "@/data/application-materials";
import type { ResumeLabStore } from "@/data/resume-lab";

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

export type WrittenResponseRecord = {
  id: string;
  prompt: string;
  source: "verified" | "student";
  sourceUrl?: string;
  required: boolean;
  wordLimit?: number;
  characterLimit?: number;
  draft: string;
  status: "not_started" | "draft" | "ready";
  revisions: Array<{ id: string; draft: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ApplicationRecommenderRecord = {
  id: string;
  name: string;
  role?: string;
  organization?: string;
  email?: string;
  relationship?: string;
  requestedDate?: string;
  deadline?: string;
  status: "not_requested" | "planning" | "requested" | "confirmed" | "submitted" | "unknown" | "declined";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type AnswerBankRecord = {
  id: string;
  title: string;
  category: string;
  experienceIds: string[];
  situation?: string;
  action?: string;
  challenge?: string;
  result?: string;
  learning?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type AnswerBankStore = { records: Record<string, AnswerBankRecord>; version: number; updatedAt?: string };

export type ApplicationSubmissionSnapshot = {
  id: string;
  createdAt: string;
  opportunity: { title: string; organization: string; officialSource: string; deadline?: string };
  materials: Array<{ materialId: string; requirementType: string; title: string; versionLabel?: string }>;
  writtenResponses: Array<{ id: string; prompt: string; draft: string; version: number }>;
  recommenders: Array<{ id: string; name: string; status: ApplicationRecommenderRecord["status"] }>;
  notes?: string;
};

export type ApplicationWorkspaceRecord = {
  opportunityId: string;
  tasks: Record<string, ApplicationTaskRecord>;
  deletedTasks?: Record<string, ApplicationTaskRecord>;
  writtenResponses?: Record<string, WrittenResponseRecord>;
  recommenders?: Record<string, ApplicationRecommenderRecord>;
  privateNotes?: string;
  submissionSnapshots?: ApplicationSubmissionSnapshot[];
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
  answerBank?: AnswerBankStore;
  applicationMaterials?: ApplicationMaterialStore;
  resumeLab?: ResumeLabStore;
  accomplishments?: AccomplishmentStore;
  pathPreferences?: OpportunityPathPreferences;
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
