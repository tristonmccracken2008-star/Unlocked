import type { Metadata } from "next"; import { CategoryDirectory } from "@/components/category-directory";
export const metadata: Metadata = { title: "Student Career Opportunities", description: "Browse verified internships, freshman programs, hackathons, fellowships, and competitions.", alternates: { canonical: "/career" } };
export default function Page(){return <CategoryDirectory kind="career"/>}
