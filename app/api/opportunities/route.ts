import { NextResponse } from "next/server";
import { listingDifficultyOptions, listingOpportunityTypes, type DiscoverSortMode } from "@/data/opportunity-listing";
import { listPublishedOpportunities, listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildDiscoverCatalog, type DiscoverCatalogQuery } from "@/lib/discover-catalog";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const deadlineOptions = new Set(["All", "published", "upcoming", "rolling", "not_announced"]);
const sortOptions = new Set<DiscoverSortMode>(["Relevant", "Newest", "Deadline", "Alphabetical"]);

function boundedParam(params: URLSearchParams, key: string, fallback = "All", maxLength = 120) {
  const value = params.get(key)?.trim() || fallback;
  return value.slice(0, maxLength);
}

function discoverQuery(params: URLSearchParams): DiscoverCatalogQuery {
  const requestedType = boundedParam(params, "type");
  const difficulty = boundedParam(params, "difficulty");
  const deadline = boundedParam(params, "deadline");
  const sort = boundedParam(params, "sort", "Relevant") as DiscoverSortMode;
  const requestedLimit = Number(params.get("limit") ?? 16);
  return {
    query: boundedParam(params, "query", "", 120),
    type: listingOpportunityTypes.includes(requestedType as never) ? requestedType as DiscoverCatalogQuery["type"] : "All",
    category: boundedParam(params, "category", "All", 80),
    major: boundedParam(params, "major", "All", 80),
    school: boundedParam(params, "school", "All", 160),
    paid: boundedParam(params, "paid"),
    remote: boundedParam(params, "remote"),
    difficulty: listingDifficultyOptions.includes(difficulty as never) ? difficulty as DiscoverCatalogQuery["difficulty"] : "All",
    freshmanFriendly: params.get("freshmanFriendly") === "true",
    deadline: deadlineOptions.has(deadline) ? deadline : "All",
    sort: sortOptions.has(sort) ? sort : "Relevant",
    limit: Number.isFinite(requestedLimit) ? Math.min(64, Math.max(16, Math.floor(requestedLimit))) : 16,
  };
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    await enforceRateLimit(request, "opportunity-catalog", 180, 60);
    const params = new URL(request.url).searchParams;
    const rawIds = params.get("ids");
    const ids = rawIds?.split(",").map((item) => item.trim()).filter(Boolean);
    if (ids && (ids.length > 100 || ids.some((id) => !idPattern.test(id)))) {
      return NextResponse.json({ error: "Invalid opportunity IDs" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    if (ids) {
      const opportunities = await listPublishedOpportunitiesByIds(ids);
      return NextResponse.json({ opportunities }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300", "Server-Timing": `catalog;dur=${(performance.now() - startedAt).toFixed(1)}` } });
    }
    const opportunities = await listPublishedOpportunities();
    const body = params.get("view") === "discover" ? buildDiscoverCatalog(opportunities, discoverQuery(params)) : { opportunities };
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300", "Server-Timing": `catalog;dur=${(performance.now() - startedAt).toFixed(1)}` } });
  } catch (error) {
    console.error("[UnlockED content] public catalog failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Opportunity catalog unavailable.");
  }
}
