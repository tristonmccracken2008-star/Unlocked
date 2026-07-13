export const accountTiers = ["free", "pro"] as const;

export type AccountTier = (typeof accountTiers)[number];

export type Plan = AccountTier;
export type SubscriptionStatus = "free" | "trialing" | "active" | "past_due" | "unpaid" | "incomplete" | "incomplete_expired" | "canceled" | "paused";
export type BillingStatus = SubscriptionStatus;
export type BillingInterval = "month" | "year" | null;

export type BillingRecord = {
  tier: AccountTier;
  status: BillingStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  billingInterval: BillingInterval;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  referralProGrantedAt?: string;
  referralProGrantedUntil?: string;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
};

export type PremiumFeatureKey = "fullForYou" | "recommendationExplanations" | "darkMode" | "premiumThemes" | "journeyCardCustomization" | "smartAlerts" | "savedSearches" | "weeklyDigest" | "advancedFilters" | "priorityOpportunityAlerts" | "applicationTracker";

export type FeatureFlag = {
  key: PremiumFeatureKey;
  minimumTier: AccountTier;
  enabled: boolean;
};

export const defaultBillingRecord = (): BillingRecord => ({
  tier: "free",
  status: "free",
  billingInterval: null,
  cancelAtPeriodEnd: false,
  updatedAt: new Date().toISOString(),
});

export const premiumFeatureFlags: Record<PremiumFeatureKey, FeatureFlag> = {
  fullForYou: { key: "fullForYou", minimumTier: "pro", enabled: true },
  recommendationExplanations: { key: "recommendationExplanations", minimumTier: "pro", enabled: true },
  darkMode: { key: "darkMode", minimumTier: "pro", enabled: true },
  premiumThemes: { key: "premiumThemes", minimumTier: "pro", enabled: true },
  journeyCardCustomization: { key: "journeyCardCustomization", minimumTier: "pro", enabled: true },
  smartAlerts: { key: "smartAlerts", minimumTier: "pro", enabled: false },
  savedSearches: { key: "savedSearches", minimumTier: "pro", enabled: false },
  weeklyDigest: { key: "weeklyDigest", minimumTier: "pro", enabled: false },
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
  const allowedStatuses: SubscriptionStatus[] = ["free", "trialing", "active", "past_due", "unpaid", "incomplete", "incomplete_expired", "canceled", "paused"];
  const rawStatus = (input as { status?: unknown }).status;
  const legacyStatus = rawStatus === "inactive" ? "free" : rawStatus;
  const status: SubscriptionStatus = allowedStatuses.includes(legacyStatus as SubscriptionStatus) ? legacyStatus as SubscriptionStatus : "free";
  const billingInterval: BillingInterval = input.billingInterval === "month" || input.billingInterval === "year" ? input.billingInterval : null;
  return {
    tier: status === "active" || status === "trialing" || status === "past_due" ? "pro" : normalizeAccountTier(input.tier),
    status,
    stripeCustomerId: typeof input.stripeCustomerId === "string" ? input.stripeCustomerId : undefined,
    stripeSubscriptionId: typeof input.stripeSubscriptionId === "string" ? input.stripeSubscriptionId : undefined,
    stripePriceId: typeof input.stripePriceId === "string" ? input.stripePriceId : undefined,
    billingInterval,
    currentPeriodStart: typeof input.currentPeriodStart === "string" ? input.currentPeriodStart : undefined,
    currentPeriodEnd: typeof input.currentPeriodEnd === "string" ? input.currentPeriodEnd : undefined,
    referralProGrantedAt: typeof input.referralProGrantedAt === "string" ? input.referralProGrantedAt : undefined,
    referralProGrantedUntil: typeof input.referralProGrantedUntil === "string" ? input.referralProGrantedUntil : undefined,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
  };
}

export function isProUser(billing: BillingRecord | null | undefined) {
  const record = normalizeBillingRecord(billing);
  const referralGrantActive = Boolean(record.referralProGrantedUntil && new Date(record.referralProGrantedUntil) > new Date());
  if (referralGrantActive) return true;
  if (record.referralProGrantedUntil && !record.stripeSubscriptionId) return false;
  if (record.tier !== "pro") return false;
  if (record.status === "active" || record.status === "trialing" || record.status === "past_due") return true;
  if (record.status === "canceled" && record.cancelAtPeriodEnd && record.currentPeriodEnd) return new Date(record.currentPeriodEnd) > new Date();
  return false;
}

export function canAccessProFeature(billing: BillingRecord | null | undefined, featureKey: PremiumFeatureKey) {
  const feature = premiumFeatureFlags[featureKey];
  if (!feature?.enabled) return false;
  if (feature.minimumTier === "free") return true;
  return isProUser(billing);
}

export const canUsePremiumFeature = canAccessProFeature;

export type Entitlements = {
  plan: Plan;
  canUseFullForYou: boolean;
  canViewRecommendationExplanations: boolean;
  canUseDarkMode: boolean;
  canUsePremiumThemes: boolean;
  canCustomizeJourneyCard: boolean;
  canUseSmartAlerts: boolean;
  canUseSavedSearches: boolean;
  canUseWeeklyDigest: boolean;
};

export function getEntitlementsForBilling(billing: BillingRecord | null | undefined): Entitlements {
  const pro = isProUser(billing);
  return {
    plan: pro ? "pro" : "free",
    canUseFullForYou: pro,
    canViewRecommendationExplanations: pro,
    canUseDarkMode: pro,
    canUsePremiumThemes: pro,
    canCustomizeJourneyCard: pro,
    canUseSmartAlerts: false,
    canUseSavedSearches: false,
    canUseWeeklyDigest: false,
  };
}

export type ProPlanId = "pro_monthly" | "pro_annual";

export const proPricing = {
  pro_monthly: { id: "pro_monthly" as const, label: "Monthly", displayPrice: "$4.99/month", interval: "month" as BillingInterval },
  pro_annual: { id: "pro_annual" as const, label: "Annual", displayPrice: "$39.99/year", interval: "year" as BillingInterval },
};

export function normalizeProPlanId(value: unknown): ProPlanId | null {
  return value === "pro_monthly" || value === "pro_annual" ? value : null;
}
