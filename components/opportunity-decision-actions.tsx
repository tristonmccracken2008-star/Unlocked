"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import { readStudentActivity, studentActivityEvent } from "@/data/student-activity";
import type { OpportunityPrimaryAction } from "@/lib/opportunity-detail-projection";
import { AddToJourneyButton } from "./opportunity-activity";
import { BookmarkIcon, CheckIcon } from "./icons";

export function OpportunityDecisionActions({
  opportunityId,
  action,
  initialAdded,
  initialWatched,
  pro,
  officialSource,
  officialLabel,
  officialActionAllowed,
}: {
  opportunityId: string;
  action: OpportunityPrimaryAction;
  initialAdded: boolean;
  initialWatched: boolean;
  pro: boolean;
  officialSource: string;
  officialLabel: string;
  officialActionAllowed: boolean;
}) {
  const [watched, setWatched] = useState(initialWatched);
  const [journeyAdded, setJourneyAdded] = useState(initialAdded);
  const [watchPending, setWatchPending] = useState(false);
  const [watchError, setWatchError] = useState("");

  useEffect(() => {
    const update = () => {
      const activity = readStudentActivity();
      setJourneyAdded(initialAdded || Boolean(activity.tracked?.[opportunityId] || activity.saved.includes(opportunityId)));
    };
    update();
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, [initialAdded, opportunityId]);

  async function toggleWatch() {
    if (watchPending || !pro || journeyAdded) return;
    setWatchPending(true);
    setWatchError("");
    try {
      const response = await authenticatedFetch("/api/advisor/watch", {
        method: "PUT",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, watching: !watched }),
      });
      const body = (await response.json().catch(() => null)) as {
        watched?: boolean;
        error?: string;
      } | null;
      if (!response.ok || typeof body?.watched !== "boolean")
        throw new Error(body?.error ?? "Watch could not be updated.");
      setWatched(body.watched);
    } catch (error) {
      setWatchError(
        error instanceof Error ? error.message : "Watch could not be updated.",
      );
    } finally {
      setWatchPending(false);
    }
  }

  return (
    <div className="grid gap-3" data-opportunity-decision-actions="">
      {action.kind === "add_to_journey" ? (
        <AddToJourneyButton
          opportunityId={opportunityId}
          initialAdded={initialAdded}
          className="w-full rounded-lg bg-forest px-5 text-white hover:bg-ink"
        />
      ) : (
        <Link
          href={
            action.href ??
            `/#journey-record-${encodeURIComponent(opportunityId)}`
          }
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-forest px-5 text-sm font-bold text-white transition-colors hover:bg-ink"
        >
          {action.label}
        </Link>
      )}

      {officialActionAllowed ? (
        <a
          href={officialSource}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/15 px-5 text-sm font-bold text-ink/70 transition-colors hover:border-forest hover:text-forest"
        >
          {officialLabel}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <p className="rounded-lg border border-amber-700/20 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          The provider link is not verified for a current application. Review
          the source before acting.
        </p>
      )}

      {pro && !journeyAdded ? (
        <button
          type="button"
          aria-pressed={watched}
          disabled={watchPending}
          onClick={() => void toggleWatch()}
          className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-forest disabled:opacity-60"
        >
          {watched ? <CheckIcon /> : <BookmarkIcon />}
          {watchPending
            ? "Updating…"
            : watched
              ? "Watching for changes"
              : "Watch for changes"}
        </button>
      ) : null}
      {pro && !journeyAdded ? (
        <p className="text-center text-xs leading-5 text-ink/45">
          Watch alerts you to verified changes. Journey is where you manage
          active progress.
        </p>
      ) : null}
      {watchError ? (
        <p role="alert" className="text-xs font-bold leading-5 text-red-700">
          {watchError}
        </p>
      ) : null}
    </div>
  );
}
