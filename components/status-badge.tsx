import { CheckIcon } from "./icons";
import type { VerificationStatus } from "@/data/seed";

const labels: Record<VerificationStatus, string> = {
  verified_recently: "Verified Recently",
  needs_review: "Needs Review",
  expired: "Expired",
  community_submitted: "Community Submitted",
};
const confidence: Record<VerificationStatus, { label: "Verified" | "Needs Review" | "Community Verified"; description: string }> = {
  verified_recently: { label: "Verified", description: "UnlockED reviewed this listing against an official provider or university source." },
  needs_review: { label: "Needs Review", description: "The listing has an official source, but one or more details require a fresh review." },
  expired: { label: "Needs Review", description: "The documented offer or deadline has expired and should not be treated as currently available." },
  community_submitted: { label: "Community Verified", description: "Community evidence supports this listing, but official-source review may still be pending." },
};

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const tone = status === "verified_recently" ? "text-trust" : status === "expired" ? "text-red-700" : "text-amber-700";
  return <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${tone}`}>{status === "verified_recently" && <CheckIcon className="h-3 w-3" />}{labels[status]}</span>;
}

export function ConfidenceBadge({ status }: { status: VerificationStatus }) {
  const item = confidence[status];
  const tone = item.label === "Verified" ? "border-trust/35 text-trust" : item.label === "Needs Review" ? "border-amber-700/35 text-amber-700" : "border-forest/35 text-forest";
  return <span tabIndex={0} className={`group relative inline-flex cursor-help items-center border px-2 py-1 text-[10px] font-bold uppercase tracking-wider outline-none ${tone}`} aria-label={`Confidence: ${item.label}. ${item.description}`}><span className="mr-1 text-ink/35">Confidence</span>{item.label}<span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 hidden w-64 border border-ink/20 bg-ink p-3 text-left text-[11px] font-normal normal-case leading-5 tracking-normal text-white shadow-[4px_4px_0_rgba(16,36,62,.18)] group-hover:block group-focus:block">{item.description}</span></span>;
}
