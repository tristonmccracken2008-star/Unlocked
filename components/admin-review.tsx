"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { opportunities, type Opportunity, type VerificationStatus } from "@/data/opportunities";
import { isExpiringSoon, maintenanceStatus, readReviewOverrides, reviewReasons, saveReviewOverride } from "@/data/opportunity-maintenance";

type Queue = "Needs Review" | "Expiring Soon" | "Missing Source" | "Incomplete" | "Recently Verified";
const queues: Queue[] = ["Needs Review", "Expiring Soon", "Missing Source", "Incomplete", "Recently Verified"];

export function AdminReview() {
  const [queue, setQueue] = useState<Queue>("Needs Review");
  const [overrides, setOverrides] = useState(() => readReviewOverrides());
  const now = useMemo(() => new Date(), []);
  const visible = opportunities.filter((item) => {
    const override = overrides[item.id]?.status;
    if (override === "archived") return false;
    const status = override ?? maintenanceStatus(item, now);
    if (queue === "Needs Review") return status === "needs_review";
    if (queue === "Expiring Soon") return isExpiringSoon(item, now);
    if (queue === "Missing Source") return reviewReasons(item, now).includes("Missing official source");
    if (queue === "Incomplete") return status === "incomplete" || !item.contentComplete;
    return status === "verified" && now.getTime() - new Date(`${item.last_verified}T00:00:00Z`).getTime() <= 30 * 86_400_000;
  });
  const act = (item: Opportunity, status: VerificationStatus | "archived") => setOverrides(saveReviewOverride(item.id, status));
  return <div><div className="flex gap-2 overflow-x-auto border-b border-ink/15 pb-4" role="tablist" aria-label="Review queues">{queues.map((item) => <button key={item} role="tab" aria-selected={queue === item} onClick={() => setQueue(item)} className={`min-h-10 shrink-0 px-3 text-xs font-bold uppercase tracking-wider ${queue === item ? "bg-ink text-white" : "border border-ink/15 bg-white text-ink/55"}`}>{item}</button>)}</div><div className="mt-6"><p className="text-sm text-ink/45">{visible.length} {visible.length === 1 ? "listing" : "listings"} in this queue. Review actions are stored in this browser for Version 1.</p>{visible.length ? <div className="mt-4 divide-y divide-ink/10 border-y border-ink/15">{visible.map((item) => <article key={item.id} className="grid gap-5 bg-white py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div><div className="flex flex-wrap gap-3"><span className="rule-label text-forest">{maintenanceStatus(item, now).replaceAll("_", " ")}</span><span className="rule-label text-ink/35">Verified {item.last_verified}</span></div><h2 className="mt-2 font-editorial text-xl font-bold"><Link href={`/opportunities/${item.id}`} className="hover:text-forest">{item.title}</Link></h2><p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/35">{item.organization}</p><p className="mt-3 text-sm leading-6 text-ink/50">{reviewReasons(item, now).join(" · ") || item.reviewer_notes}</p></div><div className="flex flex-wrap gap-2 lg:justify-end">{(["verified", "expired", "incomplete"] as VerificationStatus[]).map((status) => <button key={status} onClick={() => act(item, status)} className="min-h-10 border border-ink/15 px-3 text-xs font-bold capitalize hover:border-forest hover:text-forest">Mark {status.replaceAll("_", " ")}</button>)}<button onClick={() => act(item, "archived")} className="min-h-10 border border-red-700/20 px-3 text-xs font-bold text-red-700">Archive</button></div></article>)}</div> : <div className="mt-8 border-y border-ink/15 py-12 text-center"><h2 className="font-editorial text-2xl font-bold">Queue clear</h2><p className="mt-2 text-sm text-ink/45">No opportunities currently meet this review condition.</p></div>}</div></div>;
}
