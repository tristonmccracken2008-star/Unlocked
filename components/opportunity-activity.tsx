"use client";

import { useEffect, useRef, useState } from "react";
import type { OpportunityType, VerificationStatus } from "@/data/opportunities";
import { readStudentActivity, replaceStudentActivity, studentActivityEvent, trackOpportunityView, type TrackedOpportunity } from "@/data/student-activity";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent } from "@/data/account-sync";
import { ArrowIcon, CheckIcon } from "./icons";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { recommendationAttributionDetailsFor, rememberRecommendationAttribution, trackProductEvent } from "@/data/product-analytics";

export function OpportunityViewTracker({ opportunityId }: { opportunityId: string }) {
  useEffect(() => { trackOpportunityView(opportunityId); trackProductEvent("opportunity_view", { opportunityId }); }, [opportunityId]);
  return null;
}

export function OpportunityActivityActions({ opportunityId, type, officialSource, verificationStatus }: { opportunityId: string; type: OpportunityType; officialSource: string; verificationStatus?: VerificationStatus }) {
  const [activity, setActivity] = useState(() => readStudentActivity());
  useEffect(() => {
    setActivity(trackOpportunityView(opportunityId));
    const update = () => setActivity(readStudentActivity());
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, [opportunityId]);
  const added = Boolean(activity.tracked?.[opportunityId] || activity.saved.includes(opportunityId));
  const unavailable = verificationStatus ? ["temporarily_closed", "expired", "broken_source"].includes(verificationStatus) : false;
  const primaryLabel = unavailable ? "Check current status" : type === "Benefit" || type === "AI" ? "Claim on official site" : type === "Scholarship" ? "Apply on official site" : type === "Career" || type === "Research" ? "View application" : "Learn more";
  return <div className="mt-6 space-y-3">
    <a href={officialSource} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 bg-ink px-5 text-center font-bold text-white hover:bg-forest">{primaryLabel} <ArrowIcon/></a>
    {added ? <JourneyAddedState className="w-full border border-forest/25 px-4 text-forest" /> : <AddToJourneyButton opportunityId={opportunityId} className="w-full border border-ink/20 px-4 text-ink/65 hover:border-forest hover:text-forest" />}
  </div>;
}

export function AddToJourneyButton({ opportunityId, recommendationId, recommendationCategory, recommendationExposureCount, className = "" }: { opportunityId: string; recommendationId?: string; recommendationCategory?: string; recommendationExposureCount?: number; className?: string }) {
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const [firstSave, setFirstSave] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  useEffect(() => {
    const update = () => {
      const activity = readStudentActivity();
      setAdded(Boolean(activity.tracked?.[opportunityId] || activity.saved.includes(opportunityId)));
    };
    const reset = () => {
      controllerRef.current?.abort("account-changed");
      pendingRef.current = false;
      setPending(false);
      setFirstSave(false);
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
  }, [opportunityId]);

  async function add() {
    if (pendingRef.current || added) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 8_000);
    const remembered = recommendationAttributionDetailsFor(opportunityId);
    const attribution = recommendationId ?? remembered?.recommendationId;
    const category = recommendationCategory ?? remembered?.category;
    const exposureCount = recommendationExposureCount ?? remembered?.exposureCount;
    const source = attribution ? "for_you" : "discover";
    try {
      const response = await authenticatedFetch("/api/journey/add", {
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
      const body = await response.json().catch(() => null) as { ok?: boolean; duplicate?: boolean; firstSave?: boolean; record?: TrackedOpportunity; error?: string } | null;
      if (!response.ok || !body?.ok || !body.record) {
        setError(response.status === 401 ? "Sign in again to add this opportunity." : response.status === 423 ? "Another Journey update is still saving. Try again." : body?.error || "We couldn’t add this opportunity. Try again.");
        return;
      }
      const activity = readStudentActivity();
      activity.tracked = { ...(activity.tracked ?? {}), [opportunityId]: body.record };
      activity.saved = [...new Set([...activity.saved, opportunityId])];
      replaceStudentActivity(activity);
      setAdded(true);
      setFirstSave(Boolean(body.firstSave));
      trackProductEvent("opportunity_added_to_journey", { opportunityId });
      if (attribution) {
        rememberRecommendationAttribution(opportunityId, attribution, category, exposureCount);
        trackProductEvent(productIntelligenceEvents.recommendationSaved, { opportunityId, recommendationId: attribution, category, exposureCount });
      }
    } catch {
      if (controller.signal.reason === "account-changed" || controller.signal.reason === "unmounted") return;
      setError(controller.signal.reason === "timeout" ? "Saving took too long. Try again." : "We couldn’t reach UnlockED. Try again.");
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
      pendingRef.current = false;
      if (controller.signal.reason !== "account-changed" && controller.signal.reason !== "unmounted") setPending(false);
    }
  }

  if (added) return <div className="grid gap-2"><JourneyAddedState className={className} />{firstSave ? <p className="max-w-sm text-xs font-medium leading-5 text-ink/55" role="status">Saved to your Journey. Return there when you have a real update, such as starting or submitting an application.</p> : null}</div>;
  return <div className="grid gap-2">
    <button type="button" onClick={() => void add()} disabled={pending} aria-describedby={error ? `journey-add-error-${opportunityId}` : undefined} className={`inline-flex min-h-11 items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:cursor-wait disabled:opacity-60 ${className}`}>{pending ? "Adding…" : "Add to Journey"}</button>
    {error ? <p id={`journey-add-error-${opportunityId}`} role="alert" className="max-w-sm text-xs font-bold leading-5 text-red-700">{error}</p> : null}
  </div>;
}

function JourneyAddedState({ className = "" }: { className?: string }) {
  return <span className={`inline-flex min-h-11 items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider ${className}`}><CheckIcon className="h-4 w-4"/> Added to Journey <LinkToJourney /></span>;
}

function LinkToJourney() {
  return <a href="/" className="ml-2 border-b border-current pb-0.5 text-[11px] normal-case tracking-normal">View Journey</a>;
}
