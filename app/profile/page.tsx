import type { Metadata } from "next"; import { cookies } from "next/headers"; import { redirect } from "next/navigation"; import { ProfilePage } from "@/components/profile-page"; import { getSession, sessionCookieName } from "@/lib/auth-store";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student Profile", description: "Create or edit the local profile used to personalize UnlockED.", alternates: { canonical: "/profile" }, robots: { index: false, follow: true } };
export default async function Page(){const cookieStore=await cookies();const session=await getSession(cookieStore.get(sessionCookieName)?.value);if(!session)redirect("/");return <ProfilePage/>}
