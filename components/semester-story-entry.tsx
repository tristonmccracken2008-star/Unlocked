"use client";

import { useRef, useState, type ComponentType } from "react";
import { trackProductError } from "@/data/product-analytics";
import type { SemesterStoryCollection } from "@/lib/semester-story";
import styles from "./semester-story.module.css";

type CreatorProps = {
  collection: SemesterStoryCollection;
  theme: "light" | "dark";
  openedAt: number;
  onClose: () => void;
};

let creatorModulePromise: Promise<typeof import("@/components/semester-story-creator")> | null = null;

function loadCreator() {
  creatorModulePromise ??= import("@/components/semester-story-creator").catch((error) => {
    creatorModulePromise = null;
    throw error;
  });
  return creatorModulePromise;
}

export function SemesterStoryEntry({ collection, theme }: { collection: SemesterStoryCollection; theme: "light" | "dark" }) {
  const [Creator, setCreator] = useState<ComponentType<CreatorProps> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedAtRef = useRef(0);
  const selected = collection.stories.find((story) => story.term.id === collection.selectedTermId) ?? collection.stories[0];
  if (!selected) return null;

  function preload() {
    void loadCreator().catch(() => undefined);
  }

  async function open() {
    if (Creator || loading) return;
    setLoading(true);
    setError("");
    openedAtRef.current = performance.now();
    try {
      const module = await loadCreator();
      setCreator(() => module.SemesterStoryCreator);
    } catch {
      trackProductError("semester_story", "unavailable", "dialog_load");
      setError("Your Semester Story could not be prepared. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setCreator(null);
    triggerRef.current?.focus();
  }

  return <section className={styles.entry} aria-labelledby="semester-story-entry-title" data-semester-story-entry="">
    <div>
      <p>Semester Story</p>
      <h2 id="semester-story-entry-title">{selected.state === "active" ? `${selected.term.label} so far` : selected.term.label}</h2>
      <span>{selected.opening}</span>
    </div>
    <button ref={triggerRef} type="button" onPointerEnter={preload} onFocus={preload} onClick={open} disabled={loading} aria-describedby={error ? "semester-story-load-error" : undefined}>{loading ? "Preparing story…" : "View your semester story"}<span aria-hidden="true"> →</span></button>
    {error ? <p id="semester-story-load-error" className={styles.loadError} role="alert">{error}</p> : null}
    {Creator ? <Creator collection={collection} theme={theme} openedAt={openedAtRef.current} onClose={close} /> : null}
  </section>;
}
