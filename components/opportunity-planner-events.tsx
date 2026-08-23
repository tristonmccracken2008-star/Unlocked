"use client";

import { useEffect } from "react";
import { trackProductEvent } from "@/data/product-analytics";

export function OpportunityPlannerEvents() {
  useEffect(() => { trackProductEvent("planner_viewed_v1"); }, []);
  return null;
}

export function PlannerTrackedLink({ href, destination, category, className, children }: {
  href: string;
  destination: "journey" | "for_you" | "discover" | "calendar";
  category?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return <a href={href} className={className} onClick={() => trackProductEvent("planner_handoff_v1", { action: destination, category: category?.toLocaleLowerCase().replaceAll(" ", "_") })}>{children}</a>;
}

export function PlannerMonthDisclosure({ monthKey, className, children }: { monthKey: string; className?: string; children: React.ReactNode }) {
  return <details className={className} onToggle={(event) => {
    if (event.currentTarget.open) trackProductEvent("planner_month_opened_v1", { section: monthKey });
  }}>{children}</details>;
}
