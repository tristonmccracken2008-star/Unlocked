"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackProductEvent } from "@/data/product-analytics";

export function ProductAnalytics() {
  const pathname = usePathname();
  useEffect(() => { trackProductEvent("page_visit"); }, [pathname]);
  return null;
}
