import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = "unlocked_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(sessionCookieName)?.value);
  if (hasSessionCookie) return NextResponse.next();

  if (pathname.startsWith("/admin")) return NextResponse.redirect(new URL("/api/auth/google", request.url));
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/profile", "/my-opportunities", "/admin/:path*"],
};
