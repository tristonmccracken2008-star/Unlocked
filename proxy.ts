import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = "unlocked_session";

function base64UrlToString(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(base64);
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signedSessionIsValid(token: string | undefined) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, signature] = parts;
  if (!body || !signature) return false;
  const secret = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "unlocked-development-secret");
  if (!secret || process.env.NODE_ENV === "production" && new TextEncoder().encode(secret).byteLength < 32) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  if (!/^[a-f0-9]{64}$/.test(signature) || expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  if (mismatch !== 0) return false;
  try {
    const payload = JSON.parse(base64UrlToString(body)) as { v?: number; sid?: string; exp?: string };
    if (payload.v !== 2 || !payload.sid || !payload.exp) return false;
    return new Date(payload.exp) > new Date();
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasValidSession = await signedSessionIsValid(request.cookies.get(sessionCookieName)?.value);
  if (hasValidSession) return NextResponse.next();

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : request.nextUrl.origin);
  return NextResponse.redirect(new URL("/", configuredOrigin));
}

export const config = {
  matcher: [
    "/profile",
    "/my-opportunities",
    "/advisor",
    "/onboarding",
    "/referral",
    "/billing/success",
    "/admin/:path*",
    "/opportunities",
    "/opportunities/:path*",
    "/benefits",
    "/benefits/:path*",
    "/scholarships",
    "/research",
    "/career",
    "/build-career",
    "/ai",
    "/student-ai-tools",
    "/university",
    "/schools",
    "/schools/:path*",
    "/categories",
    "/categories/:path*",
    "/software",
    "/student-discounts",
    "/best-edu-email-perks",
    "/free-student-software",
    "/save-money",
    "/get-ahead",
    "/local",
    "/financial",
    "/updates",
    "/submit-perk",
    "/school-not-found",
  ],
};
