import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { StudentActivity } from "@/data/student-activity";
import type { OpportunityAdvisorExplanation } from "@/data/advisor-brain";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { explainOpportunityWithAdvisorBrain } from "@/data/advisor-brain";
import {
  inferApplicationsFromActivity,
  normalizeStudentProgress,
} from "@/data/student-progress";
import type { Opportunity } from "@/data/opportunities";
import { schools } from "@/data/seed";
import { OpportunityDetailExperience } from "@/components/opportunity-detail-experience";
import { OpportunityViewTracker } from "@/components/opportunity-activity";
import {
  getManagedOpportunity,
  listPublishedOpportunitiesByIds,
} from "@/lib/content-store";
import { relatedDiscoverOpportunityIds } from "@/lib/discover-related";
import { serializeJsonLd } from "@/lib/json-ld";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { conciseOpportunityDescription } from "@/lib/opportunity-detail";
import { buildOpportunityDetailProjection } from "@/lib/opportunity-detail-projection";
import { strategyOpportunityIds } from "@/lib/personal-opportunity-strategy";

export const dynamic = "force-dynamic";
const getOpportunity = cache((id: string) =>
  getManagedOpportunity(id, { includeArchived: true }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const item = await getOpportunity((await params).id);
  if (!item) return { title: "Opportunity not found" };
  const title = `${item.title} | Eligibility and Official Link`;
  const description = conciseOpportunityDescription(item);
  return {
    title,
    description,
    alternates: { canonical: `/opportunities/${item.id}` },
    openGraph: {
      title,
      description,
      url: `/opportunities/${item.id}`,
      type: "article",
    },
  };
}

async function personalizedExplanation(
  item: Opportunity,
  session: Awaited<ReturnType<typeof requireCompletedOnboarding>>,
): Promise<OpportunityAdvisorExplanation | null> {
  const profile = session.data.profile;
  if (!profile || !session.data.onboardingComplete) return null;
  const school = schools.find(
    (candidate) => candidate.slug === profile.schoolSlug,
  );
  if (!school) return null;
  const activity: StudentActivity = session.data.activity ?? {
    viewed: [],
    saved: session.data.savedOpportunities.map(
      (record) => record.opportunityId,
    ),
    claimed: [],
    tracked: session.data.tracker,
  };
  const relatedIds = [
    ...new Set([
      ...(activity.saved ?? []),
      ...Object.keys(activity.tracked ?? {}),
    ]),
  ];
  const related = await listPublishedOpportunitiesByIds(relatedIds, {
    includeArchived: true,
  });
  const progress = inferApplicationsFromActivity(
    activity,
    related,
    normalizeStudentProgress({
      milestones: Object.fromEntries(
        Object.entries(session.data.journeyProgress ?? {}).map(
          ([milestoneId, completed]) => [
            milestoneId,
            {
              milestoneId,
              status: completed ? "completed" : "not_started",
              source: "inferred",
              updatedAt: session.data.updatedAt,
            },
          ],
        ),
      ),
    }),
  );
  return explainOpportunityWithAdvisorBrain({
    advisorProfile: createAdvisorProfile({
      profile,
      school,
      activity,
      progress,
    }),
    opportunity: item,
    progress,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, item] = await Promise.all([
    requireCompletedOnboarding(),
    getOpportunity(id),
  ]);
  if (!item) notFound();
  const [related, advisorExplanation, strategyCatalog] = await Promise.all([
    listPublishedOpportunitiesByIds(relatedDiscoverOpportunityIds(item, 3)),
    personalizedExplanation(item, session),
    listPublishedOpportunitiesByIds([...new Set([...strategyOpportunityIds(session.data), item.id])], { includeArchived: true }),
  ]);
  const model = buildOpportunityDetailProjection({
    opportunity: item,
    account: session.data,
    catalog: strategyCatalog,
    related,
    advisorExplanation,
  });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: item.title,
    description: model.summary,
    dateModified: item.last_verified,
    author: { "@type": "Organization", name: "UnlockED" },
    publisher: { "@type": "Organization", name: "UnlockED" },
    mainEntityOfPage: `https://www.unlockededu.com/opportunities/${item.id}`,
  };

  return (
    <>
      <OpportunityViewTracker opportunityId={item.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <OpportunityDetailExperience model={model} />
    </>
  );
}
