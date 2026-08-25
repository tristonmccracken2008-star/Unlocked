"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { AddToJourneyButton } from "./opportunity-activity";
import { BookmarkIcon, CheckIcon } from "./icons";
import styles from "./opportunity-collections.module.css";

export function CollectionsAnalytics({ collectionId }: { collectionId?: string }) {
  useEffect(() => {
    trackProductEvent(collectionId ? productIntelligenceEvents.collectionOpened : productIntelligenceEvents.collectionsOpened, collectionId ? { section: collectionId } : {});
  }, [collectionId]);
  return null;
}

export function CollectionLink({ href, event, collectionId, pathId, className = "", children }: {
  href: string;
  event: "collection" | "discover" | "path" | "opportunity";
  collectionId?: string;
  pathId?: string;
  className?: string;
  children: ReactNode;
}) {
  function track() {
    if (event === "collection") trackProductEvent(productIntelligenceEvents.collectionOpened, { section: collectionId, source: "collections" });
    if (event === "discover") trackProductEvent(productIntelligenceEvents.collectionToDiscover, { section: collectionId });
    if (event === "path") trackProductEvent(productIntelligenceEvents.collectionToPath, { section: collectionId, pathId });
    if (event === "opportunity") trackProductEvent(productIntelligenceEvents.collectionOpened, { section: collectionId, source: "opportunity" });
  }
  return <Link href={href} className={className} onClick={track}>{children}</Link>;
}

export function CollectionOpportunityActions({ collectionId, opportunityId, pro, initialWatched, initialAdded }: {
  collectionId: string;
  opportunityId: string;
  pro: boolean;
  initialWatched: boolean;
  initialAdded: boolean;
}) {
  const [watched, setWatched] = useState(initialWatched);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function toggleWatch() {
    if (!pro || pending || initialAdded) return;
    setPending(true);
    setError("");
    const next = !watched;
    try {
      const response = await authenticatedFetch("/api/advisor/watch", {
        method: "PUT", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, watching: next }),
      });
      const body = await response.json().catch(() => null) as { watched?: boolean; error?: string } | null;
      if (!response.ok || typeof body?.watched !== "boolean") throw new Error(response.status === 403 ? "Watch is available with Pro." : body?.error ?? "Watch could not be updated.");
      setWatched(body.watched);
      trackProductEvent(productIntelligenceEvents.collectionToWatch, { opportunityId, section: collectionId, action: next ? "added" : "removed" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Watch could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return <div className={styles.actions}>
    <AddToJourneyButton opportunityId={opportunityId} origin="collection" collectionId={collectionId} initialAdded={initialAdded} className={styles.journeyAction} />
    {pro && !initialAdded ? <button type="button" className={styles.watchAction} aria-pressed={watched} disabled={pending} onClick={() => void toggleWatch()}>{watched ? <CheckIcon /> : <BookmarkIcon />}{pending ? "Updating…" : watched ? "Watching" : "Watch"}</button> : null}
    {error ? <p role="alert" className={styles.actionError}>{error}</p> : null}
  </div>;
}
