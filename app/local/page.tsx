import type { Metadata } from "next"; import { CategoryDirectory } from "@/components/category-directory";
export const metadata: Metadata = { title: "Local Student Opportunities", description: "Browse verified school-specific and nearby opportunities from the UnlockED database.", alternates: { canonical: "/local" } };
export default function Page(){return <CategoryDirectory kind="local"/>}
