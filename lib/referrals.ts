import type { AccountData } from "./account-types";
import type { BillingRecord } from "./billing";

export const referralCookieName = "unlocked_referral";
export const referralBaseUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.unlockededu.com").replace(/\/$/, "");

export type ReferralRewardKey = "journey_theme" | "founder_badge" | "one_month_pro" | "premium_theme_pack" | "campus_ambassador";
export type ReferralStatus = "pending" | "completed" | "blocked";

export type ReferralAttribution = {
  code: string;
  referrerUserId: string;
  attachedAt: string;
  creditedAt?: string;
  status: ReferralStatus;
  blockReason?: string;
};

export type ReferralParticipant = {
  userId: string;
  firstName?: string;
  school?: string;
  joinedAt: string;
  completedAt?: string;
  status: ReferralStatus;
  blockReason?: string;
};

export type ReferralRewardRecord = {
  rewardKey: ReferralRewardKey;
  threshold: number;
  label: string;
  unlockedAt: string;
  applied: boolean;
  expiresAt?: string;
};

export type ReferralAccountData = {
  code: string;
  referredBy: ReferralAttribution | null;
  pending: ReferralParticipant[];
  completed: ReferralParticipant[];
  rewardHistory: ReferralRewardRecord[];
  abuseFlags: string[];
  createdAt: string;
  updatedAt: string;
};

export type ReferralAdminSummary = {
  topReferrers: Array<{ userId: string; code: string; completed: number; pending: number; rewards: number; updatedAt: string }>;
  pendingReferrals: Array<{ referrerUserId: string; referredUserId: string; code: string; joinedAt: string }>;
  rewardHistory: Array<{ userId: string; code: string; rewardKey: ReferralRewardKey; threshold: number; unlockedAt: string }>;
  abuseFlags: Array<{ userId: string; code?: string; reason: string; createdAt: string }>;
  updatedAt: string;
};

export const referralRewards: Array<{ key: ReferralRewardKey; threshold: number; label: string; description: string }> = [
  { key: "journey_theme", threshold: 1, label: "Exclusive Journey Card theme", description: "Unlock one premium Journey Card theme." },
  { key: "founder_badge", threshold: 3, label: "Founder profile badge", description: "Show a Founder badge on your Journey Card." },
  { key: "one_month_pro", threshold: 5, label: "1 month Pro", description: "Get one month of UnlockED Pro access." },
  { key: "premium_theme_pack", threshold: 15, label: "Premium theme pack", description: "Unlock all premium Journey Card themes." },
  { key: "campus_ambassador", threshold: 50, label: "Campus Ambassador badge + early access", description: "Join the early ambassador group." },
];

const uniqueParticipants = (items: ReferralParticipant[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.userId || seen.has(item.userId)) return false;
    seen.add(item.userId);
    return true;
  });
};

export function sanitizeReferralCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16) : "";
}

export function referralLinkForCode(code: string) {
  return `${referralBaseUrl()}/r/${sanitizeReferralCode(code)}`;
}

export function normalizeReferralData(value: unknown): ReferralAccountData | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<ReferralAccountData>;
  const code = sanitizeReferralCode(input.code);
  if (!code) return null;
  const now = new Date().toISOString();
  const referredBy = input.referredBy && typeof input.referredBy === "object" && sanitizeReferralCode(input.referredBy.code) && typeof input.referredBy.referrerUserId === "string" ? {
    code: sanitizeReferralCode(input.referredBy.code),
    referrerUserId: input.referredBy.referrerUserId,
    attachedAt: typeof input.referredBy.attachedAt === "string" ? input.referredBy.attachedAt : now,
    creditedAt: typeof input.referredBy.creditedAt === "string" ? input.referredBy.creditedAt : undefined,
    status: input.referredBy.status === "completed" || input.referredBy.status === "blocked" ? input.referredBy.status : "pending",
    blockReason: typeof input.referredBy.blockReason === "string" ? input.referredBy.blockReason : undefined,
  } satisfies ReferralAttribution : null;
  const normalizeParticipant = (item: unknown): ReferralParticipant | null => {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Partial<ReferralParticipant>;
    if (typeof candidate.userId !== "string") return null;
    return {
      userId: candidate.userId,
      firstName: typeof candidate.firstName === "string" ? candidate.firstName.slice(0, 60) : undefined,
      school: typeof candidate.school === "string" ? candidate.school.slice(0, 120) : undefined,
      joinedAt: typeof candidate.joinedAt === "string" ? candidate.joinedAt : now,
      completedAt: typeof candidate.completedAt === "string" ? candidate.completedAt : undefined,
      status: candidate.status === "completed" || candidate.status === "blocked" ? candidate.status : "pending",
      blockReason: typeof candidate.blockReason === "string" ? candidate.blockReason : undefined,
    };
  };
  const rewardHistory = Array.isArray(input.rewardHistory) ? input.rewardHistory.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const reward = item as Partial<ReferralRewardRecord>;
    const config = referralRewards.find((candidate) => candidate.key === reward.rewardKey);
    if (!config) return [];
    return [{
      rewardKey: config.key,
      threshold: typeof reward.threshold === "number" ? reward.threshold : config.threshold,
      label: typeof reward.label === "string" ? reward.label : config.label,
      unlockedAt: typeof reward.unlockedAt === "string" ? reward.unlockedAt : now,
      applied: reward.applied !== false,
      expiresAt: typeof reward.expiresAt === "string" ? reward.expiresAt : undefined,
    }];
  }).slice(-100) : [];
  return {
    code,
    referredBy,
    pending: uniqueParticipants((Array.isArray(input.pending) ? input.pending : []).map(normalizeParticipant).filter((item): item is ReferralParticipant => Boolean(item))).slice(-200),
    completed: uniqueParticipants((Array.isArray(input.completed) ? input.completed : []).map(normalizeParticipant).filter((item): item is ReferralParticipant => Boolean(item))).slice(-500),
    rewardHistory,
    abuseFlags: Array.isArray(input.abuseFlags) ? input.abuseFlags.filter((item): item is string => typeof item === "string").slice(-50) : [],
    createdAt: typeof input.createdAt === "string" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : now,
  };
}

export function completedReferralCount(referrals: ReferralAccountData | null | undefined) {
  return normalizeReferralData(referrals)?.completed.length ?? 0;
}

export function hasReferralReward(referrals: ReferralAccountData | null | undefined, key: ReferralRewardKey) {
  return Boolean(normalizeReferralData(referrals)?.rewardHistory.some((reward) => reward.rewardKey === key));
}

export function canUseReferralJourneyThemes(referrals: ReferralAccountData | null | undefined) {
  return hasReferralReward(referrals, "journey_theme") || hasReferralReward(referrals, "premium_theme_pack");
}

export function canShowFounderBadge(referrals: ReferralAccountData | null | undefined) {
  return hasReferralReward(referrals, "founder_badge") || hasReferralReward(referrals, "campus_ambassador");
}

export function nextReferralReward(referrals: ReferralAccountData | null | undefined) {
  const count = completedReferralCount(referrals);
  return referralRewards.find((reward) => reward.threshold > count) ?? referralRewards[referralRewards.length - 1];
}

export function newlyUnlockedReferralRewards(previousCompleted: number, nextCompleted: number) {
  return referralRewards.filter((reward) => previousCompleted < reward.threshold && nextCompleted >= reward.threshold);
}

export function applyReferralProGrant(billing: BillingRecord, nowIso: string) {
  const now = new Date(nowIso);
  const currentGrant = billing.referralProGrantedUntil ? new Date(billing.referralProGrantedUntil) : null;
  const currentPaidEnd = billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd) : null;
  const base = [now, currentGrant, currentPaidEnd].filter((date): date is Date => Boolean(date && !Number.isNaN(date.getTime()))).sort((a, b) => b.getTime() - a.getTime())[0] ?? now;
  const grantedUntil = new Date(base);
  grantedUntil.setMonth(grantedUntil.getMonth() + 1);
  return {
    ...billing,
    tier: "pro" as const,
    status: billing.status === "active" || billing.status === "trialing" || billing.status === "past_due" ? billing.status : "active" as const,
    referralProGrantedAt: nowIso,
    referralProGrantedUntil: grantedUntil.toISOString(),
    updatedAt: nowIso,
  };
}

export function accountReferralSummary(data: AccountData | null | undefined) {
  const referrals = normalizeReferralData(data?.referrals);
  return {
    code: referrals?.code ?? "",
    link: referrals?.code ? referralLinkForCode(referrals.code) : "",
    completed: referrals?.completed.length ?? 0,
    pending: referrals?.pending.length ?? 0,
    nextReward: nextReferralReward(referrals),
  };
}
