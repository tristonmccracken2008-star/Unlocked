import type { Metadata } from "next"; import { CategoryDirectory } from "@/components/category-directory";
export const metadata: Metadata = { title: "Student Software Benefits", description: "Browse verified software benefits available through student status.", alternates: { canonical: "/software" } };
export default function Page(){return <CategoryDirectory kind="software"/>}
