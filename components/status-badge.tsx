import { CheckIcon } from "./icons";
import type { VerificationStatus } from "@/data/seed";

const labels: Record<VerificationStatus, string> = {
  verified_recently: "Verified Recently",
  needs_review: "Needs Review",
  expired: "Expired",
  community_submitted: "Community Submitted",
};

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const tone = status === "verified_recently" ? "text-trust" : status === "expired" ? "text-red-700" : "text-amber-700";
  return <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${tone}`}>{status === "verified_recently" && <CheckIcon className="h-3 w-3" />}{labels[status]}</span>;
}
