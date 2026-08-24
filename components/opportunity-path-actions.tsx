"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { AddToJourneyButton } from "./opportunity-activity";
import { BookmarkIcon, CheckIcon } from "./icons";
import styles from "./opportunity-paths.module.css";

export function PathAnalytics({ pathId, source = "paths" }: { pathId: string; source?: string }) {
  useEffect(() => { trackProductEvent(productIntelligenceEvents.pathOpened, { pathId, source }); }, [pathId, source]);
  return null;
}

export function PathFollowButton({ pathId, initialFollowing }: { pathId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    if (pending) return;
    const next = !following;
    setPending(true); setError("");
    try {
      const response = await authenticatedFetch("/api/paths/follow", { method: "PUT", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pathId, following: next }) });
      const body = await response.json().catch(() => null) as { following?: boolean; error?: string } | null;
      if (!response.ok || typeof body?.following !== "boolean") throw new Error(response.status === 401 ? "Sign in again to update this Path." : body?.error ?? "Path could not be updated.");
      setFollowing(body.following);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Path could not be updated."); }
    finally { setPending(false); }
  }
  return <div className={styles.followWrap}>
    <button type="button" className={styles.followButton} aria-pressed={following} disabled={pending} onClick={() => void toggle()}>
      {following ? <CheckIcon /> : <BookmarkIcon />}{pending ? "Updating…" : following ? "Following" : "Follow path"}
    </button>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}

export function PathOpportunityActions({ pathId, opportunityId, pro, initialWatched, initialAdded }: { pathId: string; opportunityId: string; pro: boolean; initialWatched: boolean; initialAdded: boolean }) {
  const [watched, setWatched] = useState(initialWatched);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function toggleWatch() {
    if (pending || !pro) return;
    setPending(true); setError("");
    const next = !watched;
    try {
      const response = await authenticatedFetch("/api/advisor/watch", { method: "PUT", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId, watching: next }) });
      const body = await response.json().catch(() => null) as { watched?: boolean; error?: string } | null;
      if (!response.ok || typeof body?.watched !== "boolean") throw new Error(response.status === 403 ? "Watch is available with Pro." : body?.error ?? "Watch could not be updated.");
      setWatched(body.watched);
      trackProductEvent(productIntelligenceEvents.pathToWatch, { pathId, opportunityId, action: next ? "added" : "removed" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Watch could not be updated."); }
    finally { setPending(false); }
  }
  return <div className={styles.opportunityActions}>
    <AddToJourneyButton opportunityId={opportunityId} origin="path" pathId={pathId} initialAdded={initialAdded} className={styles.journeyAction} />
    {pro && !initialAdded ? <button type="button" className={styles.watchButton} aria-pressed={watched} disabled={pending} onClick={() => void toggleWatch()}>{pending ? "Updating…" : watched ? "Watching" : "Watch"}</button> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}

export function PathOpportunityLink({ pathId, opportunityId, href, children, className = "" }: { pathId: string; opportunityId: string; href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={className} onClick={() => trackProductEvent(productIntelligenceEvents.pathOpportunityOpened, { pathId, opportunityId })}>{children}</Link>;
}

export function PathDiscoverLink({ pathId, category, href, children, className = "" }: { pathId: string; category: string; href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={className} onClick={() => trackProductEvent(productIntelligenceEvents.pathToDiscover, { pathId, category })}>{children}</Link>;
}
