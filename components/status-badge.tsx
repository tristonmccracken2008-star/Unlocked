import { CheckIcon } from "./icons";
import type { VerificationStatus } from "@/data/opportunities";
import type { OpportunityLifecycleConfidence, OpportunityLifecycleDisplayState } from "@/data/opportunity-lifecycle-types";

const labels: Record<VerificationStatus, string> = {
  verified: "Verified Recently",
  needs_review: "Details Need Review",
  temporarily_closed: "Applications Closed",
  expired: "Expired",
  broken_source: "Source Issue",
  archived: "Archived",
  incomplete: "Incomplete",
  community_reported: "Community Reported",
};
export function StatusBadge({ status }: { status: VerificationStatus }) {
  const tone = status === "verified" ? "border-trust/25 bg-trust/[.06] text-trust" : ["expired", "broken_source", "archived"].includes(status) ? "border-red-700/25 bg-red-700/[.05] text-red-700" : "border-amber-700/25 bg-amber-700/[.05] text-amber-700";
  return <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${tone}`}>{status === "verified" && <CheckIcon className="h-3 w-3" />}{labels[status]}</span>;
}

export function LifecycleBadge({ state, confidence, label }: { state: OpportunityLifecycleDisplayState; confidence: OpportunityLifecycleConfidence; label: string }) {
  const positive = ["open", "rolling", "reopened"].includes(state);
  const caution = ["upcoming", "closing_soon", "temporarily_closed", "unknown"].includes(state);
  const tone = positive
    ? "border-trust/25 bg-trust/[.06] text-trust"
    : caution
      ? "border-amber-700/25 bg-amber-700/[.05] text-amber-800"
      : "border-ink/20 bg-ink/[.04] text-ink/65";
  const confidenceText = confidence === "confirmed"
    ? "confirmed"
    : confidence === "strong"
      ? "supported by current structured evidence"
      : confidence === "estimated"
        ? "estimated from prior patterns"
        : confidence === "limited"
          ? "based on limited current evidence"
          : "not confirmed";
  return <span aria-label={`${label}; ${confidenceText}`} className={`inline-flex items-center border px-2 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${tone}`}>{label}</span>;
}
