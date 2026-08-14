import assert from "node:assert/strict";
import { buildRecommendationSafeCatalogAudit } from "../data/recommendation-safe-catalog";
import { validateOpportunityData } from "../data/recommendation-professional-pipeline";
import { opportunities } from "../data/opportunities";

const audit = buildRecommendationSafeCatalogAudit(opportunities);
assert.equal(audit.records.length, opportunities.length, "Every catalog record must receive a safety audit.");
assert.equal(audit.totals.recommendationSafe, opportunities.filter((opportunity) => validateOpportunityData(opportunity).allowed).length, "Audit totals must use the production recommendation gate.");
assert.ok(audit.queue.every((record, index) => index === 0 || audit.queue[index - 1].priority >= record.priority), "Review queue must be deterministically priority ordered.");

for (const opportunity of opportunities) {
  const fieldEvidence = opportunity.metadata.eligibilityRules?.fieldEvidence;
  if (!fieldEvidence) continue;
  for (const [field, evidence] of Object.entries(fieldEvidence)) {
    assert.ok(evidence, `${opportunity.id}.${field} must contain evidence.`);
    assert.match(evidence.sourceUrl, /^https:\/\//, `${opportunity.id}.${field} must use an HTTPS evidence source.`);
    assert.match(evidence.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${opportunity.id}.${field} must have a verification date.`);
    assert.notEqual(evidence.state, "unreviewed", `${opportunity.id}.${field} must not store an unreviewed entry as evidence.`);
  }
}

const suli = opportunities.find((opportunity) => opportunity.id.includes("doe-science-undergraduate-laboratory-internships"));
assert.ok(suli, "SULI fixture must exist.");
assert.equal(validateOpportunityData(suli).allowed, true, `SULI should be recommendation-safe: ${validateOpportunityData(suli).reasons.join("; ")}`);
assert.equal(suli.metadata.eligibilityRules?.citizenshipStatuses?.includes("international_allowed"), false, "SULI must not infer international eligibility.");
assert.equal(suli.metadata.eligibilityRules?.minimumGpa, 3, "SULI must preserve the official GPA restriction.");

const cls = opportunities.find((opportunity) => opportunity.id === "scholarship--critical-language-scholarship");
assert.ok(cls && !validateOpportunityData(cls).allowed, "CLS must remain blocked until the 2027 application cycle is actionable and verified.");
console.log(JSON.stringify({ records: audit.totals.records, recommendationSafe: audit.totals.recommendationSafe, needsReview: audit.totals.needsReview, topBlockers: Object.entries(audit.blockerCounts).slice(0, 8) }, null, 2));
