import "server-only";

import { highSchoolOpportunities } from "@/data/high-school-opportunities";
import type { Opportunity } from "@/data/opportunities";
import type { AccountData } from "./account-types";
import { buildAdmissionsJourney } from "./admissions-journey";
import {
  collegeSizeLabel,
  getColleges,
  searchColleges,
  type College,
} from "./colleges";
import {
  evaluateHighSchoolEligibility,
  type HighSchoolEligibility,
} from "./high-school-opportunities";
import { isProUser } from "./billing";
import { activeRecommendationFeedback } from "./advisor/feedback";

export type HighSchoolForYouOpportunity = {
  opportunity: Opportunity;
  eligibility: HighSchoolEligibility;
  reasons: string[];
  inJourney: boolean;
  watched: boolean;
};

export type HighSchoolForYouModel = {
  firstName: string;
  pro: boolean;
  topPicks: HighSchoolForYouOpportunity[];
  explorations: HighSchoolForYouOpportunity[];
  collegeDiscovery: {
    college: College;
    label: "Worth exploring" | "Something different";
    reason: string;
  } | null;
  comingUp: Array<{
    id: string;
    date: string;
    title: string;
    detail: string;
    kind: "Opportunity" | "College application" | "Your planning date";
    href: string;
  }>;
  nextAction: { title: string; detail: string; href: string } | null;
  profilePrompt: string | null;
};

const ignoredInterest = /^(not sure|still explor|undecided|explor|any|none)/i;
const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function interestTokens(data: AccountData) {
  const profile = data.profile;
  const explicit = [
    ...(profile?.topics ?? []),
    ...(profile?.fieldInterests ?? []),
    ...(profile?.specificCareerInterests ?? []),
    ...(profile?.interests?.split(/[,;/]+/) ?? []),
    profile?.major ?? "",
    profile?.careerGoal ?? "",
  ]
    .map((item) => normalize(item))
    .filter((item) => item.length > 2 && !ignoredInterest.test(item));
  return [...new Set(explicit)].slice(0, 12);
}

function opportunityInterest(opportunity: Opportunity, interests: string[]) {
  const text = normalize(
    `${opportunity.title} ${opportunity.description} ${opportunity.tags.join(" ")} ${opportunity.majors.join(" ")} ${opportunity.metadata.highSchool?.activities.join(" ") ?? ""}`,
  );
  const relatedTerms: Array<[RegExp, string[]]> = [
    [/computer|software|coding|cyber|technology/, ["computer science", "software", "coding", "technology", "cyber", "app development"]],
    [/econom|business|finance|marketing|entrepreneur/, ["economics", "business", "finance", "marketing", "entrepreneur"]],
    [/engineer|robot|aerospace/, ["engineering", "robotics", "aerospace", "stem"]],
    [/art|design|creative/, ["art", "design", "creative", "portfolio"]],
    [/writing|journal|english/, ["writing", "journalism", "english"]],
    [/biology|medicine|health/, ["biology", "medicine", "health", "science research"]],
  ];
  return interests.filter((interest) => {
    if (interest.split(" ").every((token) => text.includes(token))) return true;
    const family = relatedTerms.find(([pattern]) => pattern.test(interest));
    return family?.[1].some((term) => text.includes(term)) ?? false;
  });
}

function reasonsFor(
  opportunity: Opportunity,
  eligibility: HighSchoolEligibility,
  matches: string[],
  now: Date,
) {
  const reasons: string[] = [];
  const grade = eligibility.checks.find(
    (check) => check.label === "Grade" && check.state === "met",
  );
  if (grade) reasons.push(grade.detail);
  if (matches[0]) reasons.push(`Related to your interest in ${matches[0]}.`);
  if (opportunity.metadata.highSchool?.cost.kind === "free")
    reasons.push("The verified program is free.");
  if (opportunity.application_deadline) {
    const days = Math.ceil(
      (Date.parse(`${opportunity.application_deadline}T23:59:59Z`) -
        now.getTime()) /
        86_400_000,
    );
    if (days >= 0 && days <= 60)
      reasons.push(
        `The current application closes ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${opportunity.application_deadline}T12:00:00Z`))}.`,
      );
  }
  return reasons.slice(0, 3);
}

function discoverCollege(data: AccountData, interests: string[]) {
  const savedIds = new Set((data.savedColleges ?? []).map((item) => item.collegeId));
  const saved = getColleges([...savedIds]);
  const query = interests.find((item) => /computer|engineer|business|econom|math|biology|medicine|art|writing|research/.test(item));
  if (!query) return null;
  const candidates = searchColleges({ query, limit: 40 }).colleges.filter(
    (college) =>
      !savedIds.has(college.id) &&
      college.degreeLevel === "Bachelor's" &&
      college.ownership !== "Private for-profit",
  );
  if (!candidates.length) return null;
  const sizes = saved.map(collegeSizeLabel);
  const settings = saved.flatMap((college) => college.setting ? [college.setting] : []);
  const commonSize = sizes.sort((a, b) => sizes.filter((item) => item === b).length - sizes.filter((item) => item === a).length)[0];
  const commonSetting = settings.sort((a, b) => settings.filter((item) => item === b).length - settings.filter((item) => item === a).length)[0];
  const different = saved.length
    ? candidates.find((college) => collegeSizeLabel(college) !== commonSize || college.setting !== commonSetting)
    : undefined;
  const college = different ?? candidates[0];
  const program = college.programs.find((item) =>
    normalize(item.label).split(" ").some((token) => query.includes(token) || token.includes(query)),
  );
  if (different && commonSize)
    return {
      college,
      label: "Something different" as const,
      reason: `You have mostly explored ${commonSize.toLowerCase()}${commonSetting ? `, ${commonSetting.toLowerCase()}` : ""} colleges. This is a ${collegeSizeLabel(college).toLowerCase()} ${college.setting?.toLowerCase() ?? "different"} environment${program ? ` where ${program.label.toLowerCase()} is an offered field` : ` with programs related to ${query}`}.`,
    };
  return {
    college,
    label: "Worth exploring" as const,
    reason: `${program?.label ?? query} is an offered field. This is an exploration suggestion, not an admission-likelihood judgment.`,
  };
}

export function buildHighSchoolForYou(
  data: AccountData,
  firstName: string,
  now = new Date(),
): HighSchoolForYouModel {
  const pro = isProUser(data.billing);
  const interests = interestTokens(data);
  const trackedIds = new Set(Object.keys(data.tracker ?? {}));
  const watchedIds = new Set((data.watchedOpportunities ?? []).map((item) => item.opportunityId));
  const hiddenIds = new Set(
    activeRecommendationFeedback(data.advisor?.feedbackRecords ?? [])
      .filter((item) => ["dismissed", "not-interested", "show-fewer", "not-eligible"].includes(item.feedbackType))
      .map((item) => item.actionId.replace(/^opportunity:/, "")),
  );
  const ranked = highSchoolOpportunities
    .filter((opportunity) => !trackedIds.has(opportunity.id) && !watchedIds.has(opportunity.id) && !hiddenIds.has(opportunity.id))
    .map((opportunity) => {
      const eligibility = evaluateHighSchoolEligibility(opportunity, data.profile);
      const matches = opportunityInterest(opportunity, interests);
      const deadlineDays = opportunity.application_deadline
        ? Math.max(0, Math.ceil((Date.parse(`${opportunity.application_deadline}T23:59:59Z`) - now.getTime()) / 86_400_000))
        : 120;
      const score = matches.length * 12 + (eligibility.state === "eligible" ? 20 : eligibility.state === "likely" ? 14 : 0) + (opportunity.metadata.highSchool?.cost.kind === "free" ? 3 : 0) + Math.max(0, 4 - deadlineDays / 30);
      return { opportunity, eligibility, matches, score, reasons: reasonsFor(opportunity, eligibility, matches, now), inJourney: false, watched: false };
    })
    .filter((item) => item.eligibility.state !== "not_eligible")
    .sort((a, b) => b.score - a.score || a.opportunity.title.localeCompare(b.opportunity.title));
  const strong = ranked.filter((item) => ["eligible", "likely"].includes(item.eligibility.state) && (item.matches.length || !interests.length));
  const uncertainMatch = ranked.find(
    (item) =>
      item.eligibility.state === "needs_information" && item.matches.length > 0,
  );
  const topPicks = (
    strong.length ? strong : uncertainMatch ? [uncertainMatch] : []
  ).slice(0, pro ? 3 : 1);
  const chosen = new Set(topPicks.map((item) => item.opportunity.id));
  const explorations = pro
    ? ranked.filter((item) => !chosen.has(item.opportunity.id) && item.matches.length > 0).slice(0, 2)
    : [];

  const admissions = buildAdmissionsJourney(
    data.savedColleges ?? [],
    data.collegeAdmissionsJourney?.tasks ?? [],
    now,
  );
  const opportunityDates = highSchoolOpportunities.flatMap((opportunity) => {
    const tracked = data.tracker?.[opportunity.id];
    const watched = watchedIds.has(opportunity.id);
    if ((!tracked && !watched) || !opportunity.application_deadline || opportunity.application_deadline < now.toISOString().slice(0, 10)) return [];
    return [{ id: `opportunity:${opportunity.id}`, date: opportunity.application_deadline, title: opportunity.title, detail: `${tracked ? tracked.status : "Watching"} · ${opportunity.metadata.highSchool!.opportunityType.replaceAll("_", " ")}`, kind: "Opportunity" as const, href: `/opportunities/${opportunity.id}` }];
  });
  const collegeDates = admissions.deadlines.map((item) => ({ id: `college:${item.id}`, date: item.date, title: item.college.name, detail: `${item.label} · Official ${item.cycle}`, kind: "College application" as const, href: `/colleges/${item.college.slug}/application` }));
  const planningDates = admissions.openTasks.flatMap((task) => task.dueDate && task.dueDate >= now.toISOString().slice(0, 10) ? [{ id: `task:${task.id}`, date: task.dueDate, title: task.title, detail: "Date you added", kind: "Your planning date" as const, href: "/admissions#general-tasks" }] : []);
  const comingUp = [...opportunityDates, ...collegeDates, ...planningDates]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, pro ? 5 : 2);

  return {
    firstName,
    pro,
    topPicks,
    explorations,
    collegeDiscovery: pro ? discoverCollege(data, interests) : null,
    comingUp,
    nextAction: admissions.nextAction,
    profilePrompt: interests.length ? null : "Add one interest to make these discoveries more specific.",
  };
}
