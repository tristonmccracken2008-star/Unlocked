import { schoolDirectory } from "@/data/school-directory";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountData, AuthUser } from "./account-types";

export type ProfileIdentityJourneyStat = {
  id: "saved" | "applied" | "interviews" | "offers" | "milestones";
  label: string;
  value: number;
};

export type ProfileIdentityModel = {
  name: string;
  initials: string;
  school?: string;
  majors?: string;
  minor?: string;
  graduation?: string;
  careerGoal?: string;
  journey: ProfileIdentityJourneyStat[] | null;
};

const appliedStatuses = new Set<OpportunityTrackerStatus>(["Submitted", "Interview", "Accepted", "Completed"]);
const interviewStatuses = new Set<OpportunityTrackerStatus>(["Interview", "Accepted", "Completed"]);
const acceptedStatuses = new Set<OpportunityTrackerStatus>(["Accepted", "Completed"]);

function clean(value: string | null | undefined) {
  return value?.trim() || undefined;
}

function reached(record: TrackedOpportunity, statuses: Set<OpportunityTrackerStatus>, transition: "submit" | "interview" | "accept") {
  return statuses.has(record.status) || Boolean(record.history?.some((item) => item.transition === transition));
}

export function buildProfileIdentityJourney(account: Pick<AccountData, "activity" | "tracker" | "journeyProgress">) {
  const recordsById = { ...(account.activity?.tracked ?? {}), ...(account.tracker ?? {}) };
  const records = Object.values(recordsById);
  const milestones = Object.values(account.journeyProgress ?? {}).filter(Boolean).length;
  if (!records.length && !milestones) return null;

  return [
    { id: "saved", label: "Saved", value: records.length },
    { id: "applied", label: "Applied", value: records.filter((record) => reached(record, appliedStatuses, "submit")).length },
    { id: "interviews", label: "Interviews", value: records.filter((record) => reached(record, interviewStatuses, "interview")).length },
    { id: "offers", label: "Offers", value: records.filter((record) => reached(record, acceptedStatuses, "accept")).length },
    { id: "milestones", label: "Milestones", value: milestones },
  ] satisfies ProfileIdentityJourneyStat[];
}

export function buildProfileIdentityModel(
  profile: StudentProfile | null | undefined,
  user: Pick<AuthUser, "name">,
  account: Pick<AccountData, "activity" | "tracker" | "journeyProgress">,
): ProfileIdentityModel {
  const profileName = [clean(profile?.firstName), clean(profile?.lastName)].filter(Boolean).join(" ");
  const name = profileName || clean(user.name) || "Student";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
  const canonicalSchool = profile?.schoolSlug ? schoolDirectory.find((school) => school.slug === profile.schoolSlug)?.name : undefined;
  const major = clean(profile?.major);
  const secondaryMajor = clean(profile?.secondaryMajor);

  return {
    name,
    initials,
    school: canonicalSchool ?? clean(profile?.schoolName),
    majors: [major, secondaryMajor && secondaryMajor.toLocaleLowerCase() !== major?.toLocaleLowerCase() ? secondaryMajor : undefined].filter(Boolean).join(" • ") || undefined,
    minor: clean(profile?.minor) ? `Minor in ${clean(profile?.minor)}` : undefined,
    graduation: clean(profile?.graduationYear) ? `Graduating ${clean(profile?.graduationYear)}` : undefined,
    careerGoal: clean(profile?.careerGoal),
    journey: buildProfileIdentityJourney(account),
  };
}
