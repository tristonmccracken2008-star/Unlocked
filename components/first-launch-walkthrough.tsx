"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent, resetAccountSessionCache } from "@/data/account-sync";
import { trackProductEvent } from "@/data/product-analytics";
import type { AccountSession } from "@/lib/account-types";
import { BrandMark } from "./brand-mark";
import styles from "./first-launch-walkthrough.module.css";

type WalkthroughStep = {
  id: "discover" | "for-you" | "journey" | "ready";
  eyebrow: string;
  headline: string;
  paragraphs: readonly string[];
  desktopImage: string;
  mobileImage: string;
};

const steps: readonly WalkthroughStep[] = [
  {
    id: "discover",
    eyebrow: "Discover",
    headline: "Discover Opportunities",
    paragraphs: ["Browse thousands of verified opportunities.", "Search, filter, and save opportunities that match your goals."],
    desktopImage: "/walkthrough/discover-desktop.png",
    mobileImage: "/walkthrough/discover-mobile.png",
  },
  {
    id: "for-you",
    eyebrow: "For You",
    headline: "Personalized For You",
    paragraphs: ["UnlockED learns from your school, interests, and goals to recommend opportunities tailored to you."],
    desktopImage: "/walkthrough/for-you-desktop.png",
    mobileImage: "/walkthrough/for-you-mobile.png",
  },
  {
    id: "journey",
    eyebrow: "Journey",
    headline: "Build Your Journey",
    paragraphs: ["Save opportunities, track applications, celebrate milestones, and build your professional story throughout college."],
    desktopImage: "/walkthrough/journey-desktop.png",
    mobileImage: "/walkthrough/journey-mobile.png",
  },
  {
    id: "ready",
    eyebrow: "Welcome to UnlockED",
    headline: "You’re Ready",
    paragraphs: ["Start exploring opportunities, build your Journey, and let UnlockED help you discover what’s next."],
    desktopImage: "/walkthrough/discover-desktop.png",
    mobileImage: "/walkthrough/discover-mobile.png",
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
    const next = steps[step + 1];
    if (next) for (const src of [next.desktopImage, next.mobileImage]) new Image().src = src;
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
    }, 240);
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
      }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
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
    <div className="absolute inset-0" aria-hidden="true">
      <picture key={steps[displayedStep]!.id}>
        <source media="(max-width: 639px)" srcSet={steps[displayedStep]!.mobileImage} />
        <img src={steps[displayedStep]!.desktopImage} alt="" loading="eager" decoding="async" className={`${styles.backdrop} h-full w-full object-cover object-top`} />
      </picture>
      <div className={`${styles.veil} absolute inset-0`} />
    </div>

    <div className="relative mx-auto flex h-full max-w-7xl flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:py-8">
      <div className="flex min-h-11 items-center gap-3" aria-label="UnlockED">
        <BrandMark className="h-8 w-8 object-contain" />
        <span className="font-editorial text-2xl font-bold">Unlock<span className="text-forest">ED</span></span>
      </div>

      <div className="relative flex flex-1 items-center justify-center py-5 sm:py-8">
        {visible.map((index) => {
          const item = steps[index]!;
          const entering = transition && index === transition.to;
          const motionClass = transition
            ? entering ? transition.direction === "forward" ? styles.enterForward : styles.enterBack : transition.direction === "forward" ? styles.exitForward : styles.exitBack
            : "";
          return <article key={`${item.id}-${entering ? "enter" : "current"}`} aria-hidden={transition ? !entering : undefined} className={`${styles.panel} ${motionClass} absolute w-full max-w-xl rounded-2xl border border-ink/10 bg-paper/95 px-6 py-8 text-center backdrop-blur-xl sm:px-12 sm:py-12`}>
            <p className="rule-label text-forest">{item.eyebrow}</p>
            <h1 ref={index === displayedStep ? headingRef : undefined} tabIndex={-1} style={{ outline: "none" }} className="mt-3 font-editorial text-4xl font-bold leading-[1.04] sm:text-5xl">{item.headline}</h1>
            <div className="mx-auto mt-5 max-w-md space-y-2 text-sm leading-6 text-ink/58 sm:text-base sm:leading-7">
              {item.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {item.id === "for-you" && !pro ? <p className="pt-2 text-xs text-ink/45">Upgrade anytime to unlock your complete personalized feed.</p> : null}
            </div>

            <div className="mt-8 flex min-h-12 items-center gap-3">
              {index > 0 ? <button type="button" onClick={() => goTo(index - 1)} disabled={Boolean(transition) || saving} className="inline-flex min-h-12 min-w-24 items-center justify-center rounded-xl border border-ink/15 bg-transparent px-5 text-sm font-bold text-ink/60 transition hover:border-forest hover:text-forest disabled:opacity-45">Back</button> : <span className="min-w-24" aria-hidden="true" />}
              <button type="button" onClick={() => index === steps.length - 1 ? void finish() : goTo(index + 1)} disabled={Boolean(transition) || saving} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-forest px-6 text-sm font-bold text-white shadow-[0_12px_28px_rgba(31,95,67,.2)] transition hover:bg-ink active:scale-[.99] disabled:opacity-55">
                {saving ? "Saving…" : index === steps.length - 1 ? "Start Exploring" : "Next"}<span aria-hidden="true" className="ml-2">→</span>
              </button>
            </div>
            {error && index === displayedStep ? <p role="alert" aria-live="polite" className="mt-4 text-sm font-bold text-red-700">{error}</p> : null}
          </article>;
        })}
      </div>

      <nav aria-label="Walkthrough progress" className="flex min-h-11 items-center justify-center gap-2">
        <ol className="flex items-center gap-2">
          {steps.map((item, index) => <li key={item.id}><span aria-current={index === displayedStep ? "step" : undefined} className={`block h-2 rounded-full transition-all motion-reduce:transition-none ${index === displayedStep ? "w-7 bg-forest" : "w-2 bg-ink/20"}`}><span className="sr-only">{index === displayedStep ? `Step ${index + 1} of ${steps.length}: ${item.eyebrow}` : item.eyebrow}</span></span></li>)}
        </ol>
      </nav>
    </div>
  </main>;
}
