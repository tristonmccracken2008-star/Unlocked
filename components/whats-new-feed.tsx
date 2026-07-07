import Link from "next/link";
import { getOpportunityUpdates } from "@/data/opportunity-updates";
import { ArrowIcon } from "./icons";

function formatUpdateDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function WhatsNewFeed({
  limit,
  showViewAll = true,
}: {
  limit?: number;
  showViewAll?: boolean;
}) {
  const updates = getOpportunityUpdates();
  const visibleUpdates = typeof limit === "number" ? updates.slice(0, limit) : updates;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <p className="rule-label text-forest">What&apos;s New</p>
        {showViewAll && updates.length > 0 && (
          <Link href="/updates" className="text-xs font-bold uppercase tracking-wider hover:text-forest">
            View all updates
          </Link>
        )}
      </div>

      {visibleUpdates.length > 0 ? (
        <div className="mt-2">
          {visibleUpdates.map(({ opportunity, date, badge, activity }) => (
            <Link
              key={opportunity.id}
              href={`/opportunities/${opportunity.id}`}
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-ink/15 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-bold tracking-[.12em] ${
                      badge === "NEW"
                        ? "border-gold bg-gold/15 text-ink"
                        : "border-forest/30 bg-forest/5 text-forest"
                    }`}
                  >
                    {badge}
                  </span>
                  <p className="truncate text-sm font-bold group-hover:text-forest">{opportunity.title}</p>
                </div>
                <p className="mt-1 text-xs text-ink/45">
                  {opportunity.type} · {activity}
                </p>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap text-xs text-ink/45">
                <time dateTime={date}>{formatUpdateDate(date)}</time>
                <ArrowIcon />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-3 border border-ink/15 bg-paper px-4 py-5">
          <p className="text-sm font-bold">No recent updates yet.</p>
          <p className="mt-1 text-sm leading-6 text-ink/50">
            New opportunities are added and verified regularly. Check back soon for the latest additions.
          </p>
        </div>
      )}
    </div>
  );
}
