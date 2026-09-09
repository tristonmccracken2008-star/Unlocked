import type { Metadata } from "next";
import { AdmissionsJourney } from "@/components/admissions-journey";
import { buildAdmissionsJourney } from "@/lib/admissions-journey";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { commonAppActivitySetId } from "@/data/high-school-activities";
import { normalizeResumeLabStore } from "@/data/resume-lab";

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
  return (
    <AdmissionsJourney
      model={buildAdmissionsJourney(
        session.data.savedColleges ?? [],
        tasks,
        new Date(),
        { applicationActivitiesReady: activitySet?.status === "ready" },
      )}
      generalTasks={tasks}
    />
  );
}
