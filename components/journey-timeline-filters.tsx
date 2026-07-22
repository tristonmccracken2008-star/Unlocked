"use client";

import { useEffect, useRef, useState } from "react";
import type { JourneyTimelineFilterKey } from "@/lib/journey-timeline";
import styles from "./journey-timeline.module.css";

const storageKey = "unlocked:journey-filter:v1";

const labels: Record<JourneyTimelineFilterKey, string> = {
  everything: "Everything",
  applications: "Applications",
  interviews: "Interviews",
  offers: "Offers",
  scholarships: "Scholarships",
  research: "Research",
  competitions: "Competitions",
  benefits: "Benefits",
  milestones: "Personal milestones",
};

const filterKeys = Object.keys(labels) as JourneyTimelineFilterKey[];

function validFilter(value: string | null): value is JourneyTimelineFilterKey {
  return Boolean(value && filterKeys.includes(value as JourneyTimelineFilterKey));
}

export function JourneyTimelineFilters({ counts, initiallyCollapsed }: { counts: Record<JourneyTimelineFilterKey, number>; initiallyCollapsed: boolean }) {
  const [active, setActive] = useState<JourneyTimelineFilterKey>("everything");
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  function updateRoot(filter: JourneyTimelineFilterKey, showAll = expanded) {
    const root = groupRef.current?.closest<HTMLElement>("[data-journey-timeline]");
    if (!root) return;
    root.dataset.activeFilter = filter;
    root.dataset.timelineExpanded = showAll ? "true" : "false";
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const next = validFilter(saved) && counts[saved] > 0 ? saved : "everything";
    setActive(next);
    updateRoot(next, false);
    setReady(true);
    // The initial filter is restored once after hydration; later updates are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(filter: JourneyTimelineFilterKey) {
    setActive(filter);
    setExpanded(false);
    updateRoot(filter, false);
    window.localStorage.setItem(storageKey, filter);
  }

  function revealEarlier() {
    setExpanded(true);
    updateRoot(active, true);
  }

  const available = filterKeys.filter((key) => key === "everything" || counts[key] > 0);
  const visibleCount = counts[active];
  return <div className={styles.timelineTools} data-journey-timeline-tools="" data-hydration-ready={ready ? "true" : "false"}>
    <div ref={groupRef} className={styles.filters} role="group" aria-label="Filter Journey moments">
      {available.map((filter) => <button key={filter} type="button" aria-pressed={active === filter} onClick={() => choose(filter)}>
        <span>{labels[filter]}</span><span aria-hidden="true">{counts[filter]}</span>
      </button>)}
    </div>
    <p className={styles.filterStatus} role="status" aria-live="polite">
      {active === "everything" ? `${visibleCount} recorded ${visibleCount === 1 ? "moment" : "moments"}` : `${visibleCount} ${labels[active].toLowerCase()} ${visibleCount === 1 ? "moment" : "moments"}`}
    </p>
    {initiallyCollapsed && active === "everything" && !expanded ? <button type="button" className={styles.earlierButton} onClick={revealEarlier}>See earlier chapters <span aria-hidden="true">↓</span></button> : null}
  </div>;
}
