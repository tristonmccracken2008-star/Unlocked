import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = "unlocked_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(sessionCookieName)?.value);
  if (hasSessionCookie) return NextResponse.next();

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/profile",
    "/my-opportunities",
    "/admin/:path*",
    "/opportunities/:path*",
    "/benefits/:path*",
    "/scholarships",
    "/research",
    "/career",
    "/build-career",
    "/ai",
    "/student-ai-tools",
    "/university",
    "/schools/:path*",
    "/categories/:path*",
  ],
};
