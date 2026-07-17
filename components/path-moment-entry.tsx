"use client";

import { useRef, useState, type ComponentType } from "react";
import { trackProductError } from "@/data/product-analytics";
import type { PathMomentCollection } from "@/lib/path-moments";
import styles from "./path-moment.module.css";

type CreatorProps = {
  collection: PathMomentCollection;
  theme: "light" | "dark";
  openedAt: number;
  onClose: () => void;
};

let creatorModulePromise: Promise<typeof import("@/components/path-moment-creator")> | null = null;

function loadCreator() {
  creatorModulePromise ??= import("@/components/path-moment-creator").catch((error) => {
    creatorModulePromise = null;
    throw error;
  });
  return creatorModulePromise;
}

export function PathMomentEntry({ collection, theme }: { collection: PathMomentCollection; theme: "light" | "dark" }) {
  const [Creator, setCreator] = useState<ComponentType<CreatorProps> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedAtRef = useRef(0);

  if (!collection.moments.length) return null;

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
      setCreator(() => module.PathMomentCreator);
    } catch {
      trackProductError("path_moment", "unavailable", "dialog_load");
      setError("The Path Moment creator could not be prepared. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setCreator(null);
    triggerRef.current?.focus();
  }

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={styles.trigger}
      onPointerEnter={preload}
      onFocus={preload}
      onClick={open}
      disabled={loading}
      aria-describedby={error ? "path-moment-load-error" : undefined}
    >
      {loading ? "Preparing Path Moment…" : "Create a Path Moment"}
    </button>
    {error ? <p id="path-moment-load-error" className={styles.status} role="alert">{error}</p> : null}
    {Creator ? <Creator collection={collection} theme={theme} openedAt={openedAtRef.current} onClose={close} /> : null}
  </>;
}
