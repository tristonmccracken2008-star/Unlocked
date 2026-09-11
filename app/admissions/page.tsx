import type { Metadata } from "next";
import { AdmissionsJourney } from "@/components/admissions-journey";
import { buildAdmissionsJourney } from "@/lib/admissions-journey";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { commonAppActivitySetId } from "@/data/high-school-activities";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import { highSchoolOpportunities } from "@/data/high-school-opportunities";
import { isHighSchoolOpportunity } from "@/lib/high-school-opportunities";
import { normalizeHighSchoolAcademicStore } from "@/data/high-school-academics";
import { normalizeSatPracticeStore } from "@/data/sat-practice";
import { normalizeSatPreparation } from "@/data/sat-command-center";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admissions Journey",
  robots: { index: false, follow: false },
};
export default async function AdmissionsPage() {
  const session = await requireHighSchoolStage();
  const tasks = session.data.collegeAdmissionsJourney?.tasks ?? [];
  const activitySet = normalizeResumeLabStore(session.data.resumeLab)
    .applicationActivitySets?.[commonAppActivitySetId];
  const opportunityPursuits = Object.values(session.data.tracker ?? {})
    .map((tracked) => {
      const opportunity = highSchoolOpportunities.find(
        (candidate) => candidate.id === tracked.id,
      );
      if (!opportunity || !isHighSchoolOpportunity(opportunity)) return null;
      return {
        id: opportunity.id,
        title: opportunity.title,
        organization: opportunity.organization,
        status: tracked.status,
        deadline: opportunity.application_deadline,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) =>
      (left.deadline ?? "9999-12-31").localeCompare(
        right.deadline ?? "9999-12-31",
      ),
    );
  const testPlans: Array<{ id:string; test:"sat"|"act"; date:string; registrationStatus:string; preparationDate?:string; href?:string }> = normalizeHighSchoolAcademicStore(session.data.highSchoolAcademics).testing.plans
    .filter((item) => item.registrationStatus !== "completed")
    .map((item) => ({ id: `${item.test}:${item.date}`, test: item.test, date: item.date, registrationStatus: item.registrationStatus, preparationDate: item.preparationDate, href:"/academics" }));
  const bluebookDate = normalizeSatPreparation(normalizeSatPracticeStore(session.data.satPractice).preparation).bluebookDate;
  if (bluebookDate && bluebookDate >= new Date().toISOString().slice(0,10)) testPlans.push({ id:`bluebook:${bluebookDate}`, test:"sat", date:bluebookDate, registrationStatus:"Bluebook practice planned", preparationDate:undefined, href:"/academics/sat" });
  return (
    <AdmissionsJourney
      model={buildAdmissionsJourney(
        session.data.savedColleges ?? [],
        tasks,
        new Date(),
        { applicationActivitiesReady: activitySet?.status === "ready" },
      )}
      generalTasks={tasks}
      opportunityPursuits={opportunityPursuits}
      testPlans={testPlans}
    />
  );
}
