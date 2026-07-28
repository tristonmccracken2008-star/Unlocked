import "server-only";

import crypto from "node:crypto";
import { requiredAuthSecret } from "@/lib/security";

export const opportunityReportIssueTypes = [
  "incorrect_deadline",
  "incorrect_eligibility",
  "incorrect_value",
  "broken_official_source",
  "opportunity_closed",
  "duplicate_listing",
  "other",
] as const;

export type OpportunityReportIssue = typeof opportunityReportIssueTypes[number];

export type OpportunityReport = {
  id: string;
  opportunityId: string;
  issue: OpportunityReportIssue;
  detail?: string;
  reporterHash: string;
  createdAt: string;
};

const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const reportKey = "unlocked:content:opportunity-reports";
const memoryReports: OpportunityReport[] = [];
const memoryIdempotency = new Set<string>();

async function command<T>(args: string[]): Promise<T | null> {
  if (!kvUrl || !kvToken) {
    const [operation, key, value] = args;
    if (operation === "SET" && key.startsWith("unlocked:content:opportunity-report-request:")) {
      if (memoryIdempotency.has(key)) return null;
      memoryIdempotency.add(key);
      return "OK" as T;
    }
    if (operation === "LPUSH" && key === reportKey) {
      memoryReports.unshift(JSON.parse(value) as OpportunityReport);
      return memoryReports.length as T;
    }
    if (operation === "LTRIM" && key === reportKey) {
      memoryReports.splice(Number(args[3]) + 1);
      return "OK" as T;
    }
    if (operation === "LRANGE" && key === reportKey) {
      return memoryReports.slice(Number(value), Number(args[3]) + 1).map((report) => JSON.stringify(report)) as T;
    }
    throw new Error(`Unsupported opportunity report store operation: ${operation}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_200);
  try {
    const response = await fetch(kvUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Opportunity report store failed: ${response.status}`);
    return ((await response.json()) as { result: T | null }).result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Opportunity report store timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function requireWritableStore() {
  if ((!kvUrl || !kvToken) && process.env.NODE_ENV === "production") {
    throw new Error("Production opportunity report storage is not configured.");
  }
}

export function opportunityReporterHash(userId: string) {
  return crypto.createHmac("sha256", requiredAuthSecret()).update(`opportunity-report:${userId}`).digest("hex").slice(0, 32);
}

export async function saveOpportunityReport(input: Omit<OpportunityReport, "id" | "createdAt">, idempotencyKey: string) {
  requireWritableStore();
  const requestKey = `unlocked:content:opportunity-report-request:${crypto.createHash("sha256").update(idempotencyKey).digest("hex")}`;
  const claimed = await command<string>(["SET", requestKey, "1", "NX", "EX", "86400"]);
  if (!claimed) return { duplicate: true, report: null };
  const report: OpportunityReport = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await command(["LPUSH", reportKey, JSON.stringify(report)]);
  await command(["LTRIM", reportKey, "0", "1999"]);
  return { duplicate: false, report };
}

export async function readOpportunityReports(limit = 500) {
  const bounded = Math.min(2_000, Math.max(1, Math.floor(limit)));
  const values = await command<string[]>(["LRANGE", reportKey, "0", String(bounded - 1)]) ?? [];
  return values.flatMap((value) => {
    try {
      const report = JSON.parse(value) as OpportunityReport;
      return report?.id && report?.opportunityId && opportunityReportIssueTypes.includes(report.issue) ? [report] : [];
    } catch {
      return [];
    }
  });
}

export async function opportunityReportSummary(limit = 2_000) {
  const reports = await readOpportunityReports(limit);
  const grouped = new Map<string, { total: number; reporters: Set<string>; issues: Map<OpportunityReportIssue, number>; latestAt: string }>();
  for (const report of reports) {
    const current = grouped.get(report.opportunityId) ?? { total: 0, reporters: new Set<string>(), issues: new Map<OpportunityReportIssue, number>(), latestAt: report.createdAt };
    current.total += 1;
    current.reporters.add(report.reporterHash);
    current.issues.set(report.issue, (current.issues.get(report.issue) ?? 0) + 1);
    if (report.createdAt > current.latestAt) current.latestAt = report.createdAt;
    grouped.set(report.opportunityId, current);
  }
  return [...grouped.entries()].map(([opportunityId, value]) => ({
    opportunityId,
    total: value.total,
    independentReporters: value.reporters.size,
    issues: [...value.issues.entries()].sort((left, right) => right[1] - left[1]),
    latestAt: value.latestAt,
  })).sort((left, right) => right.independentReporters - left.independentReporters || right.total - left.total || right.latestAt.localeCompare(left.latestAt));
}
