"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { accountSessionEvent, accountSessionStorageKey } from "@/data/account-sync";
import { ActionFeedback } from "./action-feedback";
import styles from "./undo-recovery.module.css";

type UndoOffer = {
  message: string;
  restoredMessage: string;
  undo: () => Promise<void>;
};

type UndoItem = UndoOffer & { id: string };
const undoWindowMs = 8_000;
const undoOfferEvent = "unlocked:undo-offered";

export function UndoRecoveryHost() {
  const [queue, setQueue] = useState<UndoItem[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState("");
  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const restoredRef = useRef(false);
  const accountIdRef = useRef<string | null | undefined>(undefined);
  const active = queue[0];

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const dismissActive = useCallback(() => {
    clearTimer();
    restoredRef.current = false;
    setError("");
    setRestored("");
    setQueue((current) => current.slice(1));
  }, [clearTimer]);

  const scheduleExpiry = useCallback(() => {
    clearTimer();
    if (!active || pending || error || restored || pausedRef.current) return;
    timerRef.current = window.setTimeout(dismissActive, undoWindowMs);
  }, [active, clearTimer, dismissActive, error, pending, restored]);

  useEffect(() => {
    scheduleExpiry();
    return clearTimer;
  }, [clearTimer, scheduleExpiry]);

  useEffect(() => {
    if (!active || !restored) return;
    clearTimer();
    timerRef.current = window.setTimeout(dismissActive, 1_600);
    return clearTimer;
  }, [active, clearTimer, dismissActive, restored]);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(accountSessionStorageKey) ?? "null") as { authenticated?: boolean; user?: { id?: string } } | null;
      accountIdRef.current = cached?.authenticated && cached.user?.id ? cached.user.id : null;
    } catch {
      accountIdRef.current = null;
    }
    const reset = () => {
      clearTimer();
      setQueue([]);
      setPending(false);
      setError("");
      setRestored("");
      restoredRef.current = false;
    };
    const accountChanged = (event: Event) => {
      const session = (event as CustomEvent<{ authenticated?: boolean; user?: { id?: string } }>).detail;
      const nextAccountId = session?.authenticated && session.user?.id ? session.user.id : null;
      if (nextAccountId === null || (accountIdRef.current !== undefined && accountIdRef.current !== nextAccountId)) reset();
      accountIdRef.current = nextAccountId;
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => window.removeEventListener(accountSessionEvent, accountChanged);
  }, [clearTimer]);

  useEffect(() => {
    const receive = (event: Event) => {
      const offer = (event as CustomEvent<UndoOffer>).detail;
      if (!offer?.message || typeof offer.undo !== "function") return;
      const item = { ...offer, id: crypto.randomUUID() };
      if (restoredRef.current) {
        clearTimer();
        restoredRef.current = false;
        setRestored("");
        setQueue((current) => [...current.slice(1), item].slice(-4));
        return;
      }
      setQueue((current) => [...current, item].slice(-4));
    };
    window.addEventListener(undoOfferEvent, receive);
    return () => window.removeEventListener(undoOfferEvent, receive);
  }, [clearTimer]);

  async function runUndo() {
    if (!active || pending) return;
    clearTimer();
    setPending(true);
    setError("");
    try {
      await active.undo();
      pausedRef.current = false;
      restoredRef.current = true;
      setRestored(active.restoredMessage);
    } catch {
      setError(`Couldn’t restore this item.`);
    } finally {
      setPending(false);
    }
  }

  function pause() {
    if (restoredRef.current) return;
    pausedRef.current = true;
    clearTimer();
  }

  function resume(event: FocusEvent<HTMLElement> | MouseEvent<HTMLElement>) {
    if (event.type === "blur" && event.currentTarget.contains((event as FocusEvent<HTMLElement>).relatedTarget)) return;
    pausedRef.current = false;
    scheduleExpiry();
  }

  return active ? <aside
      className={styles.host}
      aria-label="Undo recent action"
      data-undo-recovery=""
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <ActionFeedback
        message={restored || error || active.message}
        state={error ? "error" : "success"}
        level="confirmatory"
        action={!restored ? { label: error ? "Try again" : "Undo", pendingLabel: "Restoring…", onClick: () => void runUndo(), pending } : undefined}
      />
      {queue.length > 1 ? <span className={styles.count}>{queue.length - 1} more recent {queue.length === 2 ? "action" : "actions"}</span> : null}
    </aside> : null;
}

export function useUndoRecovery() {
  const offerUndo = useCallback((offer: UndoOffer) => window.dispatchEvent(new CustomEvent(undoOfferEvent, { detail: offer })), []);
  return { offerUndo };
}
