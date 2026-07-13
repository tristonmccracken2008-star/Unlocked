import assert from "node:assert/strict";
import fs from "node:fs";

const opportunities = JSON.parse(fs.readFileSync("data/db/opportunities.json", "utf8"));
const normalize = (value) => String(value ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
const sentenceDuplicates = (value) => {
  const sentences = String(value ?? "").split(/(?<=[.!?])\s+/).map(normalize).filter((sentence) => sentence.length > 20);
  return new Set(sentences).size !== sentences.length;
};
const semanticGroups = new Map();

for (const opportunity of opportunities) {
  const key = `${normalize(opportunity.title)}|${normalize(opportunity.organization)}`;
  semanticGroups.set(key, [...(semanticGroups.get(key) ?? []), opportunity.id]);
  assert.equal(sentenceDuplicates(opportunity.description), false, `${opportunity.id} repeats description sentences.`);
  assert.notEqual(opportunity.id, "research--nasa-ostem-internships", "Superseded NASA OSTEM duplicate must stay removed.");
  if (opportunity.id.startsWith("v1-school-resource--")) {
    assert.equal(opportunity.verification_status, "needs_review", `${opportunity.id} cannot be verified without office-level review.`);
    assert.equal(opportunity.metadata?.verification?.eligibilityVerified, false, `${opportunity.id} must expose incomplete eligibility verification.`);
  }
  if (opportunity.metadata?.verification?.status) assert.equal(opportunity.metadata.verification.status, opportunity.verification_status, `${opportunity.id} has contradictory verification statuses.`);
  if (opportunity.school_scope === "School Specific") assert.ok(opportunity.schools?.length, `${opportunity.id} is school-specific without a school.`);
  if (opportunity.school_scope === "National") assert.equal(opportunity.schools?.length ?? 0, 0, `${opportunity.id} is national but has school restrictions.`);
  if (opportunity.metadata?.deadlineType === "fixed") assert.ok(opportunity.application_deadline, `${opportunity.id} has a fixed deadline without a date.`);
  if (opportunity.metadata?.deadlineType === "unknown") assert.equal(opportunity.application_deadline, null, `${opportunity.id} has an exact date with unknown deadline status.`);
}

const semanticDuplicates = [...semanticGroups.entries()].filter(([, ids]) => ids.length > 1);
assert.deepEqual(semanticDuplicates, [], `Semantic duplicate opportunities remain: ${JSON.stringify(semanticDuplicates.slice(0, 5))}`);

const statusCounts = Object.fromEntries([...new Set(opportunities.map((item) => item.verification_status))].sort().map((status) => [status, opportunities.filter((item) => item.verification_status === status).length]));
const uncertainVerified = opportunities.filter((item) => item.verification_status === "verified" && /eligibility varies|requirements vary|eligibility depends|check official source|confirm current eligibility|site specific|project specific|program specific|institution specific|not documented|unknown/i.test([
  item.eligibility,
  item.metadata?.citizenship,
  item.metadata?.internationalEligibility,
  ...(item.metadata?.eligibilityNotes ?? []),
  ...(item.metadata?.applicationRequirements ?? []),
].join(" "))).length;

console.log(JSON.stringify({
  opportunities: opportunities.length,
  statusCounts,
  semanticDuplicates: semanticDuplicates.length,
  repeatedDescriptions: opportunities.filter((item) => sentenceDuplicates(item.description)).length,
  generatedSchoolRecordsAwaitingReview: opportunities.filter((item) => item.id.startsWith("v1-school-resource--")).length,
  verifiedRecordsSuppressedForUncertainEligibility: uncertainVerified,
}, null, 2));
