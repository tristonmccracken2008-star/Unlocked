import type { Metadata } from "next";
import { OpportunityPassportWorkspace } from "@/components/opportunity-passport";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildPassportView } from "@/lib/passport";
import { normalizeOpportunityPassport } from "@/data/passport";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Opportunity Passport", description: "Your private, living record of what you have explored, built, and accomplished.", robots: { index: false, follow: false } };

export default async function PassportPage() {
  const session = await requireCompletedOnboarding();
  const config = normalizeOpportunityPassport(session.data.passport);
  const ids = [...new Set([...Object.keys(session.data.tracker ?? {}), ...Object.keys(session.data.activity?.tracked ?? {}), ...Object.values(session.data.accomplishments ?? {}).flatMap((item) => item.canonicalOpportunityId ? [item.canonicalOpportunityId] : []), ...config.collections.flatMap((item) => item.opportunityIds)])];
  const opportunities = await listPublishedOpportunitiesByIds(ids, { includeArchived: true });
  const model = buildPassportView({ user: session.user, account: session.data, opportunities });
  return <OpportunityPassportWorkspace initialModel={model} initialConfig={config} opportunityChoices={opportunities.map((item) => ({ id: item.id, title: item.title, organization: item.organization, type: item.type }))} />;
}
