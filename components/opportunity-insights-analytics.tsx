"use client";

import { useEffect } from "react";
import { trackProductEvent } from "@/data/product-analytics";

export function OpportunityInsightsAnalytics() {
  useEffect(() => { trackProductEvent("opportunity_insights_opened_v1", { section: "insights" }); }, []);
  return null;
}
