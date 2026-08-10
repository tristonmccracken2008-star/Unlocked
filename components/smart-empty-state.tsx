import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ArrowIcon } from "./icons";
import styles from "./smart-empty-state.module.css";

type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
};

export function SmartEmptyState({
  title,
  description,
  eyebrow,
  icon: Icon,
  primaryAction,
  secondaryAction,
  compact = false,
  className = "",
}: {
  title: string;
  description: ReactNode;
  eyebrow?: string;
  icon?: ComponentType<{ className?: string }>;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  compact?: boolean;
  className?: string;
}) {
  const actions = [
    primaryAction ? { ...primaryAction, primary: true } : null,
    secondaryAction ? { ...secondaryAction, primary: false } : null,
  ].filter((action): action is EmptyStateAction & { primary: boolean } => Boolean(action));
  return <section className={`${styles.root} ${compact ? styles.compact : ""} ${className}`} data-smart-empty-state="" aria-label={title}>
    {Icon ? <span className={styles.icon} aria-hidden="true"><Icon /></span> : null}
    <div className={styles.copy}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2>{title}</h2>
      <p className={styles.description}>{description}</p>
    </div>
    {actions.length ? <div className={styles.actions}>{actions.map((action, index) => action.href
      ? <Link key={`${action.label}-${index}`} href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined} data-primary={action.primary ? "true" : undefined}>{action.label}{action.primary ? <ArrowIcon /> : null}{action.external ? <span className="sr-only"> (opens in a new tab)</span> : null}</Link>
      : <button key={`${action.label}-${index}`} type="button" onClick={action.onClick} data-primary={action.primary ? "true" : undefined}>{action.label}{action.primary ? <ArrowIcon /> : null}</button>)}</div> : null}
  </section>;
}
