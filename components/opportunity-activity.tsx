"use client";

import { useEffect, useRef, useState } from "react";
import type { OpportunityType } from "@/data/opportunities";
import type { OpportunityLifecyclePresentation } from "@/data/opportunity-listing";
import { readStudentActivity, replaceStudentActivity, studentActivityEvent, trackOpportunityView, type TrackedOpportunity } from "@/data/student-activity";
import { authenticatedFetch } from "@/data/authenticated-request";
import { queueJourneySaveRequest } from "@/data/journey-save-request";
import { accountSessionEvent } from "@/data/account-sync";
import { ArrowIcon, BookmarkIcon, CheckIcon } from "./icons";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { recommendationAttributionDetailsFor, rememberRecommendationAttribution, trackProductEvent } from "@/data/product-analytics";
import { cancelJourneySaveMotion, playJourneySaveMotion } from "./journey-save-motion";
import { DelayedPendingLabel } from "./delayed-pending-label";
import styles from "./opportunity-activity.module.css";
import type { JourneySmartDefaults } from "@/lib/journey-add-service";

export function OpportunityViewTracker({ opportunityId }: { opportunityId: string }) {
  useEffect(() => { trackOpportunityView(opportunityId); trackProductEvent("opportunity_view", { opportunityId }); }, [opportunityId]);
  return null;
}

export function OpportunityActivityActions({ opportunityId, type, officialSource, lifecycle, officialActionLabel }: { opportunityId: string; type: OpportunityType; officialSource: string; lifecycle: OpportunityLifecyclePresentation; officialActionLabel?: string }) {
  const [activity, setActivity] = useState(() => readStudentActivity());
  useEffect(() => {
    setActivity(trackOpportunityView(opportunityId));
    const update = () => setActivity(readStudentActivity());
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, [opportunityId]);
  const added = Boolean(activity.tracked?.[opportunityId] || activity.saved.includes(opportunityId));
  const primaryLabel = officialActionLabel ?? (lifecycle.actionable
    ? type === "Benefit" || type === "AI" ? "View official offer" : lifecycle.actionLabel
    : "View official source");
  return <div className="mt-6 space-y-3">
    {lifecycle.actionAllowed ? <a href={officialSource} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 bg-ink px-5 text-center font-bold text-white hover:bg-forest">{primaryLabel} <ArrowIcon/><span className="sr-only">(opens in a new tab)</span></a> : <p className="border border-amber-700/25 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">The official link needs review. UnlockED is not presenting an application action.</p>}
    {added ? <JourneyAddedState opportunityId={opportunityId} className="w-full border border-forest/25 px-4 text-forest" /> : <AddToJourneyButton opportunityId={opportunityId} className="w-full border border-ink/20 px-4 text-ink/65 hover:border-forest hover:text-forest" />}
  </div>;
}

export function AddToJourneyButton({ opportunityId, recommendationId, recommendationCategory, recommendationExposureCount, origin = "discover", pathId, initialAdded = false, className = "" }: { opportunityId: string; recommendationId?: string; recommendationCategory?: string; recommendationExposureCount?: number; origin?: "discover" | "path"; pathId?: string; initialAdded?: boolean; className?: string }) {
  // The first client render must match the server. Local activity is reconciled
  // after hydration by the effect below.
  const [added, setAdded] = useState(initialAdded);
  const [confirmedThisSession, setConfirmedThisSession] = useState(false);
  const [pending, setPending] = useState(false);
  const [firstSave, setFirstSave] = useState(false);
  const [smartDefaults, setSmartDefaults] = useState<JourneySmartDefaults | null>(null);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const update = () => {
      const activity = readStudentActivity();
      setAdded(initialAdded || Boolean(activity.tracked?.[opportunityId] || activity.saved.includes(opportunityId)));
    };
    const reset = () => {
      controllerRef.current?.abort("account-changed");
      cancelJourneySaveMotion();
      pendingRef.current = false;
      setPending(false);
      setFirstSave(false);
      setSmartDefaults(null);
      setConfirmedThisSession(false);
      setError("");
      update();
    };
    update();
    window.addEventListener(studentActivityEvent, update);
    window.addEventListener(accountSessionEvent, reset);
    return () => {
      controllerRef.current?.abort("unmounted");
      window.removeEventListener(studentActivityEvent, update);
      window.removeEventListener(accountSessionEvent, reset);
    };
  }, [opportunityId, initialAdded]);

  async function add() {
    if (pendingRef.current || added) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    controllerRef.current = controller;
    let timeout: number | undefined;
    const remembered = recommendationAttributionDetailsFor(opportunityId);
    const attribution = recommendationId ?? remembered?.recommendationId;
    const category = recommendationCategory ?? remembered?.category;
    const exposureCount = recommendationExposureCount ?? remembered?.exposureCount;
    const source = attribution ? "for_you" : origin;
    try {
      const response = await queueJourneySaveRequest(async () => {
        timeout = window.setTimeout(() => controller.abort("timeout"), 8_000);
        try {
          return await authenticatedFetch("/api/journey/add", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              opportunityId,
              source,
              idempotencyKey: `journey-add:${crypto.randomUUID()}`,
            }),
          });
        } finally {
          if (timeout !== undefined) window.clearTimeout(timeout);
        }
      }, controller.signal);
      const body = await response.json().catch(() => null) as { ok?: boolean; duplicate?: boolean; firstSave?: boolean; record?: TrackedOpportunity; defaults?: JourneySmartDefaults; error?: string } | null;
      if (!response.ok || !body?.ok || !body.record) {
        setError(response.status === 401 ? "Sign in again to add this opportunity." : response.status === 423 ? "Another Journey update is still saving. Try again." : body?.error || "We couldn’t add this opportunity. Try again.");
        return;
      }
      const activity = readStudentActivity();
      activity.tracked = { ...(activity.tracked ?? {}), [opportunityId]: body.record };
      activity.saved = [...new Set([...activity.saved, opportunityId])];
      replaceStudentActivity(activity);
      if (!body.duplicate) playJourneySaveMotion(buttonRef.current);
      pendingRef.current = false;
      setPending(false);
      setAdded(true);
      setConfirmedThisSession(!body.duplicate);
      setFirstSave(Boolean(body.firstSave));
      setSmartDefaults(body.defaults ?? null);
      trackProductEvent("opportunity_added_to_journey", { opportunityId });
      if (source === "path" && pathId) trackProductEvent(productIntelligenceEvents.pathToJourney, { opportunityId, pathId });
      if (attribution) {
        rememberRecommendationAttribution(opportunityId, attribution, category, exposureCount);
        trackProductEvent(productIntelligenceEvents.recommendationSaved, { opportunityId, recommendationId: attribution, category, exposureCount });
      }
    } catch {
      if (controller.signal.reason === "account-changed" || controller.signal.reason === "unmounted") return;
      setError(controller.signal.reason === "timeout" ? "Saving took too long. Try again." : "We couldn’t reach UnlockED. Try again.");
    } finally {
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
      pendingRef.current = false;
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") setPending(false);
    }
  }

  const setupSummary = smartDefaults ? smartDefaultSummary(smartDefaults) : "";
  if (added) return <div className="grid gap-2">
    <JourneyAddedState className={className} confirmed={confirmedThisSession} opportunityId={opportunityId} />
    {confirmedThisSession ? <p className={styles.setupSummary} role="status">Added to your Journey.</p> : null}
    {setupSummary ? <p className={styles.setupSummary}>{setupSummary}</p> : firstSave ? <p className={styles.setupSummary}>Your Journey is ready. Record progress only when something changes.</p> : null}
  </div>;
  return <div className="grid gap-2">
    <button ref={buttonRef} type="button" onClick={() => void add()} disabled={pending} aria-busy={pending ? "true" : undefined} data-action-state={error ? "error" : pending ? "loading" : "idle"} data-journey-save-state={error ? "error" : pending ? "loading" : "idle"} data-journey-save-opportunity={opportunityId} aria-describedby={error ? `journey-add-error-${opportunityId}` : undefined} className={`${styles.saveButton} inline-flex min-h-11 min-w-[11rem] items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider ${className}`}>
      <span className={styles.buttonIcon} aria-hidden="true">{error ? <svg className={styles.errorIcon} viewBox="0 0 18 18" fill="none"><path d="M5.2 5.5A5.2 5.2 0 1 1 4 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M2.8 6.2 5.5 5.5l-.7-2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> : <BookmarkIcon className={styles.saveIcon}/>}</span>
      <DelayedPendingLabel pending={pending} idle={error ? "Try again" : "Add to Journey"} pendingLabel="Adding to Journey…" />
    </button>
    {error ? <p id={`journey-add-error-${opportunityId}`} role="alert" data-inline-feedback="" data-state="error" className={`${styles.error} max-w-sm text-xs font-bold leading-5 text-red-700`}>{error}</p> : null}
  </div>;
}

function smartDefaultSummary(defaults: JourneySmartDefaults) {
  const details: string[] = [];
  if (defaults.officialDeadline) details.push(`Official deadline added · ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${defaults.officialDeadline}T12:00:00.000Z`))}`);
  if (defaults.verifiedRequirementCount) details.push(`${defaults.verifiedRequirementCount} verified ${defaults.verifiedRequirementCount === 1 ? "requirement" : "requirements"} ready`);
  if (defaults.deadlineReminderOffsets.length) details.push("Deadline reminders follow your preferences");
  return details.join(" · ");
}

function JourneyAddedState({ className = "", confirmed = false, opportunityId }: { className?: string; confirmed?: boolean; opportunityId: string }) {
  return <div className={styles.addedGroup} data-confirmed={confirmed ? "true" : "false"}><span role="status" aria-live="polite" data-action-state="success" data-journey-save-confirmed={confirmed ? "true" : undefined} className={`${styles.addedState} unlocked-save-confirmation inline-flex min-h-11 min-w-[11rem] items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider ${className}`}><span className={styles.addedIcon} data-confirmed={confirmed ? "true" : "false"} aria-hidden="true"><BookmarkIcon className={styles.addedBookmark}/><CheckIcon className={styles.addedCheck}/></span><span className={styles.addedLabel}>Added to Journey</span></span><LinkToJourney opportunityId={opportunityId} /></div>;
}

function LinkToJourney({ opportunityId }: { opportunityId: string }) {
  return <a href={`/#journey-record-${encodeURIComponent(opportunityId)}`} className={styles.journeyLink}>View in Journey</a>;
}
