import "server-only";

import crypto from "node:crypto";
import { constantTimeEqual, requiredAuthSecret } from "./security";

export const returnExperienceCookieName = "unlocked_return_seen";
type Receipt = { v: 1; account: string; seenAt: string };

function digest(value: string) {
  return crypto.createHmac("sha256", requiredAuthSecret()).update(value).digest("base64url");
}

function accountKey(userId: string) {
  return digest(`return-account:${userId}`).slice(0, 24);
}

export function createReturnExperienceReceipt(userId: string, now = new Date()) {
  const payload: Receipt = { v: 1, account: accountKey(userId), seenAt: now.toISOString() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${digest(encoded)}`;
}

export function readReturnExperienceReceipt(value: string | undefined, userId: string) {
  if (!value) return undefined;
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra || !constantTimeEqual(digest(encoded), signature)) return undefined;
  try {
    const receipt = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<Receipt>;
    const timestamp = Date.parse(receipt.seenAt ?? "");
    if (receipt.v !== 1 || receipt.account !== accountKey(userId) || !Number.isFinite(timestamp) || timestamp > Date.now() + 60_000 || timestamp < Date.now() - 180 * 86_400_000) return undefined;
    return new Date(timestamp).toISOString();
  } catch {
    return undefined;
  }
}
