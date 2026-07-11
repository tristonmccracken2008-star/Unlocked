import { isProUser, type BillingRecord } from "./billing";

export type AdvisorAccessState = "free" | "preview" | "pro" | "unavailable";

export function getAdvisorAccessState(input: { authenticated: boolean; profileComplete: boolean; billing?: BillingRecord | null }): AdvisorAccessState {
  if (!input.authenticated || !input.profileComplete) return "unavailable";
  if (isProUser(input.billing)) return "pro";
  return "preview";
}
