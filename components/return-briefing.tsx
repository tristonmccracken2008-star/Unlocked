"use client";

import { useEffect, useState } from "react";
import type { ReturnBriefingItem, ReturnBriefingKind, ReturnBriefingModel } from "@/data/return-experience";
import { authenticatedFetch } from "@/data/authenticated-request";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { trackProductEvent } from "@/data/product-analytics";
import { ArrowIcon, BellIcon, CalendarIcon, CloseIcon, PenLineIcon, SearchIcon, SparkIcon, TargetIcon } from "./icons";
import styles from "./return-briefing.module.css";

function BriefingIcon({ kind }: { kind: ReturnBriefingKind }) {
  if (kind === "deadline") return <CalendarIcon />;
  if (kind === "application") return <PenLineIcon />;
  if (kind === "opportunity_change") return <BellIcon />;
  if (kind === "recommendation") return <SparkIcon />;
  if (kind === "continuation") return <TargetIcon />;
  return <SearchIcon />;
}

function action(item: ReturnBriefingItem) {
  trackProductEvent(productIntelligenceEvents.returnBriefingAction, { category: item.kind, priority: item.urgency, action: item.actionLabel });
  if (!item.applicationTargetId) return;
  const target = document.getElementById(item.applicationTargetId) as HTMLElement & { showPopover?: () => void } | null;
  if (target?.showPopover) {
    target.showPopover();
    target.focus({ preventScroll: true });
  }
}

export function ReturnBriefing({ model }: { model: ReturnBriefingModel }) {
  const [items, setItems] = useState(model.items);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    trackProductEvent(productIntelligenceEvents.returnBriefingShown, {
      status: model.allCaughtUp ? "caught_up" : `${model.items.length}_items`,
      category: model.items[0]?.kind ?? "none",
      priority: model.items[0]?.urgency ?? "normal",
    }, { dedupeKey: `return-briefing:${model.generatedAt}`, dedupeWindowMs: 60_000 });
    void authenticatedFetch("/api/return-experience", { method: "POST", credentials: "same-origin", cache: "no-store" }).catch(() => undefined);
  }, [model.allCaughtUp, model.generatedAt, model.items]);

  async function dismiss(item: ReturnBriefingItem) {
    if (!item.notificationId || pending) return;
    setPending(item.id);
    setError("");
    try {
      const response = await authenticatedFetch("/api/notifications", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", notificationId: item.notificationId }),
      });
      if (!response.ok) throw new Error("dismiss_failed");
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      trackProductEvent(productIntelligenceEvents.returnBriefingDismissed, { category: item.kind, priority: item.urgency });
    } catch {
      setError("We couldn’t dismiss this update. Try again.");
    } finally {
      setPending(null);
    }
  }

  const caughtUp = model.allCaughtUp || items.length === 0;
  return <section className={styles.briefing} aria-labelledby="return-briefing-heading" data-return-briefing="">
    <header>
      <p>{model.greeting}</p>
      <h2 id="return-briefing-heading">{caughtUp ? "You’re all caught up." : model.heading}</h2>
      {caughtUp ? <span>Nothing needs your attention right now.</span> : null}
    </header>
    {items.length ? <ol>{items.map((item, index) => <li key={item.id} data-urgency={item.urgency} data-primary={index === 0 ? "true" : undefined}>
      <span className={styles.icon} aria-hidden="true"><BriefingIcon kind={item.kind} /></span>
      <div className={styles.copy}>
        <strong>{item.title}</strong>
        <span>{item.detail}</span>
        {item.meta ? <small>{item.meta}</small> : null}
      </div>
      <a href={item.href} onClick={(event) => {
        if (item.applicationTargetId) event.preventDefault();
        action(item);
      }}>{item.actionLabel}<ArrowIcon /></a>
      {item.dismissible ? <button type="button" disabled={pending === item.id} onClick={() => void dismiss(item)} aria-label={`Dismiss ${item.title}`}><CloseIcon /></button> : null}
    </li>)}</ol> : <a className={styles.explore} href="/opportunities">Explore opportunities <ArrowIcon /></a>}
    {error ? <p className={styles.error} role="status">{error}</p> : null}
  </section>;
}
