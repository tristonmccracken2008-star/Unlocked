import crypto from "node:crypto";
import { appOrigin } from "./security";

export type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
};

export function appUrl() {
  return appOrigin();
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  return { clientId, clientSecret, redirectUri: `${appUrl()}/api/auth/callback/google` };
}

export function createOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function createOAuthCodeVerifier() {
  return crypto.randomBytes(48).toString("base64url");
}

export function oauthCodeChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function googleAuthUrl(state: string, codeChallenge: string) {
  const { clientId, redirectUri } = googleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    include_granted_scopes: "false",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function googleFetch(url: string, init: RequestInit, label: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error(`${label} timed out.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function exchangeGoogleCode(code: string, codeVerifier: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier)) throw new Error("OAuth code verifier is invalid.");
  const { clientId, clientSecret, redirectUri } = googleConfig();
  const response = await googleFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, code_verifier: codeVerifier, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  }, "Google token exchange");
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
  const token = await response.json() as { access_token?: string };
  if (!token.access_token) throw new Error("Google token exchange did not return an access token.");
  const userResponse = await googleFetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } }, "Google user lookup");
  if (!userResponse.ok) throw new Error(`Google userinfo failed: ${userResponse.status}`);
  const user = await userResponse.json() as Partial<GoogleUserInfo>;
  if (!user.email_verified || typeof user.sub !== "string" || !user.sub || typeof user.email !== "string" || !user.email || typeof user.name !== "string" || !user.name) {
    throw new Error("Google account identity is incomplete or unverified.");
  }
  return {
    sub: user.sub.slice(0, 255),
    email: user.email.trim().toLowerCase().slice(0, 320),
    email_verified: true,
    name: user.name.trim().slice(0, 160),
    picture: typeof user.picture === "string" && user.picture.startsWith("https://") ? user.picture.slice(0, 2048) : undefined,
  } satisfies GoogleUserInfo;
}
