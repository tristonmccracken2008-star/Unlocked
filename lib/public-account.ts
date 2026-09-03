import "server-only";
import crypto from "node:crypto";
import type { AccountData, AccountSession, AuthUser } from "./account-types";
import { requiredAuthSecret } from "./security";

function publicUserId(userId: string) {
  return `user_${crypto.createHmac("sha256", requiredAuthSecret()).update(`public:${userId}`).digest("hex").slice(0, 24)}`;
}

export function redactInternalIdentifiers<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactInternalIdentifiers(item)) as T;
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (["userId", "studentId", "referrerUserId", "referredUserId"].includes(key)) output[key] = "self";
    else output[key] = redactInternalIdentifiers(entry);
  }
  return output as T;
}

export function publicAccountData(data: AccountData): AccountData {
  return {
    ...data,
    // Materials can contain private notes and are loaded only by their dedicated authenticated surfaces.
    applicationMaterials: undefined,
    // Resume Lab includes private contact details, facts, and drafts.
    resumeLab: undefined,
    // Application Studio drafts, notes, and recommender details load only on the authenticated application route.
    applicationWorkspaces: Object.fromEntries(Object.entries(data.applicationWorkspaces ?? {}).map(([id, workspace]) => [id, { ...workspace, writtenResponses: undefined, recommenders: undefined, privateNotes: undefined, submissionSnapshots: undefined }])),
    // Answer Bank entries contain private factual stories.
    answerBank: undefined,
    // Accomplishments can contain private notes and are loaded only by their
    // dedicated authenticated surface, never through the general client sync.
    accomplishments: undefined,
    billing: {
      ...data.billing,
      stripeCustomerId: undefined,
      stripeSubscriptionId: undefined,
      stripePriceId: undefined,
      stripeEventId: undefined,
      stripeEventCreatedAt: undefined,
      hasStripeCustomer: Boolean(data.billing.stripeCustomerId),
      hasStripeSubscription: Boolean(data.billing.stripeSubscriptionId),
    },
    advisor: data.advisor ? redactInternalIdentifiers(data.advisor) : null,
    referrals: data.referrals ? {
      ...data.referrals,
      referredBy: data.referrals.referredBy ? { ...data.referrals.referredBy, referrerUserId: "self", blockReason: undefined } : null,
      pending: data.referrals.pending.map((item) => ({ ...item, userId: "self", blockReason: undefined })),
      completed: data.referrals.completed.map((item) => ({ ...item, userId: "self", blockReason: undefined })),
      abuseFlags: [],
    } : null,
  };
}

export function publicAuthUser(user: AuthUser): AuthUser {
  return { ...user, id: publicUserId(user.id) };
}

export function publicAccountSession(session: { user: AuthUser; data: AccountData }): AccountSession {
  return { authenticated: true, user: publicAuthUser(session.user), data: publicAccountData(session.data) };
}
