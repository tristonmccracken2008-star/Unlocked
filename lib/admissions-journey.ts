import "server-only";
import {
  verifiedCollegeAdmissions,
  type CollegeAdmissionsTask,
  type CollegeListRecord,
} from "@/data/college-admissions";
import { getColleges } from "./colleges";

export function buildAdmissionsJourney(
  records: CollegeListRecord[],
  generalTasks: CollegeAdmissionsTask[],
  now = new Date(),
  options: { applicationActivitiesReady?: boolean } = {},
) {
  const colleges = getColleges(records.map((record) => record.collegeId));
  const items = records.flatMap((record) => {
    const college = colleges.find((item) => item.id === record.collegeId);
    return college ? [{ college, record }] : [];
  });
  const openTasks = [
    ...generalTasks,
    ...items.flatMap((item) => item.record.application?.tasks ?? []),
  ]
    .filter((task) => !task.completed)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const noPlan = items.find(
    (item) =>
      item.record.interestState === "planning_to_apply" &&
      (!item.record.application || item.record.application.plan === "unknown"),
  );
  const needsApplicationActivities =
    items.some(
      (item) =>
        ["planning_to_apply", "applied", "decision_received"].includes(
          item.record.interestState,
        ) &&
        verifiedCollegeAdmissions[
          item.college.id
        ]?.applicationPlatforms?.includes("common_app"),
    ) && !options.applicationActivitiesReady;
  const deadlines = items
    .flatMap((item) => {
      const facts = verifiedCollegeAdmissions[item.college.id];
      const plan = item.record.application?.plan;
      return (facts?.deadlines ?? [])
        .filter(
          (deadline) =>
            deadline.plan === plan &&
            deadline.date >= now.toISOString().slice(0, 10),
        )
        .map((deadline) => ({ ...deadline, college: item.college }));
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextTaskCollege = openTasks[0]?.collegeId
    ? items.find((item) => item.college.id === openTasks[0].collegeId)?.college
    : undefined;
  const nextAction = noPlan
    ? {
        title: `Choose an application plan for ${noPlan.college.name}`,
        detail: "This makes its verified dates and requirements useful.",
        href: `/colleges/${noPlan.college.slug}/application`,
      }
    : openTasks[0]
      ? {
          title: openTasks[0].title,
          detail: openTasks[0].dueDate
            ? `Your planning date: ${openTasks[0].dueDate}`
            : "Your next open admissions task.",
          href: nextTaskCollege
            ? `/colleges/${nextTaskCollege.slug}/application`
            : "/admissions#general-tasks",
        }
      : needsApplicationActivities
        ? {
            title: "Prepare your application activities",
            detail:
              "Choose and shape factual activity versions before you apply.",
            href: "/build/application-activities",
          }
        : deadlines[0]
          ? {
              title: `${deadlines[0].college.name}: ${deadlines[0].label}`,
              detail: `Official date: ${deadlines[0].date} · ${deadlines[0].cycle}`,
              href: `/colleges/${deadlines[0].college.slug}/application`,
            }
          : items.length
            ? {
                title: "Review your college list",
                detail:
                  "Choose the one next step that would make a school clearer.",
                href: "/colleges/saved",
              }
            : {
                title: "Save a college worth exploring",
                detail:
                  "Your admissions workspace starts with curiosity, not commitment.",
                href: "/colleges",
              };
  return {
    items,
    openTasks,
    deadlines,
    nextAction,
    attention: {
      activities: needsApplicationActivities ? 1 : 0,
      noPlan: items.filter(
        (item) =>
          item.record.interestState === "planning_to_apply" &&
          (!item.record.application ||
            item.record.application.plan === "unknown"),
      ).length,
      needsVerification: items.reduce(
        (sum, item) =>
          sum +
          (item.record.application?.requirements.filter(
            (requirement) => requirement.status === "needs_verification",
          ).length ?? 0),
        0,
      ),
      next30Days: deadlines.filter(
        (deadline) =>
          Date.parse(`${deadline.date}T12:00:00Z`) - now.getTime() <=
          30 * 86_400_000,
      ).length,
    },
  };
}
