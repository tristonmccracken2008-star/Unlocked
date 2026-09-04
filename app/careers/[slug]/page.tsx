import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CareerDetail } from "@/components/career-detail";
import { careerBySlug } from "@/data/careers";
import { listPublishedOpportunities } from "@/lib/content-store";
import { relatedOpportunities } from "@/lib/career-opportunities";
import { requireCompletedOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const career = careerBySlug((await params).slug);
  return career ? { title: career.name, description: career.description, robots: { index: false, follow: false } } : { title: "Career not found", robots: { index: false, follow: false } };
}

export default async function CareerPage({ params }: { params: Promise<{ slug: string }> }) {
  const career = careerBySlug((await params).slug);
  if (!career) notFound();
  await requireCompletedOnboarding();
  let opportunities: Awaited<ReturnType<typeof listPublishedOpportunities>> = [];
  try { opportunities = await listPublishedOpportunities(); }
  catch (error) { console.error("[UnlockED Careers] Related opportunities unavailable", { slug: career.slug, errorType: error instanceof Error ? error.name : "UnknownError" }); }
  return <CareerDetail career={career} opportunities={relatedOpportunities(career, opportunities)} />;
}
