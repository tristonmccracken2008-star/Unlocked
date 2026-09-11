import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CollegeApplicationWorkspace } from "@/components/college-application-workspace";
import { verifiedCollegeAdmissions } from "@/data/college-admissions";
import { getCollege } from "@/lib/colleges";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { commonAppActivitySetId } from "@/data/high-school-activities";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import { normalizeWritingStore } from "@/data/writing";
import { writingPromptById } from "@/data/writing-prompts";
import { writingWordCount } from "@/lib/writing-review";

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
  const writing = Object.values(normalizeWritingStore(session.data.writing).documents)
    .filter((document) => document.collegeId === college.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((document) => {
      const prompt = writingPromptById.get(document.promptId);
      return {
        id: document.id,
        title: document.title,
        status: document.status,
        wordCount: writingWordCount(document.content),
        wordLimit: prompt?.wordLimit,
      };
    });
  return (
    <CollegeApplicationWorkspace
      college={college}
      initialRecord={record}
      verified={verifiedCollegeAdmissions[college.id]}
      applicationActivitiesReady={activitySet?.status === "ready"}
      writing={writing}
    />
  );
}
