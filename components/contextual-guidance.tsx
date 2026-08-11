"use client";

import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import { guidanceHasBeenSeen, type GuidanceId, type GuidanceState, type GuidanceStatus } from "@/lib/guidance";
import styles from "./contextual-guidance.module.css";
import { ActionButtonLabel, ActionFeedback } from "./action-feedback";

type JourneyEligibility = {
  journey_intro: boolean;
  journey_calendar: boolean;
  journey_application_workspace: boolean;
  journey_card: boolean;
  journey_changelog: boolean;
  hasRecords: boolean;
};

type Step = { title: string; explanation: string; anchor: string };

const featureTips: Partial<Record<GuidanceId, Step>> = {
  journey_calendar: { title: "Your dates, organized", explanation: "Official deadlines and the dates you add appear together in Upcoming and Calendar views.", anchor: "journey-calendar" },
  journey_application_workspace: { title: "Stay organized through submission", explanation: "Open an application to check verified requirements, add private tasks, and record when you apply.", anchor: "application-workspace" },
  journey_card: { title: "Present confirmed progress", explanation: "Journey Cards turn a real milestone into a polished image. Nothing is published automatically.", anchor: "journey-cards" },
  journey_changelog: { title: "UnlockED tracks important changes", explanation: "When a deadline, eligibility rule, or application detail changes, Journey shows what changed without altering your progress.", anchor: "journey-changelog" },
};

async function saveGuide(id: GuidanceId, status: GuidanceStatus) {
  const response = await authenticatedFetch("/api/account/guidance", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  if (!response.ok) throw new Error("Guide preference could not be saved.");
}

function replayGuide(): GuidanceId | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("guide");
  if (value === "journey") return "journey_intro";
  return value && value in featureTips ? value as GuidanceId : null;
}

function showAnchor(anchor: string) {
  const element = document.querySelector<HTMLElement>(`[data-guide-anchor="${anchor}"]`);
  if (!element) return;
  element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  element.dataset.guideHighlight = "true";
  window.setTimeout(() => delete element.dataset.guideHighlight, 1_600);
}

export function JourneyGuidance({ initialState, eligibility, suppressed = false }: { initialState: GuidanceState; eligibility: JourneyEligibility; suppressed?: boolean }) {
  const [state, setState] = useState(initialState);
  const [replay, setReplay] = useState<GuidanceId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [sessionSuppressed, setSessionSuppressed] = useState(false);
  const [pending, setPending] = useState<GuidanceStatus | null>(null);

  const introSteps = useMemo(() => {
    const steps: Step[] = [
      { title: "Add what matters", explanation: "Bring an opportunity into Journey when you want one private place to manage it.", anchor: "add-opportunity" },
    ];
    if (eligibility.hasRecords) steps.push({ title: "Your active opportunities", explanation: "Everything you are currently pursuing lives here, with one clear stage and next date.", anchor: "active-opportunities" });
    if (eligibility.journey_application_workspace) steps.push(featureTips.journey_application_workspace!);
    if (eligibility.journey_calendar) steps.push(featureTips.journey_calendar!);
    if (eligibility.journey_card) steps.push(featureTips.journey_card!);
    if (eligibility.hasRecords && steps.length < 3) steps.push({ title: "Your professional history", explanation: "Completed and archived records stay available without crowding active work.", anchor: "journey-history" });
    return steps.slice(0, 5);
  }, [eligibility]);

  useEffect(() => setReplay(replayGuide()), []);
  useEffect(() => {
    const current = replay === "journey_intro" || (!replay && eligibility.journey_intro && !guidanceHasBeenSeen(state, "journey_intro")) ? introSteps[stepIndex] : null;
    if (current && stepIndex > 0) showAnchor(current.anchor);
  }, [introSteps, stepIndex, replay, eligibility.journey_intro, state]);

  const introVisible = replay === "journey_intro" || (!replay && eligibility.journey_intro && !guidanceHasBeenSeen(state, "journey_intro"));
  const nextFeature = replay && replay !== "journey_intro"
    ? replay
    : (["journey_changelog", "journey_application_workspace", "journey_calendar", "journey_card"] as GuidanceId[])
      .find((id) => eligibility[id as keyof JourneyEligibility] && !guidanceHasBeenSeen(state, id));
  const feature = !introVisible && nextFeature ? featureTips[nextFeature] : null;
  const id = introVisible ? "journey_intro" : feature ? nextFeature! : null;
  const current = introVisible ? introSteps[Math.min(stepIndex, introSteps.length - 1)] : feature;

  useEffect(() => {
    if (id) trackProductEvent("guide_shown_v1", { control: id }, { dedupeKey: `guide-shown:${id}`, dedupeWindowMs: 86_400_000 });
  }, [id]);

  if ((suppressed && !replay) || sessionSuppressed || !id || !current) return null;

  async function finish(status: GuidanceStatus) {
    if (pending) return;
    setError("");
    setPending(status);
    try {
      await saveGuide(id!, status);
      setState((value) => ({ ...value, [id!]: { status, guideVersion: 1, updatedAt: new Date().toISOString() } }));
      if (replay) setReplay(null);
      setSessionSuppressed(true);
      trackProductEvent(status === "completed" ? "guide_completed_v1" : "guide_dismissed_v1", { control: id! });
    } catch { setError("We couldn’t save this guide preference. Nothing changed; try again."); }
    finally { setPending(null); }
  }

  const last = introVisible && stepIndex === introSteps.length - 1;
  return <aside className={styles.guide} aria-label="UnlockED guide" aria-live="polite" data-contextual-guide={id}>
    <span className={styles.index} aria-hidden="true">{introVisible ? stepIndex + 1 : "?"}</span>
    <div className={styles.copy}><strong>{current.title}</strong><p>{current.explanation}</p></div>
    <div className={styles.actions}>
      {introVisible && stepIndex > 0 ? <button type="button" disabled={Boolean(pending)} onClick={() => setStepIndex((value) => value - 1)}>Back</button> : null}
      {!introVisible ? <button type="button" onClick={() => { showAnchor(current.anchor); trackProductEvent("guide_show_me_clicked_v1", { control: id }); }}>Show me</button> : null}
      {introVisible && !last ? <button type="button" className={styles.primary} disabled={Boolean(pending)} onClick={() => setStepIndex((value) => value + 1)}>Next</button> : <button type="button" className={styles.primary} disabled={Boolean(pending)} aria-busy={pending === "completed" ? "true" : undefined} data-action-state={pending === "completed" ? "loading" : "idle"} onClick={() => void finish("completed")}><ActionButtonLabel phase={pending === "completed" ? "pending" : "idle"} idle={introVisible ? "Finish" : "Got it"} pending="Saving…" /></button>}
      <button type="button" disabled={Boolean(pending)} aria-busy={pending === "dismissed" ? "true" : undefined} data-action-state={pending === "dismissed" ? "loading" : "idle"} onClick={() => void finish("dismissed")} aria-label={`Dismiss ${current.title}`}><ActionButtonLabel phase={pending === "dismissed" ? "pending" : "idle"} idle="Dismiss" pending="Dismissing…" /></button>
    </div>
    {introVisible ? <span className={styles.progress}>{stepIndex + 1} of {introSteps.length}</span> : null}
    {error ? <ActionFeedback className={styles.error} message={error} state="error" level="routine" /> : null}
  </aside>;
}

export function NotificationGuidance({ state, eligible }: { state: GuidanceState; eligible: boolean }) {
  const [visible, setVisible] = useState(eligible && !guidanceHasBeenSeen(state, "notifications_intro"));
  const [error, setError] = useState("");
  const [pending, setPending] = useState<GuidanceStatus | null>(null);
  if (!visible) return null;
  async function finish(status: GuidanceStatus) {
    if (pending) return;
    setVisible(false);
    setPending(status);
    trackProductEvent(status === "completed" ? "guide_completed_v1" : "guide_dismissed_v1", { control: "notifications_intro" });
    try { await saveGuide("notifications_intro", status); } catch { setError("We couldn’t save this guide preference. Nothing changed; try again."); setVisible(true); }
    finally { setPending(null); }
  }
  return <aside className={styles.guide} aria-label="Notification guide" data-contextual-guide="notifications_intro">
    <span className={styles.index} aria-hidden="true">?</span>
    <div className={styles.copy}><strong>Useful updates, nothing more</strong><p>UnlockED brings together deadlines, saved-opportunity changes, Journey reminders, and strong new matches.</p></div>
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={Boolean(pending)} aria-busy={pending === "completed" ? "true" : undefined} data-action-state={pending === "completed" ? "loading" : "idle"} onClick={() => void finish("completed")}><ActionButtonLabel phase={pending === "completed" ? "pending" : "idle"} idle="Got it" pending="Saving…" /></button><button type="button" disabled={Boolean(pending)} aria-busy={pending === "dismissed" ? "true" : undefined} data-action-state={pending === "dismissed" ? "loading" : "idle"} onClick={() => void finish("dismissed")}><ActionButtonLabel phase={pending === "dismissed" ? "pending" : "idle"} idle="Dismiss" pending="Dismissing…" /></button></div>
    {error ? <ActionFeedback className={styles.error} message={error} state="error" level="routine" /> : null}
  </aside>;
}
