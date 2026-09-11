import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WritingEditor } from "@/components/writing-editor";
import { writingPromptById } from "@/data/writing-prompts";
import { normalizeWritingStore } from "@/data/writing";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import { getCollege } from "@/lib/colleges";
import { requireHighSchoolStage } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Writing Workspace",
  robots: { index: false, follow: false },
};

export default async function WritingDocumentPage({ params }: { params: Promise<{ documentId: string }> }) {
  const session = await requireHighSchoolStage();
  const store = normalizeWritingStore(session.data.writing);
  const document = store.documents[(await params).documentId];
  if (!document) notFound();
  const prompt = writingPromptById.get(document.promptId);
  if (!prompt) notFound();
  const college = document.collegeId ? getCollege(document.collegeId) : null;
  const collegeRecord = document.collegeId ? (session.data.savedColleges ?? []).find((item) => item.collegeId === document.collegeId) : undefined;
  const experiences = Object.values(normalizeResumeLabStore(session.data.resumeLab).experiences)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8)
    .map((experience) => ({
      id: experience.id,
      title: experience.title || "Untitled experience",
      organization: experience.organization,
      role: experience.highSchool?.roleHistory.at(-1)?.title,
      facts: experience.facts.filter((fact) => fact.confirmed).slice(0, 6).map((fact) => fact.text),
      accomplishments: experience.bullets.slice(0, 5).map((bullet) => bullet.text),
      notes: experience.highSchool?.privateNotes,
    }));
  return <WritingEditor
    initialStoreVersion={store.version}
    initialDocument={document}
    prompt={prompt}
    ideas={Object.values(store.ideas).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))}
    experiences={experiences}
    relatedWriting={Object.values(store.documents).filter((item) => item.id !== document.id && writingPromptById.get(item.promptId)?.type === prompt.type).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5).map((item) => ({ id: item.id, title: item.title, status: item.status, updatedAt: item.updatedAt }))}
    college={college ? { id: college.id, name: college.name, programs: college.programs.slice(0, 8).map((program) => program.label), notes: collegeRecord?.notes, priorities: collegeRecord?.priorities ?? [] } : undefined}
  />;
}
