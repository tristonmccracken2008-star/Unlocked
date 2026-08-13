import assert from "node:assert/strict";
import { opportunities } from "../data/opportunities";
import { findRelatedDiscoverOpportunities } from "../lib/discover-related";
import { projectOpportunityTrust } from "../data/opportunity-trust";

const catalog = opportunities.filter((item) => !["archived", "broken_source", "expired"].includes(item.verification_status));
const sampleIds = [
  "benefit--github-student-developer-pack",
  "scholarship--goldwater-scholarship",
  "career--google-student-internships",
  "research--nsf-reu-sites",
];

for (const id of sampleIds) {
  const item = catalog.find((candidate) => candidate.id === id);
  assert.ok(item, `Missing discovery-quality fixture ${id}.`);
  const related = findRelatedDiscoverOpportunities(item, catalog, 3);
  assert.ok(related.length > 0 && related.length <= 3, `${item.title} must expose a bounded exploration chain.`);
  assert.equal(new Set(related.map((candidate) => candidate.id)).size, related.length, "Related exploration must not contain duplicates.");
  assert.ok(related.every((candidate) => candidate.id !== item.id), "Related exploration must exclude the current opportunity.");
  assert.ok(related.every((candidate) => !["archived", "broken_source", "expired"].includes(candidate.verification_status)), "Related exploration must suppress unreliable records.");
}

const coverage = {
  paid: opportunities.filter((item) => item.paid !== null).length,
  remote: opportunities.filter((item) => item.remote !== null).length,
  difficulty: opportunities.filter((item) => item.difficulty !== null).length,
  verifiedDeadline: opportunities.filter((item) => projectOpportunityTrust(item).deadline.state === "verified").length,
};
assert.ok(coverage.paid < opportunities.length / 2 && coverage.remote < opportunities.length / 2, "Sparse fields must remain secondary filters until catalog coverage improves.");
assert.ok(coverage.verifiedDeadline > 0, "The catalog must retain at least one confirmed deadline for trusted sorting.");

console.log(`Discovery quality checks passed (${catalog.length.toLocaleString()} public records; ${coverage.verifiedDeadline} confirmed deadlines).`);
