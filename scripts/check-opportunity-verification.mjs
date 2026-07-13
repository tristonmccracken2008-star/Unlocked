import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const opportunities = JSON.parse(fs.readFileSync(path.join(root, "data/db/opportunities.json"), "utf8"));
const intelligence = fs.readFileSync(path.join(root, "data/opportunity-intelligence.ts"), "utf8");
const engine = fs.readFileSync(path.join(root, "data/recommendation-engine.ts"), "utf8");
const config = fs.readFileSync(path.join(root, "data/recommendation-config.ts"), "utf8");
const prefix = "national-curated-2026--";
const allowedStatuses = new Set(["verified", "needs_review", "temporarily_closed", "expired", "broken_source", "archived", "incomplete", "community_reported"]);
const allowedDeadlineTypes = new Set(["fixed", "rolling", "varies", "not_announced", "current_cycle_closed", "no_deadline", "unknown"]);
const national = opportunities.filter((item) => item.id.startsWith(prefix));

assert.equal(national.length, 41, "The national verification audit must cover exactly 41 recent records.");

for (const item of opportunities) {
  assert.ok(allowedStatuses.has(item.verification_status), `${item.id} has unsupported verification status.`);
  assert.ok(allowedDeadlineTypes.has(item.metadata?.deadlineType), `${item.id} has unsupported deadline type.`);
  if (["expired", "archived", "broken_source"].includes(item.verification_status)) {
    assert.equal(item.metadata?.verification?.status, item.verification_status, `${item.id} must mirror excluded verification status in metadata.`);
  }
  if (item.metadata?.deadlineType === "fixed") {
    assert.ok(item.application_deadline, `${item.id} has fixed deadline type without an exact deadline.`);
    assert.equal(item.metadata?.verification?.deadlineVerified, true, `${item.id} fixed deadline must be verified.`);
  }
  if (item.metadata?.deadlineType === "unknown") {
    assert.equal(item.application_deadline, null, `${item.id} unknown deadline must not keep an exact deadline.`);
  }
  if (item.id.startsWith(prefix) && item.verification_status === "verified") {
    assert.ok(item.metadata?.verification?.officialSourceUrl?.startsWith("https://"), `${item.id} verified records need official source metadata.`);
    assert.notEqual(item.metadata?.verification?.eligibilityVerified, false, `${item.id} verified record cannot have explicitly unverified eligibility.`);
  }
}

for (const item of national) {
  assert.ok(item.metadata?.verification, `${item.id} is missing structured verification metadata.`);
  assert.equal(item.metadata.verification.status, item.verification_status, `${item.id} status mismatch.`);
  assert.equal(item.last_verified, "2026-07-13", `${item.id} must have current audit date.`);
  assert.ok(item.reviewer_notes.includes(item.metadata.verification.notes), `${item.id} reviewer notes must expose the verification finding.`);
}

assert.ok(config.includes("verificationQuality"), "Recommendation config must contain centralized verification quality policy.");
assert.ok(config.includes("excludedStatuses"), "Recommendation config must define excluded statuses.");
assert.ok(config.includes("suppressFromPremiumStatuses"), "Recommendation config must define premium suppression statuses.");
assert.ok(intelligence.includes("Details need review before acting"), "Recommendation signals must avoid verified language for needs-review records.");
assert.ok(intelligence.includes("Applications are currently closed"), "Recommendation signals must identify temporarily closed records.");
assert.ok(engine.includes("excludedStatuses.includes(opportunity.verification_status"), "Recommendation engine must exclude archived, expired, and broken-source records.");
assert.ok(engine.includes("Confirm current availability on the official source"), "Recommendation next actions must be conservative for needs-review records.");

console.log(`Opportunity verification checks passed for ${opportunities.length} records, including ${national.length} recent national records.`);
