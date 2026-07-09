import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MyOpportunitiesPage } from "@/components/my-opportunities-page";
import { getSession, sessionCookieName } from "@/lib/auth-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Opportunities",
  description: "Track saved student opportunities, application progress, deadlines, and completed benefits in UnlockED.",
  alternates: { canonical: "/my-opportunities" },
  robots: { index: false, follow: false },
};

export default async function Page() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session?.data.profile) redirect("/");
  return <MyOpportunitiesPage />;
}
