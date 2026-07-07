import type { Metadata } from "next"; import { CategoryDirectory } from "@/components/category-directory";
export const metadata: Metadata = { title: "Student Financial Benefits", description: "Browse verified financial benefits and resources for students.", alternates: { canonical: "/financial" } };
export default function Page(){return <CategoryDirectory kind="financial"/>}
