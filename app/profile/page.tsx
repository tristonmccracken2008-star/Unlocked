import type { Metadata } from "next"; import { ProfilePage } from "@/components/profile-page"; import { requireCompletedOnboarding } from "@/lib/onboarding";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student Profile", description: "Edit the account profile used to personalize UnlockED.", alternates: { canonical: "/profile" }, robots: { index: false, follow: true } };
export default async function Page(){await requireCompletedOnboarding();return <ProfilePage/>}
