import { NextResponse } from "next/server";

const safeReturn = /^\/(?:opportunities|discover|p|c)\/[A-Za-z0-9._:%-]+(?:\?[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*)?$/;
export function GET(request: Request) {
  const url = new URL(request.url); const requested = url.searchParams.get("returnTo") || ""; const returnTo = safeReturn.test(requested) ? requested : "/advisor";
  const response = NextResponse.redirect(new URL("/api/auth/google", url.origin)); response.cookies.set("unlocked_return_to", returnTo, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60, path: "/" }); return response;
}
