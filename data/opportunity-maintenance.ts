import type { Opportunity, VerificationStatus } from "./opportunities";

export type ReviewReason = "Verification older than 60 days" | "Deadline passed" | "Missing official source" | "Missing eligibility" | "Unknown value is not documented";
export type ReviewOverride = { status: VerificationStatus | "archived"; reviewedAt: string };
export const reviewOverridesKey = "unlocked-opportunity-review-overrides-v1";

const day = 86_400_000;
const validDate = (value: string | null | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export function reviewReasons(item: Opportunity, now = new Date()): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  const verifiedAt = validDate(item.last_verified) ? new Date(`${item.last_verified}T00:00:00Z`).getTime() : 0;
  if (!verifiedAt || now.getTime() - verifiedAt > 60 * day) reasons.push("Verification older than 60 days");
  if (item.deadline && new Date(`${item.deadline}T23:59:59Z`).getTime() < now.getTime()) reasons.push("Deadline passed");
  if (!item.official_source_url?.startsWith("https://")) reasons.push("Missing official source");
  if (!item.eligibility?.trim()) reasons.push("Missing eligibility");
  if (item.estimated_value === null && !/unknown|not documented|not published/i.test(item.estimated_value_note)) reasons.push("Unknown value is not documented");
  return reasons;
}

export function maintenanceStatus(item: Opportunity, now = new Date()): VerificationStatus {
  if (item.verification_status === "expired" || item.verification_status === "incomplete" || item.verification_status === "community_reported") return item.verification_status;
  return reviewReasons(item, now).length ? "needs_review" : item.verification_status;
}

export function isExpiringSoon(item: Opportunity, now = new Date(), days = 30) {
  if (!item.deadline) return false;
  const deadline = new Date(`${item.deadline}T23:59:59Z`).getTime();
  return deadline >= now.getTime() && deadline <= now.getTime() + days * day;
}

export function readReviewOverrides(): Record<string, ReviewOverride> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(reviewOverridesKey) ?? "{}"); } catch { return {}; }
}

export function saveReviewOverride(opportunityId: string, status: ReviewOverride["status"]) {
  const next = { ...readReviewOverrides(), [opportunityId]: { status, reviewedAt: new Date().toISOString() } };
  localStorage.setItem(reviewOverridesKey, JSON.stringify(next));
  return next;
}
