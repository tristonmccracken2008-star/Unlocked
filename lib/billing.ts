export const accountTiers = ["free", "pro"] as const;

export type AccountTier = (typeof accountTiers)[number];

export type BillingStatus = "inactive" | "active" | "past_due" | "canceled";

export type BillingRecord = {
  tier: AccountTier;
  status: BillingStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  updatedAt: string;
};

export type PremiumFeatureKey = "advancedFilters" | "priorityOpportunityAlerts" | "applicationTracker";

export type FeatureFlag = {
  key: PremiumFeatureKey;
  minimumTier: AccountTier;
  enabled: boolean;
};

export const defaultBillingRecord = (): BillingRecord => ({
  tier: "free",
  status: "inactive",
  updatedAt: new Date().toISOString(),
});

export const premiumFeatureFlags: Record<PremiumFeatureKey, FeatureFlag> = {
  advancedFilters: { key: "advancedFilters", minimumTier: "pro", enabled: false },
  priorityOpportunityAlerts: { key: "priorityOpportunityAlerts", minimumTier: "pro", enabled: false },
  applicationTracker: { key: "applicationTracker", minimumTier: "pro", enabled: false },
};

export function normalizeAccountTier(value: unknown): AccountTier {
  return value === "pro" ? "pro" : "free";
}

export function normalizeBillingRecord(value: unknown): BillingRecord {
  if (!value || typeof value !== "object") return defaultBillingRecord();
  const input = value as Partial<BillingRecord>;
  const status: BillingStatus = input.status === "active" || input.status === "past_due" || input.status === "canceled" ? input.status : "inactive";
  return {
    tier: normalizeAccountTier(input.tier),
    status,
    stripeCustomerId: typeof input.stripeCustomerId === "string" ? input.stripeCustomerId : undefined,
    stripeSubscriptionId: typeof input.stripeSubscriptionId === "string" ? input.stripeSubscriptionId : undefined,
    currentPeriodEnd: typeof input.currentPeriodEnd === "string" ? input.currentPeriodEnd : undefined,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
  };
}

export function canUsePremiumFeature(billing: BillingRecord | null | undefined, featureKey: PremiumFeatureKey) {
  const feature = premiumFeatureFlags[featureKey];
  if (!feature?.enabled) return false;
  const tier = normalizeAccountTier(billing?.tier);
  if (feature.minimumTier === "free") return true;
  return tier === "pro" && billing?.status === "active";
}
