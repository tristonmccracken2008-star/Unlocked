import type { StudentActivity } from "@/data/student-activity";
import type { TrackedOpportunity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { AdvisorAccountData } from "./advisor/types";
import type { BillingRecord } from "./billing";

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

export type ProfileRecord = StudentProfile & {
  updatedAt?: string;
};

export type SavedOpportunityRecord = {
  opportunityId: string;
  savedAt: string;
};

export type OpportunityTrackerRecord = Record<string, TrackedOpportunity>;

export type UserPreferencesRecord = {
  preferredTypes?: string[];
  hiddenDismissedIds?: string[];
  appearance?: "light" | "midnight" | "forest";
  updatedAt: string;
};

export type JourneyProgressRecord = Record<string, boolean>;

export type AccountData = {
  profile: ProfileRecord | null;
  onboardingComplete: boolean;
  billing: BillingRecord;
  activity: StudentActivity | null;
  savedOpportunities: SavedOpportunityRecord[];
  tracker: OpportunityTrackerRecord;
  preferences: UserPreferencesRecord | null;
  journeyProgress: JourneyProgressRecord;
  advisor: AdvisorAccountData | null;
  updatedAt: string;
};

export type AccountSession = {
  authenticated: boolean;
  user: AuthUser | null;
  data: AccountData | null;
};
