"use client";

import { useRef, useState, type ComponentType } from "react";
import type { JourneyCardData } from "@/lib/journey-timeline";
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

export function JourneyCardEntry({ card, theme }: { card: JourneyCardData; theme: "light" | "dark" }) {
  const [Creator, setCreator] = useState<ComponentType<CreatorProps> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  function preload() {
    void loadCreator().catch(() => undefined);
  }

  async function open() {
    if (Creator || loading) return;
    setLoading(true);
    setError("");
    try {
      const module = await loadCreator();
      setCreator(() => module.JourneyCardCreator);
    } catch {
      setError("Your Journey Card could not be prepared. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setCreator(null);
    triggerRef.current?.focus();
  }

  return <div data-journey-card-entry="">
    <button ref={triggerRef} type="button" onPointerEnter={preload} onFocus={preload} onClick={open} disabled={loading} aria-describedby={error ? "journey-card-load-error" : undefined} className={styles.compactTrigger}>
      {loading ? "Preparing card…" : "Create a Journey Card"}<span aria-hidden="true"> →</span>
    </button>
    {error ? <p id="journey-card-load-error" className={styles.loadError} role="alert">{error}</p> : null}
    {Creator ? <Creator card={card} theme={theme} onClose={close} /> : null}
  </div>;
}
