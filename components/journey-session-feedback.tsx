"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircleIcon, CloseIcon } from "./icons";
import styles from "./journey-session-feedback.module.css";

type OverviewSnapshot = { id: string; value: string; title: string; detail: string };

export function JourneySessionFeedback({
  accountKey,
  overview,
  attentionCount,
  showHints,
}: {
  accountKey: string;
  overview: OverviewSnapshot[];
  attentionCount: number;
  showHints: boolean;
}) {
  const snapshot = useMemo(() => JSON.stringify(overview), [overview]);
  const initialized = useRef(false);
  const timers = useRef<number[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [caughtUp, setCaughtUp] = useState(false);
  const [hintsVisible, setHintsVisible] = useState(false);

  useEffect(() => {
    const snapshotKey = `unlocked-journey-overview:${accountKey}`;
    const attentionKey = `unlocked-journey-attention:${accountKey}`;
    const previousSnapshot = sessionStorage.getItem(snapshotKey);
    const previousAttention = Number(sessionStorage.getItem(attentionKey));
    sessionStorage.setItem(snapshotKey, snapshot);
    sessionStorage.setItem(attentionKey, String(attentionCount));
    if (initialized.current && previousSnapshot && previousSnapshot !== snapshot) {
      let previous: OverviewSnapshot[] = [];
      try { previous = JSON.parse(previousSnapshot) as OverviewSnapshot[]; } catch { previous = []; }
      for (const item of overview) {
        const before = previous.find((candidate) => candidate.id === item.id);
        if (!before || `${before.value}|${before.title}|${before.detail}` === `${item.value}|${item.title}|${item.detail}`) continue;
        const card = document.querySelector<HTMLElement>(`[data-overview-id="${item.id}"]`);
        if (!card) continue;
        card.dataset.valueChanged = "true";
        timers.current.push(window.setTimeout(() => delete card.dataset.valueChanged, 900));
      }
      setAnnouncement("Journey overview updated.");
    }
    if (initialized.current && previousAttention > 0 && attentionCount === 0) {
      setCaughtUp(true);
      setAnnouncement("You’re all caught up. Nothing needs your attention right now.");
      timers.current.push(window.setTimeout(() => setCaughtUp(false), 2_600));
    }
    initialized.current = true;
  }, [accountKey, attentionCount, overview, snapshot]);

  useEffect(() => {
    setCaughtUp(false);
    setAnnouncement("");
    setHintsVisible(showHints && localStorage.getItem(`unlocked-journey-hints-dismissed:${accountKey}`) !== "true");
  }, [accountKey, showHints]);

  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  function dismissHints() {
    localStorage.setItem(`unlocked-journey-hints-dismissed:${accountKey}`, "true");
    setHintsVisible(false);
  }

  return <>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    {caughtUp ? <aside className={styles.caughtUp} role="status">
      <CheckCircleIcon />
      <span><strong>You’re all caught up.</strong> Nothing needs your attention right now.</span>
    </aside> : null}
    {hintsVisible ? <aside className={styles.hints} aria-labelledby="journey-hints-title">
      <div><p id="journey-hints-title">A quick guide to Journey</p><button type="button" onClick={dismissHints} aria-label="Dismiss Journey guide"><CloseIcon /></button></div>
      <ol>
        <li><strong>Things to do</strong><span>Confirmed deadlines and reminders that need attention.</span></li>
        <li><strong>Update</strong><span>Record real progress when an opportunity moves forward.</span></li>
        <li><strong>Journey Cards</strong><span>Turn a confirmed milestone into a private, shareable card.</span></li>
      </ol>
    </aside> : null}
  </>;
}
