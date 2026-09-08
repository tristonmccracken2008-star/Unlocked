import { NextResponse } from "next/server";
import { getServerSessionForProduct } from "@/lib/onboarding";
import { collegeFilterOptions, searchColleges, type CollegeQuery } from "@/lib/colleges";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";

const bounded = (params: URLSearchParams, key: string, max = 100) => params.get(key)?.trim().slice(0, max) || undefined;
const decimal = (params: URLSearchParams, key: string) => {
  if (!params.has(key)) return undefined;
  const value = Number(params.get(key));
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;
};

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    await enforceRateLimit(request, "college-catalog", 180, 60);
    const session = await getServerSessionForProduct();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (session.data.educationalStage !== "high_school") return NextResponse.json({ error: "College Explorer is available in High School UnlockED." }, { status: 403 });
    const params = new URL(request.url).searchParams;
    const query: CollegeQuery = {
      query: bounded(params, "q", 120), state: bounded(params, "state", 2), region: bounded(params, "region"), ownership: bounded(params, "ownership"),
      setting: bounded(params, "setting"), size: bounded(params, "size"), program: bounded(params, "program", 2), designation: bounded(params, "designation", 12),
      minAcceptance: decimal(params, "minAcceptance"), maxAcceptance: decimal(params, "maxAcceptance"), minGraduation: decimal(params, "minGraduation"),
      maxNetPrice: params.has("maxNetPrice") ? Math.max(0, Number(params.get("maxNetPrice"))) : undefined,
      page: Math.max(1, Number(params.get("page") || 1)), limit: 18,
    };
    const body = searchColleges(query);
    return NextResponse.json({ ...body, filters: params.get("includeFilters") === "true" ? collegeFilterOptions : undefined }, {
      headers: { "Cache-Control": "private, max-age=30", "Server-Timing": `college-catalog;dur=${(performance.now() - startedAt).toFixed(1)}` },
    });
  } catch (error) {
    return securityErrorResponse(error, "College catalog is temporarily unavailable.");
  }
}
