import { normalizeAccomplishmentStore } from "@/data/accomplishments";
import {
  collegeApplicationPlanLabels,
  collegeRequirementStatusLabels,
  verifiedCollegeAdmissions,
  verifiedCollegeTestingPolicies,
  type CollegeListRecord,
} from "@/data/college-admissions";
import type { CdsAdmissionFactor, CdsImportance } from "@/data/college-cds";
import {
  bestAct,
  bestSat,
  courseLevelLabels,
  normalizeHighSchoolAcademicStore,
} from "@/data/high-school-academics";
import { normalizeResumeLabStore, type ResumeExperienceKind } from "@/data/resume-lab";
import type { AccountData } from "@/lib/account-types";
import {
  cdsFactorLabels,
  cdsImportanceLabels,
  latestCollegeCds,
} from "@/lib/college-admissions-insights";

export type AdmissionsContextItem = {
  factor: CdsAdmissionFactor;
  label: string;
  importance: CdsImportance;
  importanceLabel: string;
  recordLabel: string;
  recordItems: string[];
  recordEmpty: string;
};

export type AdmissionsIntelligenceModel = {
  privacy: "private";
  college: { id: string; name: string; slug: string };
  intent: CollegeListRecord["interestState"];
  reports: {
    academicYear?: string;
    cohortLabel?: string;
    verifiedAt?: string;
    sourceUrl?: string;
    testingPolicy?: { label: string; cycle: string; verifiedAt: string; sourceUrl: string };
    academicFactors: Array<{ label: string; importance: string }>;
  };
  academics: {
    gpas: string[];
    coursework: string;
    courseDetail: string[];
    classRank: string;
    bestSat?: number;
    bestAct?: number;
  };
  factors: AdmissionsContextItem[];
  application: {
    plan: string;
    status: string;
    deadline?: { label: string; date: string; cycle: string; sourceUrl: string };
    requirements: Array<{ id: string; title: string; status: string; sourceUrl?: string; verified: boolean }>;
    officialRequirements: Array<{ id: string; title: string; sourceUrl: string }>;
    sourceUrl?: string;
    cycle?: string;
    verifiedAt?: string;
  };
  unknowns: string[];
  summary: string;
};

const activityKinds: Partial<Record<CdsAdmissionFactor, ResumeExperienceKind[]>> = {
  extracurriculars: ["activity", "campus_organization", "athletics", "leadership", "competition", "project", "research", "program"],
  volunteer_work: ["volunteer", "teaching"],
  work_experience: ["work", "internship"],
  talent_ability: ["project", "research", "publication", "course_project", "independent_project", "award", "competition"],
};

const recordLabels: Partial<Record<CdsAdmissionFactor, string>> = {
  extracurriculars: "Relevant recorded experiences",
  volunteer_work: "Volunteer and service experiences",
  work_experience: "Work and internship experiences",
  talent_ability: "Projects, research, publications, awards, and competitions",
};

const emptyLabels: Partial<Record<CdsAdmissionFactor, string>> = {
  extracurriculars: "No extracurricular experience is currently recorded in UnlockED.",
  volunteer_work: "No volunteer experience is currently recorded in UnlockED.",
  work_experience: "No work experience is currently recorded in UnlockED.",
  talent_ability: "No related project, research, publication, award, or competition is currently recorded in UnlockED.",
};

function formatGpa(label: string, value?: number, scale?: number) {
  return value === undefined || scale === undefined ? undefined : `${value.toFixed(2)} / ${scale.toFixed(2)} ${label}`;
}

function rankLabel(rank: ReturnType<typeof normalizeHighSchoolAcademicStore>["classRank"]) {
  if (!rank || rank.kind === "unknown") return "Not recorded";
  if (rank.kind === "school_does_not_rank") return "School does not rank";
  if (rank.kind === "exact") return `${rank.rank} of ${rank.classSize}`;
  if (rank.kind === "percentile") return `Top ${rank.percentile}% reported`;
  return "Not recorded";
}

function requirementKind(title: string) {
  const value = title.toLowerCase();
  if (/recommend|teacher evaluation|counselor/.test(value)) return "recommendations";
  if (/essay|supplement|personal statement|writing/.test(value)) return "essay";
  if (/interview/.test(value)) return "interview";
  return undefined;
}

function matchesExperience(factor: CdsAdmissionFactor, kind: ResumeExperienceKind, category?: string) {
  if (!activityKinds[factor]?.includes(kind)) return false;
  if (factor === "volunteer_work" && category?.toLowerCase().includes("family responsibility")) return false;
  return true;
}

export function buildAdmissionsIntelligence(
  college: { id: string; name: string; slug: string },
  saved: CollegeListRecord,
  account: AccountData,
): AdmissionsIntelligenceModel {
  const snapshot = latestCollegeCds(college.id);
  const current = verifiedCollegeAdmissions[college.id];
  const testingPolicy = verifiedCollegeTestingPolicies[college.id];
  const academics = normalizeHighSchoolAcademicStore(account.highSchoolAcademics);
  const resume = normalizeResumeLabStore(account.resumeLab);
  const accomplishments = Object.values(normalizeAccomplishmentStore(account.accomplishments)).filter((item) => !item.hidden && !item.inactiveAt);
  const experiences = Object.values(resume.experiences);
  const courses = Object.values(academics.courses);
  const courseCounts = courses.reduce<Record<string, number>>((counts, course) => {
    counts[course.level] = (counts[course.level] ?? 0) + 1;
    return counts;
  }, {});
  const courseDetail = (["ap", "honors", "ib", "dual_enrollment", "college_course", "advanced_school_specific"] as const)
    .flatMap((level) => courseCounts[level] ? [`${courseCounts[level]} ${courseLevelLabels[level]}`] : []);
  const gpas = [
    formatGpa("unweighted", academics.gpas.unweighted?.value, academics.gpas.unweighted?.scale),
    formatGpa("weighted", academics.gpas.weighted?.value, academics.gpas.weighted?.scale),
    formatGpa("school reported", academics.gpas.school_reported?.value, academics.gpas.school_reported?.scale),
  ].filter((item): item is string => Boolean(item));

  const factorItems: AdmissionsContextItem[] = Object.entries(snapshot?.factors ?? {}).flatMap(([rawFactor, importance]) => {
    const factor = rawFactor as CdsAdmissionFactor;
    const mappedKinds = activityKinds[factor];
    let recordItems: string[] = [];
    let recordLabel = "Your recorded context";
    let recordEmpty = "No related information is currently recorded in UnlockED.";
    if (mappedKinds) {
      recordItems = experiences
        .filter((item) => matchesExperience(factor, item.kind, item.highSchool?.category))
        .map((item) => item.title || item.organization || item.kind.replaceAll("_", " "));
      if (factor === "talent_ability") {
        recordItems.push(...accomplishments
          .filter((item) => ["research", "competition", "project"].includes(item.kind))
          .map((item) => item.snapshot.title));
      }
      recordItems = [...new Set(recordItems)].slice(0, 8);
      recordLabel = recordLabels[factor] ?? recordLabel;
      recordEmpty = emptyLabels[factor] ?? recordEmpty;
    } else if (factor === "essay" || factor === "recommendations" || factor === "interview") {
      const tracked = saved.application?.requirements.filter((item) => requirementKind(item.title) === factor) ?? [];
      const official = current?.requirements.filter((item) => requirementKind(item.title) === factor) ?? [];
      recordItems = tracked.length
        ? tracked.map((item) => `${item.title} · ${collegeRequirementStatusLabels[item.status]}`)
        : official.map((item) => `${item.title} · not yet tracked`);
      recordLabel = "Current application context";
      recordEmpty = `No current ${factor === "essay" ? "writing" : factor} requirement is verified in UnlockED.`;
    } else {
      return [];
    }
    return [{
      factor,
      label: cdsFactorLabels[factor],
      importance,
      importanceLabel: cdsImportanceLabels[importance],
      recordLabel,
      recordItems,
      recordEmpty,
    }];
  });

  const application = saved.application;
  const deadline = current?.deadlines.find((item) => item.plan === application?.plan);
  const trackedRequirements = application?.requirements ?? [];
  const unknowns: string[] = [];
  if (!snapshot) unknowns.push("Institution-reported Common Data Set factors are not available here yet.");
  if (!testingPolicy) unknowns.push("The current testing policy needs verification.");
  if (!snapshot?.gpa) unknowns.push("The institution does not report a usable GPA distribution in the available record.");
  if (!academics.classRank || academics.classRank.kind === "unknown") unknowns.push("Current class rank is not recorded.");
  if (!gpas.length) unknowns.push("No GPA is currently recorded in your Academic Profile.");
  if (!courses.length) unknowns.push("No coursework is currently recorded in your Academic Profile.");
  if (!current) unknowns.push("Current application requirements have not been verified in UnlockED.");
  else if (!current.requirements.some((item) => requirementKind(item.title) === "essay")) unknowns.push("Current supplemental writing requirements have not been verified in UnlockED.");

  const reportedNames = Object.entries(snapshot?.factors ?? {})
    .filter(([, importance]) => importance === "very_important" || importance === "important")
    .slice(0, 4)
    .map(([factor]) => cdsFactorLabels[factor as CdsAdmissionFactor].toLowerCase());
  const studentAreas = [gpas.length ? "GPA" : "", courses.length ? "coursework" : "", bestSat(academics) || bestAct(academics) ? "testing" : "", experiences.length ? "experiences" : ""].filter(Boolean);
  const summary = snapshot
    ? `${college.name} reports ${reportedNames.length ? reportedNames.join(", ") : "its admission factors"} in its ${snapshot.academicYear} Common Data Set. Your private UnlockED record currently contains ${studentAreas.length ? studentAreas.join(", ") : "no connected academic or experience details"}. Current application requirements remain a separate source of truth.`
    : `Your private UnlockED record currently contains ${studentAreas.length ? studentAreas.join(", ") : "no connected academic or experience details"}. Institution-reported consideration factors are not available here, so current official application information remains the source of truth.`;

  return {
    privacy: "private",
    college,
    intent: saved.interestState,
    reports: {
      academicYear: snapshot?.academicYear,
      cohortLabel: snapshot?.cohortLabel,
      verifiedAt: snapshot?.verifiedAt,
      sourceUrl: snapshot?.sourceUrl,
      testingPolicy: testingPolicy ? { label: testingPolicy.label, cycle: testingPolicy.cycle, verifiedAt: testingPolicy.verifiedAt, sourceUrl: testingPolicy.sourceUrl } : undefined,
      academicFactors: (["rigor", "academic_gpa", "class_rank", "standardized_tests"] as const).flatMap((factor) => {
        const importance = snapshot?.factors?.[factor];
        return importance ? [{ label: cdsFactorLabels[factor], importance: cdsImportanceLabels[importance] }] : [];
      }),
    },
    academics: {
      gpas,
      coursework: courses.length ? `${courses.length} recorded course${courses.length === 1 ? "" : "s"}` : "No coursework recorded",
      courseDetail,
      classRank: rankLabel(academics.classRank),
      bestSat: bestSat(academics)?.total,
      bestAct: bestAct(academics)?.composite,
    },
    factors: factorItems,
    application: {
      plan: application ? collegeApplicationPlanLabels[application.plan] : "Not selected",
      status: application?.status.replaceAll("_", " ") ?? "Not started",
      deadline: deadline ? { label: deadline.label, date: deadline.date, cycle: deadline.cycle, sourceUrl: deadline.sourceUrl } : undefined,
      requirements: trackedRequirements.map((item) => ({ id: item.id, title: item.title, status: collegeRequirementStatusLabels[item.status], sourceUrl: item.sourceUrl, verified: item.provenance === "official_verified" })),
      officialRequirements: current?.requirements.map((item) => ({ id: item.id, title: item.title, sourceUrl: item.sourceUrl })) ?? [],
      sourceUrl: current?.sourceUrl,
      cycle: current?.cycle,
      verifiedAt: current?.verifiedAt,
    },
    unknowns,
    summary,
  };
}
