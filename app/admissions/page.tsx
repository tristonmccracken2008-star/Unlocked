import type { Metadata } from "next";
import { AdmissionsJourney } from "@/components/admissions-journey";
import { buildAdmissionsJourney } from "@/lib/admissions-journey";
import { requireHighSchoolStage } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admissions Journey", robots: { index: false, follow: false } };
export default async function AdmissionsPage() { const session = await requireHighSchoolStage(); const tasks = session.data.collegeAdmissionsJourney?.tasks ?? []; return <AdmissionsJourney model={buildAdmissionsJourney(session.data.savedColleges ?? [], tasks)} generalTasks={tasks} />; }
