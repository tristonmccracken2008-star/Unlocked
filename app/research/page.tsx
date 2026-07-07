import type { Metadata } from "next"; import { CategoryDirectory } from "@/components/category-directory";
export const metadata: Metadata = { title: "Undergraduate Research Opportunities", description: "Browse verified undergraduate research programs personalized by school, major, and year.", alternates: { canonical: "/research" } };
export default function Page(){return <CategoryDirectory kind="research"/>}
