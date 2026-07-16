"use client";

import { useRef, useState, type ComponentType } from "react";
import type { SemesterStoryCollection } from "@/lib/semester-story";
import styles from "./semester-story.module.css";

type CreatorProps = {
  collection: SemesterStoryCollection;
  theme: "light" | "dark";
  onClose: () => void;
};

export function SemesterStoryEntry({ collection, theme }: { collection: SemesterStoryCollection; theme: "light" | "dark" }) {
  const [Creator, setCreator] = useState<ComponentType<CreatorProps> | null>(null);
  const [loading, setLoading] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = collection.stories.find((story) => story.term.id === collection.selectedTermId) ?? collection.stories[0];
  if (!selected) return null;

  async function open() {
    if (Creator || loading) return;
    setLoading(true);
    try {
      const module = await import("@/components/semester-story-creator");
      setCreator(() => module.SemesterStoryCreator);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setCreator(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return <section className={styles.entry} aria-labelledby="semester-story-entry-title" data-semester-story-entry="">
    <div>
      <p>Semester Story</p>
      <h2 id="semester-story-entry-title">{selected.state === "active" ? `${selected.term.label} so far` : selected.term.label}</h2>
      <span>{selected.opening}</span>
    </div>
    <button ref={triggerRef} type="button" onClick={open} disabled={loading}>{loading ? "Preparing story…" : "View your semester story"}<span aria-hidden="true"> →</span></button>
    {Creator ? <Creator collection={collection} theme={theme} onClose={close} /> : null}
  </section>;
}
