"use client";

import { useEffect, useState } from "react";
import type { OpportunityType } from "@/data/opportunities";
import { markOpportunityClaimed, readStudentActivity, studentActivityEvent, toggleSavedOpportunity, trackOpportunityView } from "@/data/student-activity";
import { ArrowIcon, CheckIcon } from "./icons";
import { trackProductEvent } from "@/data/product-analytics";

export function OpportunityViewTracker({ opportunityId }: { opportunityId: string }) {
  useEffect(() => { trackOpportunityView(opportunityId); trackProductEvent("opportunity_view", { opportunityId }); }, [opportunityId]);
  return null;
}

export function OpportunityActivityActions({ opportunityId, type, officialSource }: { opportunityId: string; type: OpportunityType; officialSource: string }) {
  const [activity, setActivity] = useState(() => ({ viewed: [] as string[], saved: [] as string[], claimed: [] as string[] }));
  useEffect(() => {
    setActivity(trackOpportunityView(opportunityId));
    const update = () => setActivity(readStudentActivity());
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, [opportunityId]);
  const saved = activity.saved.includes(opportunityId);
  const claimed = activity.claimed.includes(opportunityId);
  const claimable = type === "AI" || type === "Benefit";
  const primaryLabel = type === "Benefit" || type === "AI" ? "Claim on official site" : type === "Scholarship" ? "Apply on official site" : type === "Career" || type === "Research" ? "View application" : "Learn more";
  return <div className="mt-6 space-y-3">
    <a href={officialSource} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 bg-ink px-5 text-center font-bold text-white hover:bg-forest">{primaryLabel} <ArrowIcon/></a>
    <button type="button" onClick={()=>{const next=toggleSavedOpportunity(opportunityId);setActivity(next);if(next.saved.includes(opportunityId))trackProductEvent("opportunity_saved",{opportunityId})}} className="flex min-h-11 w-full items-center justify-center border border-white/35 px-4 text-xs font-bold uppercase tracking-wider text-white">{saved?<><CheckIcon className="h-4 w-4"/> Saved</>:"Save opportunity"}</button>
    {claimable&&<button type="button" onClick={()=>setActivity(markOpportunityClaimed(opportunityId))} className="flex min-h-11 w-full items-center justify-center border border-white/35 px-4 text-xs font-bold uppercase tracking-wider text-white">{claimed?<><CheckIcon className="h-4 w-4"/> Claimed</>:"Mark as claimed"}</button>}
  </div>;
}

export function SaveOpportunityButton({ opportunityId, className = "" }: { opportunityId: string; className?: string }) {
  const [saved,setSaved]=useState(false);
  useEffect(()=>{const update=()=>setSaved(readStudentActivity().saved.includes(opportunityId));update();window.addEventListener(studentActivityEvent,update);return()=>window.removeEventListener(studentActivityEvent,update)},[opportunityId]);
  return <button type="button" onClick={()=>{toggleSavedOpportunity(opportunityId);const isSaved=readStudentActivity().saved.includes(opportunityId);setSaved(isSaved);if(isSaved)trackProductEvent("opportunity_saved",{opportunityId})}} className={`inline-flex min-h-11 items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider ${className}`}>{saved?<><CheckIcon className="h-4 w-4"/> Saved</>:"Save"}</button>;
}
