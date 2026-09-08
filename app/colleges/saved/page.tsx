import type { Metadata } from "next";
import { MyCollegeList } from "@/components/my-college-list";
import { getColleges } from "@/lib/colleges";
import { requireHighSchoolStage } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My College List", robots: { index: false, follow: false } };

export default async function MyCollegeListPage() {
  const session = await requireHighSchoolStage(); const records = session.data.savedColleges ?? [];
  const colleges = getColleges(records.map((record) => record.collegeId));
  return <MyCollegeList initialItems={colleges.map((college) => ({ college, record: records.find((record) => record.collegeId === college.id)! }))} />;
}
