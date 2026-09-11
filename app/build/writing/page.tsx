import type { Metadata } from "next";
import { WritingHome, type WritingHomeDocument, type WritingHomeInstitution } from "@/components/writing-home";
import { writingPromptCoverage, writingPrompts, writingResources } from "@/data/writing-prompts";
import { normalizeWritingStore } from "@/data/writing";
import { getColleges } from "@/lib/colleges";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { writingWordCount } from "@/lib/writing-review";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Writing",
  description: "Private college application writing, ideas, drafts, and revisions.",
  robots: { index: false, follow: false },
};

export default async function WritingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireHighSchoolStage();
  const store = normalizeWritingStore(session.data.writing);
  const requestedCollege = (await searchParams)?.college;
  const collegeId = Array.isArray(requestedCollege) ? requestedCollege[0] : requestedCollege;
  const colleges = getColleges((session.data.savedColleges ?? []).map((record) => record.collegeId));
  const documents: WritingHomeDocument[] = Object.values(store.documents).map((document) => {
    const prompt = writingPrompts.find((item) => item.id === document.promptId);
    return {
      id: document.id,
      promptId: document.promptId,
      collegeId: document.collegeId,
      title: document.title,
      status: document.status,
      cycle: document.cycle,
      updatedAt: document.updatedAt,
      wordCount: writingWordCount(document.content),
      wordLimit: prompt?.wordLimit,
      promptType: prompt?.type ?? "personal_statement",
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const institutions: WritingHomeInstitution[] = colleges.map((college) => {
    const prompts = writingPrompts.filter((prompt) => prompt.institutionId === college.id);
    return {
      id: college.id,
      name: college.name,
      prompts,
      coverage: writingPromptCoverage[college.id],
      documents: documents.filter((document) => document.collegeId === college.id),
    };
  });
  return <WritingHome
    initialVersion={store.version}
    documents={documents}
    ideas={Object.values(store.ideas).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))}
    institutions={institutions}
    personalPrompts={writingPrompts.filter((prompt) => !prompt.institutionId && prompt.type !== "additional_information")}
    additionalPrompt={writingPrompts.find((prompt) => prompt.type === "additional_information")}
    resources={writingResources}
    requestedCollegeId={collegeId}
  />;
}
