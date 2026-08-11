"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "./icons";
import { DelayedPendingLabel } from "./delayed-pending-label";
import styles from "./action-feedback.module.css";

export type ActionPhase = "idle" | "pending" | "success" | "error";
export type ActionFeedbackLevel = "routine" | "confirmatory" | "important";

export function ActionButtonLabel({
  phase,
  idle,
  pending,
  success,
}: {
  phase: ActionPhase;
  idle: ReactNode;
  pending: ReactNode;
  success?: ReactNode;
}) {
  if (phase === "success" && success) return <span className={styles.buttonSuccess}><CheckIcon />{success}</span>;
  return <DelayedPendingLabel pending={phase === "pending"} idle={idle} pendingLabel={pending} />;
}

export function ActionFeedback({
  message,
  state,
  level = "confirmatory",
  id,
  action,
  className = "",
}: {
  message: string;
  state: Exclude<ActionPhase, "idle" | "pending">;
  level?: ActionFeedbackLevel;
  id?: string;
  action?: { label: string; onClick: () => void; pending?: boolean };
  className?: string;
}) {
  if (!message) return null;
  return <div
    id={id}
    className={`${styles.feedback} ${className}`}
    role={state === "error" ? "alert" : "status"}
    aria-live={state === "error" ? "assertive" : "polite"}
    aria-atomic="true"
    data-inline-feedback=""
    data-action-feedback=""
    data-state={state}
    data-level={level}
  >
    <span className={styles.icon} aria-hidden="true">{state === "success" ? <CheckIcon /> : "!"}</span>
    <span>{message}</span>
    {action ? <button type="button" disabled={action.pending} onClick={action.onClick}>{action.pending ? "Trying again…" : action.label}</button> : null}
  </div>;
}
