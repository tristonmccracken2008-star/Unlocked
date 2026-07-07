import type { Metadata } from "next"; import { UniversityPage } from "@/components/university-page";
export const metadata: Metadata = { title: "Your University", description: "Open your university’s verified student benefits and opportunities directory.", alternates: { canonical: "/university" }, robots: { index: false, follow: true } };
export default function Page(){return <UniversityPage/>}
