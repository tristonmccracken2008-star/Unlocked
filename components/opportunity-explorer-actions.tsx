"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { AddToJourneyButton } from "./opportunity-activity";
import { BookmarkIcon, CheckIcon } from "./icons";
import styles from "./opportunity-explorer.module.css";

export function ExplorerAnalytics({ areaId }: { areaId?: string }) {
  useEffect(() => {
    trackProductEvent(areaId ? productIntelligenceEvents.explorerAreaOpened : productIntelligenceEvents.explorerOpened, areaId ? { section: areaId, source: "explorer" } : {});
  }, [areaId]);
  return null;
}

export function ExplorerLink({ href, event, areaId, typeId, pathId, opportunityId, className = "", children }: {
  href: string;
  event: "area" | "type" | "discover" | "path" | "serendipity" | "opportunity";
  areaId?: string;
  typeId?: string;
  pathId?: string;
  opportunityId?: string;
  className?: string;
  children: ReactNode;
}) {
  function track() {
    if (event === "area") trackProductEvent(productIntelligenceEvents.explorerAreaOpened, { section: areaId, source: "landing" });
    if (event === "type") trackProductEvent(productIntelligenceEvents.explorerTypeOpened, { category: typeId, source: "landing" });
    if (event === "discover") trackProductEvent(productIntelligenceEvents.explorerToDiscover, { section: areaId, category: typeId });
    if (event === "path") trackProductEvent(productIntelligenceEvents.explorerToPath, { section: areaId, pathId });
    if (event === "serendipity") trackProductEvent(productIntelligenceEvents.explorerSerendipityOpened, { section: areaId });
    if (event === "opportunity") trackProductEvent(productIntelligenceEvents.explorerAreaOpened, { section: areaId, source: opportunityId ? "opportunity" : "landscape" });
  }
  return <Link href={href} className={className} onClick={track}>{children}</Link>;
}

export function ExplorerOpportunityActions({ areaId, opportunityId, pro, initialWatched, initialAdded }: { areaId: string; opportunityId: string; pro: boolean; initialWatched: boolean; initialAdded: boolean }) {
  const [watched, setWatched] = useState(initialWatched);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function toggleWatch() {
    if (!pro || pending || initialAdded) return;
    setPending(true);
    setError("");
    const next = !watched;
    try {
      const response = await authenticatedFetch("/api/advisor/watch", { method: "PUT", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId, watching: next }) });
      const body = await response.json().catch(() => null) as { watched?: boolean; error?: string } | null;
      if (!response.ok || typeof body?.watched !== "boolean") throw new Error(response.status === 403 ? "Watch is available with Pro." : body?.error ?? "Watch could not be updated.");
      setWatched(body.watched);
      trackProductEvent(productIntelligenceEvents.explorerToWatch, { opportunityId, action: next ? "added" : "removed", section: areaId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Watch could not be updated.");
    } finally {
      setPending(false);
    }
  }
  return <div className={styles.opportunityActions}>
    <AddToJourneyButton opportunityId={opportunityId} origin="explorer" explorerAreaId={areaId} initialAdded={initialAdded} className={styles.journeyAction} />
    {pro && !initialAdded ? <button type="button" className={styles.watchAction} aria-pressed={watched} disabled={pending} onClick={() => void toggleWatch()}>{watched ? <CheckIcon /> : <BookmarkIcon />}{pending ? "Updating…" : watched ? "Watching" : "Watch"}</button> : null}
    {error ? <p role="alert" className={styles.actionError}>{error}</p> : null}
  </div>;
}
