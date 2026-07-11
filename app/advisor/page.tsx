import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdvisorPage } from "@/components/advisor-page";
import { getSession, sessionCookieName } from "@/lib/auth-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "For You",
  description: "Personalized UnlockED opportunity recommendations selected around your profile and activity.",
  alternates: { canonical: "/advisor" },
  robots: { index: false, follow: false },
};

export default async function Page() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session?.data.profile) redirect("/");
  return <AdvisorPage />;
}
