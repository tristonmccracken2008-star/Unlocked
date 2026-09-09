import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HighSchoolActivityDetail } from "@/components/high-school-activity-detail";
import { normalizeOpportunityPassport } from "@/data/passport";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import { requireHighSchoolStage } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity & Experience", robots: { index: false, follow: false } };
export default async function ActivityDetailPage({ params }: { params: Promise<{ experienceId: string }> }) { const session = await requireHighSchoolStage(); const store = normalizeResumeLabStore(session.data.resumeLab); const experienceId = decodeURIComponent((await params).experienceId); if (!store.experiences[experienceId]) notFound(); const passport = normalizeOpportunityPassport(session.data.passport); return <HighSchoolActivityDetail initialStore={store} experienceId={experienceId} passportVisible={passport.visibleExperienceIds.includes(experienceId)} />; }
