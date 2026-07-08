import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AccountData, AuthUser } from "./account-types";

export const sessionCookieName = "unlocked_session";
export const oauthStateCookieName = "unlocked_oauth_state";
const storePath = path.join(process.cwd(), ".unlocked-auth-store.json");

type StoredSession = { tokenHash: string; userId: string; expiresAt: string; createdAt: string };
type StoredUser = AuthUser & { createdAt: string; updatedAt: string };
type AuthStore = {
  users: Record<string, StoredUser>;
  usersByEmail: Record<string, string>;
  sessions: Record<string, StoredSession>;
  accountData: Record<string, AccountData>;
};

type SignedSessionPayload = {
  v: 1;
  user: AuthUser;
  exp: string;
  iat: string;
};

const emptyData = (): AccountData => ({ profile: null, activity: null, journeyProgress: {}, updatedAt: new Date().toISOString() });
const emptyStore = (): AuthStore => ({ users: {}, usersByEmail: {}, sessions: {}, accountData: {} });

function hash(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production.");
  return crypto.createHmac("sha256", secret ?? "unlocked-development-secret").update(value).digest("hex");
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode<T>(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function signPayload(payload: SignedSessionPayload) {
  const body = encode(payload);
  return `${body}.${hash(body)}`;
}

function verifySignedSession(token: string): SignedSessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature || hash(body) !== signature) return null;
  try {
    const payload = decode<SignedSessionPayload>(body);
    if (payload.v !== 1 || !payload.user?.id || !payload.user.email || new Date(payload.exp) <= new Date()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function readStore(): Promise<AuthStore> {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath, "utf8")) as Partial<AuthStore>;
    return {
      users: parsed.users ?? {},
      usersByEmail: parsed.usersByEmail ?? {},
      sessions: parsed.sessions ?? {},
      accountData: parsed.accountData ?? {},
    };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: AuthStore) {
  try {
    await fs.writeFile(storePath, JSON.stringify(store, null, 2));
  } catch (error) {
    console.warn("[UnlockED auth] Development file store write failed; signed cookie session will still work.", error);
  }
}

export function createToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function upsertUser(input: Omit<AuthUser, "id"> & { googleSub: string }) {
  const store = await readStore();
  const email = input.email.toLowerCase();
  const existingId = store.usersByEmail[email];
  const id = existingId ?? `google:${input.googleSub}`;
  const now = new Date().toISOString();
  store.users[id] = { id, email, name: input.name, image: input.image, createdAt: store.users[id]?.createdAt ?? now, updatedAt: now };
  store.usersByEmail[email] = id;
  store.accountData[id] = store.accountData[id] ?? emptyData();
  await writeStore(store);
  console.info("[UnlockED auth] OAuth user upserted", { userId: id, email });
  return store.users[id];
}

export async function createSession(user: AuthUser) {
  const store = await readStore();
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  const payload: SignedSessionPayload = { v: 1, user, exp: expires.toISOString(), iat: new Date().toISOString() };
  const token = signPayload(payload);
  store.sessions[hash(token)] = { tokenHash: hash(token), userId: user.id, expiresAt: expires.toISOString(), createdAt: new Date().toISOString() };
  await writeStore(store);
  console.info("[UnlockED auth] Session created", { userId: user.id, expiresAt: expires.toISOString() });
  return { token, expires };
}

export async function getSession(token: string | undefined) {
  if (!token) return null;
  const signed = verifySignedSession(token);
  if (signed) {
    const store = await readStore();
    return { user: signed.user, data: store.accountData[signed.user.id] ?? emptyData() };
  }
  const store = await readStore();
  const tokenHash = hash(token);
  const session = store.sessions[tokenHash];
  if (!session || new Date(session.expiresAt) <= new Date()) {
    if (session) {
      delete store.sessions[tokenHash];
      await writeStore(store);
    }
    return null;
  }
  const user = store.users[session.userId];
  if (!user) return null;
  return { user, data: store.accountData[user.id] ?? emptyData() };
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  const store = await readStore();
  delete store.sessions[hash(token)];
  await writeStore(store);
}

function uniqueStrings(items: unknown) {
  return Array.isArray(items) ? [...new Set(items.filter((item): item is string => typeof item === "string"))] : [];
}

export async function mergeAccountData(userId: string, incoming: Partial<AccountData>) {
  const store = await readStore();
  const current = store.accountData[userId] ?? emptyData();
  const currentActivity = current.activity;
  const incomingActivity = incoming.activity;
  const tracked = { ...(currentActivity?.tracked ?? {}) };
  for (const [id, record] of Object.entries(incomingActivity?.tracked ?? {})) {
    if (!tracked[id] || record.updatedAt > tracked[id].updatedAt) tracked[id] = record;
  }
  const activity = incomingActivity || currentActivity ? {
    viewed: [...new Set([...uniqueStrings(currentActivity?.viewed), ...uniqueStrings(incomingActivity?.viewed)])],
    saved: [...new Set([...uniqueStrings(currentActivity?.saved), ...uniqueStrings(incomingActivity?.saved), ...Object.keys(tracked)])],
    claimed: [...new Set([...uniqueStrings(currentActivity?.claimed), ...uniqueStrings(incomingActivity?.claimed)])],
    tracked,
  } : null;
  const next: AccountData = {
    profile: incoming.profile ?? current.profile ?? null,
    activity,
    journeyProgress: { ...(current.journeyProgress ?? {}), ...(incoming.journeyProgress ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  store.accountData[userId] = next;
  await writeStore(store);
  return next;
}
