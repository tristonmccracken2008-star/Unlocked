import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CollegeApplicationWorkspace } from "@/components/college-application-workspace";
import { verifiedCollegeAdmissions } from "@/data/college-admissions";
import { getCollege } from "@/lib/colleges";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { commonAppActivitySetId } from "@/data/high-school-activities";
import { normalizeResumeLabStore } from "@/data/resume-lab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "College Application Workspace",
  robots: { index: false, follow: false },
};

export default async function CollegeApplicationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireHighSchoolStage();
  const college = getCollege((await params).slug);
  if (!college) notFound();
  const record = (session.data.savedColleges ?? []).find(
    (item) => item.collegeId === college.id,
  );
  if (!record) redirect(`/colleges/${college.slug}`);
  const activitySet = normalizeResumeLabStore(session.data.resumeLab)
    .applicationActivitySets?.[commonAppActivitySetId];
  return (
    <CollegeApplicationWorkspace
      college={college}
      initialRecord={record}
      verified={verifiedCollegeAdmissions[college.id]}
      applicationActivitiesReady={activitySet?.status === "ready"}
    />
  );
}
