import type { Metadata } from "next"; import { ProfilePage } from "@/components/profile-page";
export const metadata: Metadata = { title: "Student Profile", description: "Create or edit the local profile used to personalize UnlockED.", alternates: { canonical: "/profile" }, robots: { index: false, follow: true } };
export default function Page(){return <ProfilePage/>}
