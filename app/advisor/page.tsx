import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdvisorPage } from "@/components/advisor-page";
import { getSession, sessionCookieName } from "@/lib/auth-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Advisor",
  description: "A focused UnlockED advisor view that explains what to do next and why.",
  alternates: { canonical: "/advisor" },
  robots: { index: false, follow: false },
};

export default async function Page() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session?.data.profile) redirect("/");
  return <AdvisorPage />;
}
