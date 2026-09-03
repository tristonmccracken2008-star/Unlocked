import type { Metadata } from "next";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { normalizeAnswerBank } from "@/lib/application-workspace";
import { AnswerBank } from "@/components/answer-bank";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Answer Bank", description: "Private, reusable factual stories for application writing.", robots: { index: false, follow: false } };

export default async function AnswerBankPage() {
  const session = await requireCompletedOnboarding();
  return <AnswerBank store={normalizeAnswerBank(session.data.answerBank)} />;
}
