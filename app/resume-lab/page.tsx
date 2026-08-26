import type { Metadata } from "next";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildResumeLabModel } from "@/lib/resume-lab";
import { ResumeLab } from "@/components/resume-lab";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Resume Lab",
  description:
    "Build evidence-first resume versions from your verified experience.",
  robots: { index: false, follow: false },
};

export default async function ResumeLabPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; returnTo?: string; view?: string; resume?: string; experience?: string }>;
}) {
  const session = await requireCompletedOnboarding();
  const { target, returnTo, view, resume, experience } = await searchParams;
  const ids = [
    ...new Set([
      ...Object.keys(session.data.tracker ?? {}),
      ...Object.keys(session.data.activity?.tracked ?? {}),
      ...Object.values(session.data.accomplishments ?? {}).flatMap((item) =>
        item.canonicalOpportunityId ? [item.canonicalOpportunityId] : [],
      ),
      ...Object.values(session.data.resumeLab?.resumes ?? {}).flatMap((item) =>
        item.target.type === "opportunity" && item.target.id
          ? [item.target.id]
          : [],
      ),
    ]),
  ];
  const opportunities = await listPublishedOpportunitiesByIds(ids, {
    includeArchived: true,
  }).catch(() => []);
  const safeReturnTo =
    returnTo?.startsWith("/applications/") && !returnTo.startsWith("//")
      ? returnTo
      : undefined;
  const initial = buildResumeLabModel({ user: session.user, account: session.data, opportunities });
  return (
    <ResumeLab
      initial={initial}
      initialTargetId={target && ids.includes(target) ? target : undefined}
      returnTo={safeReturnTo}
      initialView={view === "experience" || view === "resumes" ? view : undefined}
      initialResumeId={resume && initial.resumes.some((item) => item.id === resume) ? resume : undefined}
      initialExperienceId={experience && initial.experiences.some((item) => item.id === experience) ? experience : undefined}
    />
  );
}
