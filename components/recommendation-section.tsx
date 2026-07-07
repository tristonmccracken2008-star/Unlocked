import Link from "next/link";
import type { School } from "@/data/seed";
import { deadlineLabel } from "@/data/opportunities";
import { expiringSoonOpportunities, hiddenGemOpportunities, recentlyAddedOpportunities, recommendedForYou, trendingOpportunities, type RecommendationProfile, type ScoredOpportunity } from "@/data/recommendations";
import { OpportunityCard } from "./opportunity-card";
import { ArrowIcon } from "./icons";

type Props = { school: School; major: string; year: string; interests?: string; careerGoals?: string };

function CompactList({ items, empty }: { items: ScoredOpportunity[]; empty: string }) {
  if (!items.length) return <p className="border-t border-ink/15 py-6 text-sm leading-6 text-ink/45">{empty}</p>;
  return <div>{items.map(({ opportunity }) => <Link key={opportunity.id} href={`/opportunities/${opportunity.id}`} className="group grid grid-cols-[1fr_auto] gap-4 border-t border-ink/15 py-4">
    <div><p className="rule-label text-forest">{opportunity.type} · {opportunity.category}</p><h3 className="mt-1 font-editorial text-lg font-bold group-hover:text-forest">{opportunity.title}</h3><p className="mt-1 text-xs text-ink/40">{opportunity.organization}</p></div>
    <div className="text-right"><p className="text-xs font-bold text-ink/55">{opportunity.application_deadline ? deadlineLabel(opportunity) : opportunity.school_scope}</p><ArrowIcon className="ml-auto mt-3" /></div>
  </Link>)}</div>;
}

export function RecommendationSection({ school, major, year, interests, careerGoals }: Props) {
  const profile: RecommendationProfile = { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major, academicYear: year, interests, careerGoals };
  const recommended = recommendedForYou(profile, 10);
  const trending = trendingOpportunities(profile);
  const hidden = hiddenGemOpportunities(profile);
  const expiring = expiringSoonOpportunities(profile);
  const recent = recentlyAddedOpportunities(profile);

  return <section className="border-b-2 border-ink bg-paper px-5 py-10 sm:px-8">
    <div className="border-b-2 border-ink pb-4"><p className="rule-label text-forest">Personalized opportunity engine</p><h2 className="mt-2 font-editorial text-3xl font-bold">Recommended For You</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-ink/50">Ranked automatically from your school, major, year, interests, career goals, location, and the fields in the opportunity database.</p></div>
    <div className="border-b-2 border-ink">{recommended.map(({ opportunity, reasons }) => <OpportunityCard key={opportunity.id} opportunity={opportunity} reasons={reasons} />)}</div>
    <div className="mt-10 grid border-t-2 border-ink lg:grid-cols-2">
      <div className="border-b border-ink/20 py-6 lg:border-r lg:pr-8"><p className="rule-label text-forest">Trending Opportunities</p><h3 className="mt-2 font-editorial text-2xl font-bold">High-signal opportunities</h3><CompactList items={trending} empty="No trending opportunities are available." /></div>
      <div className="border-b border-ink/20 py-6 lg:pl-8"><p className="rule-label text-forest">Hidden Gems</p><h3 className="mt-2 font-editorial text-2xl font-bold">Strong matches beyond featured listings</h3><CompactList items={hidden} empty="No verified hidden gems match this profile yet." /></div>
      <div className="border-b border-ink/20 py-6 lg:border-r lg:pr-8"><p className="rule-label text-forest">Expiring Soon</p><h3 className="mt-2 font-editorial text-2xl font-bold">Deadlines in the next 60 days</h3><CompactList items={expiring} empty="No published deadlines expire in the next 60 days." /></div>
      <div className="border-b border-ink/20 py-6 lg:pl-8"><p className="rule-label text-forest">Recently Added</p><h3 className="mt-2 font-editorial text-2xl font-bold">New to the database</h3><CompactList items={recent} empty="No recently added opportunities are available." /></div>
    </div>
  </section>;
}
