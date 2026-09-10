import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollegeDetail } from "@/components/college-detail";
import { getCollege, relatedColleges } from "@/lib/colleges";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { bestAct, bestSat, normalizeHighSchoolAcademicStore } from "@/data/high-school-academics";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const college = getCollege((await params).slug);
  return college ? { title: college.name, description: `Understand ${college.name}: academics, admissions context, cost, environment, and outcomes.`, robots: { index: false, follow: false } } : { title: "College not found" };
}

export default async function CollegePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireHighSchoolStage();
  const college = getCollege((await params).slug);
  if (!college) notFound();
  const saved = (session.data.savedColleges ?? []).some((item) => item.collegeId === college.id);
  const academicStore = normalizeHighSchoolAcademicStore(session.data.highSchoolAcademics);
  const sat = bestSat(academicStore);
  const act = bestAct(academicStore);
  return <CollegeDetail college={college} similar={relatedColleges(college)} saved={saved} studentTesting={saved ? { sat: sat?.total, act: act?.composite } : undefined} />;
}
