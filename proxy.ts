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
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  const secret = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "unlocked-development-secret");
  if (!secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  if (expected !== signature) return false;
  try {
    const payload = JSON.parse(base64UrlToString(body)) as { v?: number; user?: { id?: string; email?: string }; exp?: string };
    if (payload.v !== 1 || !payload.user?.id || !payload.user.email || !payload.exp) return false;
    return new Date(payload.exp) > new Date();
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasValidSession = await signedSessionIsValid(request.cookies.get(sessionCookieName)?.value);
  if (hasValidSession) return NextResponse.next();

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/profile",
    "/my-opportunities",
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
