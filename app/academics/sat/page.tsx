import type { Metadata } from "next";
import { SatPracticeWorkspace } from "@/components/sat-practice-workspace";
import { normalizeSatPracticeStore } from "@/data/sat-practice";
import {
  normalizeHighSchoolAcademicStore,
  bestSat,
} from "@/data/high-school-academics";
import {
  publicSatQuestions,
  recommendSatDomain,
} from "@/lib/sat-practice-service";
import { requireHighSchoolStage } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Digital SAT Practice",
  robots: { index: false, follow: false },
};

export default async function SatPracticePage() {
  const session = await requireHighSchoolStage();
  const practice = normalizeSatPracticeStore(session.data.satPractice);
  const academics = normalizeHighSchoolAcademicStore(
    session.data.highSchoolAcademics,
  );
  const official = bestSat(academics);
  const nextTest = academics.testing.plans
    .filter(
      (plan) =>
        plan.test === "sat" &&
        plan.registrationStatus !== "completed" &&
        plan.date >= new Date().toISOString().slice(0, 10),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const activeSession = [...practice.sessions]
    .reverse()
    .find((item) => item.status === "active");
  return (
    <SatPracticeWorkspace
      initialStore={practice}
      recommendation={recommendSatDomain(practice)}
      officialScore={official?.total}
      nextTest={nextTest?.date}
      initialSession={activeSession}
      initialQuestions={
        activeSession ? publicSatQuestions(activeSession.questionIds) : []
      }
    />
  );
}
