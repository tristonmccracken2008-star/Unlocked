import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  opportunityReporterHash,
  opportunityReportIssueTypes,
  saveOpportunityReport,
} from "../lib/opportunity-report-store";

assert.deepEqual(opportunityReportIssueTypes, [
  "incorrect_deadline",
  "incorrect_eligibility",
  "incorrect_value",
  "broken_official_source",
  "opportunity_closed",
  "duplicate_listing",
  "other",
], "Opportunity reports must use a bounded issue taxonomy.");

const reporterHash = opportunityReporterHash("test-user");
assert.equal(reporterHash.length, 32, "Reporter identity must be represented by a bounded pseudonymous hash.");
assert.doesNotMatch(reporterHash, /test-user/, "Stored reports must not expose the account identifier.");

const idempotencyKey = `discover-report-test:${crypto.randomUUID()}`;
const first = await saveOpportunityReport({
  opportunityId: "test-opportunity",
  issue: "incorrect_deadline",
  detail: "The official provider published a different date.",
  reporterHash,
}, idempotencyKey);
const duplicate = await saveOpportunityReport({
  opportunityId: "test-opportunity",
  issue: "incorrect_deadline",
  detail: "The official provider published a different date.",
  reporterHash,
}, idempotencyKey);
assert.equal(first.duplicate, false, "The first structured report must be stored.");
assert.equal(duplicate.duplicate, true, "A replayed report request must be idempotent.");

const route = readFileSync("app/api/opportunities/report/route.ts", "utf8");
for (const token of ["assertSameOrigin(request)", "getSession", "enforceRateLimit", "readBoundedJson", "listPublishedOpportunitiesByIds", "saveOpportunityReport"]) {
  assert.ok(route.includes(token), `Opportunity reporting must preserve ${token}.`);
}
assert.doesNotMatch(route, /email|profile|GPA|stripe/i, "Opportunity reporting must not persist unrelated account data.");

const component = readFileSync("components/report-outdated-button.tsx", "utf8");
assert.ok(component.includes("/api/opportunities/report"), "The report control must submit to the structured endpoint.");
assert.doesNotMatch(component, /mailto:/, "The report control must not depend on an email client.");

console.log("Opportunity report checks passed.");
