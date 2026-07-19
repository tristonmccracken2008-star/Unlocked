"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import type { ProPlanId } from "@/lib/billing";

type BillingCheckoutButtonProps = {
  planId: ProPlanId;
  children: ReactNode;
  className?: string;
  configured?: boolean;
  source: "pricing" | "profile";
};

export function BillingCheckoutButton({ planId, children, className = "", configured = true, source }: BillingCheckoutButtonProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const activeRef = useRef(false);

  async function startCheckout() {
    if (activeRef.current) return;
    if (!configured) {
      setError(true);
      setMessage("Checkout is temporarily unavailable. Please try again later.");
      return;
    }
    activeRef.current = true;
    setPending(true);
    setMessage("");
    setError(false);
    trackProductEvent("pro_plan_selected", { action: planId, section: source });
    trackProductEvent("checkout_started", { action: planId, section: source });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await authenticatedFetch("/api/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ planId }),
      });
      const body = await response.json().catch(() => null) as { url?: string; error?: string; code?: string } | null;
      if (!response.ok || !body?.url) {
        setError(true);
        setMessage(response.status === 401 ? "Sign in to upgrade to UnlockED Pro." : body?.error || "We couldn’t start checkout. Please try again.");
        return;
      }
      let checkoutUrl: URL;
      try {
        checkoutUrl = new URL(body.url);
      } catch {
        throw new Error("invalid_checkout_url");
      }
      if (checkoutUrl.protocol !== "https:" || !(checkoutUrl.hostname === "stripe.com" || checkoutUrl.hostname.endsWith(".stripe.com"))) throw new Error("invalid_checkout_url");
      trackProductEvent("checkout_redirected", { action: planId, section: source });
      window.location.assign(checkoutUrl.toString());
    } catch {
      setError(true);
      setMessage(controller.signal.aborted ? "Checkout took too long to respond. Please try again." : "We couldn’t start checkout. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      activeRef.current = false;
      setPending(false);
    }
  }

  return <div>
    <button type="button" onClick={startCheckout} disabled={pending} className={className} aria-describedby={message ? `checkout-message-${planId}-${source}` : undefined}>{pending ? "Opening secure checkout…" : children}</button>
    {message ? <p id={`checkout-message-${planId}-${source}`} role={error ? "alert" : "status"} className={`mt-2 text-xs font-bold leading-5 ${error ? "text-red-700" : "text-forest"}`}>{message}</p> : null}
  </div>;
}
