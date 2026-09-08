import type { Metadata } from "next";
import { CollegeExplorer } from "@/components/college-explorer";
import { collegeCollections, collegeFilterOptions, searchColleges, type CollegeQuery } from "@/lib/colleges";
import { requireHighSchoolStage } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "College Explorer", description: "Understand, compare, and save U.S. colleges without manufactured rankings.", robots: { index: false, follow: false } };

export default async function CollegesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireHighSchoolStage();
  const raw = await searchParams;
  const first = (key: string) => Array.isArray(raw[key]) ? raw[key][0] : raw[key];
  const initialQuery: CollegeQuery = { query: first("q"), state: first("state"), ownership: first("ownership"), setting: first("setting"), size: first("size"), program: first("program"), designation: first("designation"), limit: 18 };
  const initial = searchColleges(initialQuery);
  return <CollegeExplorer initialColleges={initial.colleges} initialTotal={initial.total} initialQuery={initialQuery} filters={collegeFilterOptions} collections={collegeCollections} savedIds={(session.data.savedColleges ?? []).map((item) => item.collegeId)} />;
}
