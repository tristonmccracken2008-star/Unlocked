import { CheckIcon } from "./icons";
import type { VerificationStatus } from "@/data/opportunities";

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
const confidence: Record<VerificationStatus, { label: "Verified" | "Needs Review" | "Community Verified"; description: string }> = {
  verified: { label: "Verified", description: "UnlockED reviewed this listing against an official provider or university source." },
  needs_review: { label: "Needs Review", description: "The listing has an official source, but one or more details require a fresh review." },
  temporarily_closed: { label: "Needs Review", description: "The program appears recurring, but applications are currently closed or the next cycle is not announced." },
  expired: { label: "Needs Review", description: "The documented offer or deadline has expired and should not be treated as currently available." },
  broken_source: { label: "Needs Review", description: "The official source needs attention before this listing can be trusted." },
  archived: { label: "Needs Review", description: "This listing is archived and should not be treated as currently available." },
  incomplete: { label: "Needs Review", description: "Required listing information is missing and must be completed before this record can be trusted." },
  community_reported: { label: "Community Verified", description: "Community evidence supports this listing, but official-source review may still be pending." },
};

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const tone = status === "verified" ? "border-trust/25 bg-trust/[.06] text-trust" : ["expired", "broken_source", "archived"].includes(status) ? "border-red-700/25 bg-red-700/[.05] text-red-700" : "border-amber-700/25 bg-amber-700/[.05] text-amber-700";
  return <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] ${tone}`}>{status === "verified" && <CheckIcon className="h-3 w-3" />}{labels[status]}</span>;
}

export function ConfidenceBadge({ status }: { status: VerificationStatus }) {
  const item = confidence[status];
  const tone = item.label === "Verified" ? "border-trust/35 text-trust" : item.label === "Needs Review" ? "border-amber-700/35 text-amber-700" : "border-forest/35 text-forest";
  return <span tabIndex={0} className={`group relative inline-flex cursor-help items-center border px-2 py-1 text-[10px] font-bold uppercase tracking-wider outline-none ${tone}`} aria-label={`Confidence: ${item.label}. ${item.description}`}><span className="mr-1 text-ink/35">Confidence</span>{item.label}<span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 hidden w-64 border border-ink/20 bg-ink p-3 text-left text-[11px] font-normal normal-case leading-5 tracking-normal text-white shadow-[4px_4px_0_rgba(43,33,26,.18)] group-hover:block group-focus:block">{item.description}</span></span>;
}
