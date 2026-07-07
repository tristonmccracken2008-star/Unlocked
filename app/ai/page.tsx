import type { Metadata } from "next"; import { CategoryDirectory } from "@/components/category-directory";
export const metadata: Metadata = { title: "Student AI Tools", description: "Browse verified AI tools and student access opportunities personalized by your UnlockED profile.", alternates: { canonical: "/ai" } };
export default function Page(){return <CategoryDirectory kind="ai"/>}
