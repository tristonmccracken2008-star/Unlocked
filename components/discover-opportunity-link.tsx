"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackProductEvent } from "@/data/product-analytics";
import { productIntelligenceEvents } from "@/lib/analytics-types";

export function DiscoverOpportunityLink({ href, opportunityId, category, className, children }: { href: string; opportunityId: string; category: string; className: string; children: ReactNode }) {
  return <Link
    href={href}
    className={className}
    onClick={() => trackProductEvent(productIntelligenceEvents.discoverResultOpened, {
      opportunityId,
      category,
      source: "discover",
    })}
  >
    {children}
  </Link>;
}
