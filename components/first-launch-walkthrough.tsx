"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent, resetAccountSessionCache } from "@/data/account-sync";
import { trackProductEvent } from "@/data/product-analytics";
import type { AccountSession } from "@/lib/account-types";
import { FirstLaunchPreview } from "./first-launch-preview";
import styles from "./first-launch-walkthrough.module.css";
import { DelayedPendingLabel } from "./delayed-pending-label";

type WalkthroughStep = {
  id: "discover" | "for-you" | "journey" | "ready";
  eyebrow: string;
  headline: string;
  paragraphs: readonly string[];
};

const steps: readonly WalkthroughStep[] = [
  {
    id: "discover",
    eyebrow: "Discover",
    headline: "Discover Opportunities",
    paragraphs: ["Browse thousands of opportunities across internships, scholarships, research, programs, benefits, and more.", "Search, filter, and save what matters to you."],
  },
  {
    id: "for-you",
    eyebrow: "For You",
    headline: "Personalized For You",
    paragraphs: ["UnlockED uses your school, interests, goals, and activity to surface opportunities worth your attention."],
  },
  {
    id: "journey",
    eyebrow: "Journey",
    headline: "Build Your Journey",
    paragraphs: ["Save opportunities, track applications, stay on top of what’s next, and record the milestones you accomplish along the way."],
  },
  {
    id: "ready",
    eyebrow: "Welcome to UnlockED",
    headline: "You’re Ready",
    paragraphs: ["UnlockED is ready to help you discover opportunities, stay organized, and make more of your time in college."],
  },
] as const;

const draftKey = (userId: string | undefined) => `unlocked-first-launch-v1:${userId ?? "anonymous"}`;

function restoredStep(key: string) {
  try {
    const value = Number(sessionStorage.getItem(key));
    return Number.isInteger(value) && value >= 0 && value < steps.length ? value : 0;
  } catch {
    return 0;
  }
}

export function FirstLaunchWalkthrough({ initialSession, pro }: { initialSession: AccountSession; pro: boolean }) {
  const router = useRouter();
  const userId = initialSession.user?.id;
  const storageKey = draftKey(userId);
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const [transition, setTransition] = useState<{ from: number; to: number; direction: "forward" | "back" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const activeUserId = useRef(userId);
  const savingRef = useRef(false);
  const transitionTimer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setStep(restoredStep(storageKey));
    setRestored(true);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [storageKey]);

  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(storageKey, String(step)); } catch { /* Session progress is best effort. */ }
    window.requestAnimationFrame(() => headingRef.current?.focus());
    trackProductEvent("first_launch_step_viewed", { stepId: steps[step]!.id, stepIndex: String(step + 1), stepCount: String(steps.length) });
  }, [restored, step, storageKey]);

  useEffect(() => {
    const accountChanged = (event: Event) => {
      const next = (event as CustomEvent<AccountSession>).detail;
      if (next.user?.id === activeUserId.current) return;
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
      window.location.assign(next.authenticated ? "/onboarding" : "/");
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => window.removeEventListener(accountSessionEvent, accountChanged);
  }, []);

  useEffect(() => () => {
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
  }, []);

  const goTo = useCallback((next: number) => {
    if (transition || savingRef.current || next < 0 || next >= steps.length || next === step) return;
    setError("");
    const direction = next > step ? "forward" : "back";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStep(next);
      return;
    }
    setTransition({ from: step, to: next, direction });
    transitionTimer.current = window.setTimeout(() => {
      setStep(next);
      setTransition(null);
      transitionTimer.current = null;
    }, 360);
  }, [step, transition]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && step < steps.length - 1) {
        event.preventDefault();
        goTo(step + 1);
      } else if (event.key === "ArrowLeft" && step > 0) {
        event.preventDefault();
        goTo(step - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, step]);

  async function finish() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/account/first-launch", { method: "POST", credentials: "same-origin" });
      if (response.status === 401) throw new Error("session");
      if (!response.ok) throw new Error("save");
      const result = await response.json() as { ok?: boolean };
      if (!result.ok || activeUserId.current !== userId) throw new Error("session");
      try { sessionStorage.removeItem(storageKey); } catch { /* Best effort. */ }
      trackProductEvent("first_launch_completed", { stepCount: String(steps.length) });
      resetAccountSessionCache();
      setFinishing(true);
      window.setTimeout(() => {
        router.replace("/opportunities");
        router.refresh();
      }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 360);
    } catch (caught) {
      savingRef.current = false;
      setSaving(false);
      setError(caught instanceof Error && caught.message === "session" ? "Your session changed. Sign in again to continue." : "We couldn’t save this step. Please try again.");
    }
  }

  const visible = useMemo(() => transition ? [transition.from, transition.to] : [step], [step, transition]);
  const displayedStep = transition?.to ?? step;

  return <main
    className={`${styles.root} ${finishing ? styles.finish : ""} fixed inset-0 z-[100] overflow-hidden bg-paper text-ink`}
    data-first-launch-walkthrough="v1"
    data-first-launch-step={steps[displayedStep]!.id}
    onTouchStart={(event) => { const touch = event.touches[0]; if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }; }}
    onTouchEnd={(event) => {
      const start = touchStart.current;
      const touch = event.changedTouches[0];
      touchStart.current = null;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
      if (dx < 0 && step < steps.length - 1) goTo(step + 1);
      if (dx > 0 && step > 0) goTo(step - 1);
    }}
  >
    <div className={styles.previewStage} aria-hidden="true">
      {visible.map((index) => {
        const item = steps[index]!;
        const entering = transition && index === transition.to;
        const motionClass = transition
          ? entering ? transition.direction === "forward" ? styles.previewEnterForward : styles.previewEnterBack : transition.direction === "forward" ? styles.previewExitForward : styles.previewExitBack
          : "";
        return <div key={`preview-${item.id}-${entering ? "enter" : "current"}`} className={`${styles.previewLayer} ${item.id === "ready" ? styles.readyPreview : ""} ${motionClass}`}><FirstLaunchPreview step={item.id} /></div>;
      })}
      <div className={styles.veil} />
    </div>

    <div className={styles.walkthroughShell}>
      <div className={styles.panelStage}>
        {visible.map((index) => {
          const item = steps[index]!;
          const entering = transition && index === transition.to;
          const motionClass = transition
            ? entering ? transition.direction === "forward" ? styles.enterForward : styles.enterBack : transition.direction === "forward" ? styles.exitForward : styles.exitBack
            : "";
          return <article key={`${item.id}-${entering ? "enter" : "current"}`} aria-hidden={transition ? !entering : undefined} className={`${styles.panel} ${item.id === "ready" ? styles.readyPanel : ""} ${motionClass}`}>
            {item.id === "ready" ? <span className={styles.readyMark} aria-hidden="true">✓</span> : null}
            <p className="rule-label text-forest">{item.eyebrow}</p>
            <h1 ref={index === displayedStep ? headingRef : undefined} tabIndex={-1}>{item.headline}</h1>
            <div className={styles.panelCopy}>
              {item.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {item.id === "for-you" && !pro ? <p className={styles.freeNote}>Upgrade anytime to unlock your complete personalized feed.</p> : null}
            </div>

            <div className={styles.panelActions}>
              {index > 0 ? <button type="button" onClick={() => goTo(index - 1)} disabled={Boolean(transition) || saving} className={styles.backButton}>Back</button> : <span className={styles.actionSpacer} aria-hidden="true" />}
              <button type="button" onClick={() => index === steps.length - 1 ? void finish() : goTo(index + 1)} disabled={Boolean(transition) || saving} aria-busy={saving ? "true" : undefined} data-action-state={saving ? "loading" : "idle"} className={styles.nextButton}>
                <DelayedPendingLabel pending={saving} idle={index === steps.length - 1 ? "Start Exploring" : "Next"} pendingLabel="Saving your progress…" /><span aria-hidden="true" className="ml-2">→</span>
              </button>
            </div>
            {error && index === displayedStep ? <p role="alert" aria-live="polite" data-inline-feedback="" data-state="error" className={styles.panelError}>{error}</p> : null}
          </article>;
        })}
      </div>

      <nav aria-label="Walkthrough progress" className={styles.progress}>
        <ol>
          {steps.map((item, index) => <li key={item.id}><span aria-current={index === displayedStep ? "step" : undefined} data-active={index === displayedStep}><span className="sr-only">{index === displayedStep ? `Step ${index + 1} of ${steps.length}: ${item.eyebrow}` : item.eyebrow}</span></span></li>)}
        </ol>
      </nav>
    </div>
  </main>;
}
