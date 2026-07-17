"use client";

import { useEffect } from "react";
import { accountSessionEvent } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { bindProductAnalyticsAccount, initializeProductAnalytics } from "@/data/product-analytics";

export function ProductAnalytics() {
  useEffect(() => {
    const cleanup = initializeProductAnalytics();
    const sessionChanged = (event: Event) => {
      const session = (event as CustomEvent<AccountSession>).detail;
      bindProductAnalyticsAccount(session.authenticated ? session.user?.id ?? null : null);
    };
    window.addEventListener(accountSessionEvent, sessionChanged);
    return () => {
      window.removeEventListener(accountSessionEvent, sessionChanged);
      cleanup();
    };
  }, []);
  return null;
}
