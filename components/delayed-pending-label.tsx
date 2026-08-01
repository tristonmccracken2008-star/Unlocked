"use client";

import { useEffect, useState, type ReactNode } from "react";

export function useDelayedPending(pending: boolean, delay = 300) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay, pending]);

  return pending && visible;
}

export function DelayedPendingLabel({
  pending,
  idle,
  pendingLabel,
  delay = 300,
}: {
  pending: boolean;
  idle: ReactNode;
  pendingLabel: ReactNode;
  delay?: number;
}) {
  const showPending = useDelayedPending(pending, delay);
  return <span className="unlocked-button-label" data-pending-visible={showPending ? "true" : "false"}>
    <span aria-hidden={showPending}>{idle}</span>
    <span aria-hidden={!showPending}>{pendingLabel}</span>
  </span>;
}
