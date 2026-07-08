import type { StudentActivity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  image?: string;
};

export type AccountData = {
  profile: StudentProfile | null;
  activity: StudentActivity | null;
  journeyProgress: Record<string, boolean>;
  updatedAt: string;
};

export type AccountSession = {
  authenticated: boolean;
  user: AuthUser | null;
  data: AccountData | null;
};
