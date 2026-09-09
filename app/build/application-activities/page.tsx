import type { Metadata } from "next";
import { ApplicationActivitiesBuilder } from "@/components/application-activities-builder";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import { requireHighSchoolStage } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Application Activities", robots: { index: false, follow: false } };
export default async function ApplicationActivitiesPage({ searchParams }: { searchParams: Promise<{ experience?: string }> }) { const session = await requireHighSchoolStage(); const store = normalizeResumeLabStore(session.data.resumeLab); const requested = (await searchParams).experience; return <ApplicationActivitiesBuilder initialStore={store} initialExperienceId={requested && store.experiences[requested] ? requested : undefined} />; }
