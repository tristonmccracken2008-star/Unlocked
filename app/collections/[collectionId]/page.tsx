import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityCollectionDetail, OpportunityCollectionsUnavailable } from "@/components/opportunity-collections";
import { opportunityCollectionById } from "@/data/opportunity-collections";
import { isProUser } from "@/lib/billing";
import { listPublishedOpportunities } from "@/lib/content-store";
import { buildCollectionDetail } from "@/lib/opportunity-collections";
import { requireCompletedOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ collectionId: string }> }): Promise<Metadata> {
  const collection = opportunityCollectionById((await params).collectionId);
  return collection ? { title: collection.title, description: collection.description, robots: { index: false, follow: false } } : {};
}

export default async function CollectionPage({ params }: { params: Promise<{ collectionId: string }> }) {
  const collection = opportunityCollectionById((await params).collectionId);
  if (!collection) notFound();
  const session = await requireCompletedOnboarding();
  let model: ReturnType<typeof buildCollectionDetail>;
  try {
    const opportunities = await listPublishedOpportunities();
    model = buildCollectionDetail({ collection, account: session.data, opportunities, pro: isProUser(session.data.billing) });
  } catch (error) {
    console.error("[UnlockED Collections] detail composition failed", { collectionId: collection.id, errorType: error instanceof Error ? error.name : "UnknownError" });
    return <OpportunityCollectionsUnavailable />;
  }
  if (!model) notFound();
  return <OpportunityCollectionDetail model={model} />;
}
