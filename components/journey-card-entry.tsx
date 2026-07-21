"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { JourneyCardData } from "@/lib/journey-timeline";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { trackProductEvent } from "@/data/product-analytics";
import styles from "./semester-story.module.css";

type CreatorProps = {
  card: JourneyCardData;
  theme: "light" | "dark";
  onClose: () => void;
};

let creatorPromise: Promise<typeof import("@/components/journey-card-creator")> | null = null;

function loadCreator() {
  creatorPromise ??= import("@/components/journey-card-creator").catch((error) => {
    creatorPromise = null;
    throw error;
  });
  return creatorPromise;
}

function loadCreatorWithTimeout(timeoutMs = 8_000) {
  let timeout = 0;
  const timer = new Promise<never>((_, reject) => {
    timeout = window.setTimeout(() => reject(new Error("Journey Card loading timed out.")), timeoutMs);
  });
  return Promise.race([loadCreator(), timer]).finally(() => window.clearTimeout(timeout));
}

export function JourneyCardEntry({ card, theme }: { card: JourneyCardData; theme: "light" | "dark" }) {
  const [Creator, setCreator] = useState<ComponentType<CreatorProps> | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openingRef = useRef(false);

  useEffect(() => setReady(true), []);

  function preload() {
    void loadCreator().catch(() => undefined);
  }

  async function open() {
    if (Creator || loading || openingRef.current) return;
    openingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const module = await loadCreatorWithTimeout();
      setCreator(() => module.JourneyCardCreator);
      trackProductEvent(productIntelligenceEvents.journeyCardCreatorOpened, { format: "story" });
    } catch {
      setError("Your Journey Card could not be prepared. Try again.");
    } finally {
      openingRef.current = false;
      setLoading(false);
    }
  }

  function close() {
    setCreator(null);
    triggerRef.current?.focus();
  }

  return <div data-journey-card-entry="">
    <button ref={triggerRef} type="button" data-hydration-ready={ready ? "true" : "false"} onPointerEnter={preload} onFocus={preload} onClick={() => void open()} disabled={!ready || loading} aria-describedby={error ? "journey-card-load-error" : undefined} className={styles.compactTrigger}>
      {loading ? "Preparing card…" : "Create a Journey Card"}<span aria-hidden="true"> →</span>
    </button>
    {error ? <p id="journey-card-load-error" className={styles.loadError} role="alert">{error}</p> : null}
    {Creator ? <Creator card={card} theme={theme} onClose={close} /> : null}
  </div>;
}
