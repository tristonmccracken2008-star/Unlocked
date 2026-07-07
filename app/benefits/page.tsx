import type { Metadata } from "next"; import { CategoryDirectory } from "@/components/category-directory";
export const metadata: Metadata = { title: "Verified Student Benefits", description: "Browse verified national and university-specific student benefits in UnlockED.", alternates: { canonical: "/benefits" } };
export default function Page(){return <CategoryDirectory kind="benefits"/>}
