"use client";

import { useEffect, useState } from "react";
import type { OpportunityType } from "@/data/opportunities";
import { readStudentActivity, saveOpportunity, studentActivityEvent, trackOpportunityView } from "@/data/student-activity";
import { ArrowIcon, CheckIcon } from "./icons";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { recommendationAttributionFor, rememberRecommendationAttribution, trackProductEvent } from "@/data/product-analytics";

export function OpportunityViewTracker({ opportunityId }: { opportunityId: string }) {
  useEffect(() => { trackOpportunityView(opportunityId); trackProductEvent("opportunity_view", { opportunityId }); }, [opportunityId]);
  return null;
}

export function OpportunityActivityActions({ opportunityId, type, officialSource }: { opportunityId: string; type: OpportunityType; officialSource: string }) {
  const [activity, setActivity] = useState(() => readStudentActivity());
  useEffect(() => {
    setActivity(trackOpportunityView(opportunityId));
    const update = () => setActivity(readStudentActivity());
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, [opportunityId]);
  const added = Boolean(activity.tracked?.[opportunityId] || activity.saved.includes(opportunityId));
  const primaryLabel = type === "Benefit" || type === "AI" ? "Claim on official site" : type === "Scholarship" ? "Apply on official site" : type === "Career" || type === "Research" ? "View application" : "Learn more";
  return <div className="mt-6 space-y-3">
    <a href={officialSource} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 bg-ink px-5 text-center font-bold text-white hover:bg-forest">{primaryLabel} <ArrowIcon/></a>
    {added ? <JourneyAddedState className="w-full border border-forest/25 px-4 text-forest" /> : <AddToJourneyButton opportunityId={opportunityId} className="w-full border border-ink/20 px-4 text-ink/65 hover:border-forest hover:text-forest" />}
  </div>;
}

export function AddToJourneyButton({ opportunityId, recommendationId, className = "" }: { opportunityId: string; recommendationId?: string; className?: string }) {
  const [added,setAdded]=useState(false);
  useEffect(()=>{const update=()=>{const activity=readStudentActivity();setAdded(Boolean(activity.tracked?.[opportunityId]||activity.saved.includes(opportunityId)))};update();window.addEventListener(studentActivityEvent,update);return()=>window.removeEventListener(studentActivityEvent,update)},[opportunityId]);
  if (added) return <JourneyAddedState className={className} />;
  return <button type="button" onClick={()=>{
    saveOpportunity(opportunityId,"Saved");
    setAdded(true);
    trackProductEvent("opportunity_added_to_journey",{opportunityId});
    const attribution = recommendationId ?? recommendationAttributionFor(opportunityId);
    trackProductEvent(productIntelligenceEvents.journeyOpportunityAdded, { opportunityId, source: attribution ? "for_you" : "discover" });
    if (attribution) {
      rememberRecommendationAttribution(opportunityId, attribution);
      trackProductEvent(productIntelligenceEvents.recommendationSaved, { opportunityId, recommendationId: attribution });
    }
  }} className={`inline-flex min-h-11 items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider ${className}`}>Add to Journey</button>;
}

function JourneyAddedState({ className = "" }: { className?: string }) {
  return <span className={`inline-flex min-h-11 items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider ${className}`}><CheckIcon className="h-4 w-4"/> Added to Journey <LinkToJourney /></span>;
}

function LinkToJourney() {
  return <a href="/" className="ml-2 border-b border-current pb-0.5 text-[11px] normal-case tracking-normal">View Journey</a>;
}
