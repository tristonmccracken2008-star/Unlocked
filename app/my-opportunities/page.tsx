import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCompletedOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Journey",
  description: "Your UnlockED Journey timeline.",
  alternates: { canonical: "/my-opportunities" },
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireCompletedOnboarding();
  redirect("/");
}
