import type { Metadata } from "next"; import { CategoryDirectory } from "@/components/category-directory";
export const metadata: Metadata = { title: "Student Scholarships", description: "Browse verified scholarships and funding opportunities personalized for your student profile.", alternates: { canonical: "/scholarships" } };
export default function Page(){return <CategoryDirectory kind="scholarships"/>}
