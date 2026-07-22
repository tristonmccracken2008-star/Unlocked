import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { opportunityDuplicateManifest, duplicateCanonicalId, isCanonicalCatalogOpportunity } from "../data/opportunity-catalog-canonical";
import { opportunities, type Opportunity } from "../data/opportunities";
import {
  assessOpportunityFreshness,
  buildOpportunityCatalogIndex,
  detectOpportunityDuplicateGroups,
  mergeDuplicateOpportunityMetadata,
  opportunityPlatformVersion,
  refreshOpportunityCatalogProfile,
} from "../data/opportunity-platform";
import { buildOpportunityRelationshipIndex, getOpportunityRelationship } from "../data/opportunity-relationships";
import { validateOpportunityData } from "../data/recommendation-professional-pipeline";

const startedAt = performance.now();
const index = buildOpportunityCatalogIndex(opportunities, { now: new Date("2026-07-22T12:00:00Z") });
const elapsedMs = performance.now() - startedAt;
const profiles = [...index.profiles.values()];

assert.equal(index.version, opportunityPlatformVersion);
assert.equal(index.profiles.size, opportunities.length, "Every catalog record must receive an intelligence profile.");
assert.deepEqual(index.duplicateGroups, opportunityDuplicateManifest.groups, "Committed duplicate manifest must match deterministic detection.");
assert.ok(index.duplicateGroups.length >= 8, "Production duplicate detection must retain the known duplicate groups.");
assert.ok(elapsedMs < 5_000, `A full 5,991-record intelligence refresh must remain operationally bounded; received ${elapsedMs.toFixed(2)}ms.`);

for (const profile of profiles) {
  const opportunity = opportunities.find((item) => item.id === profile.opportunityId)!;
  if (["expired", "archived", "broken_source"].includes(opportunity.verification_status)) assert.equal(profile.recommendationEligible, false, `${opportunity.id} must not rank.`);
  if (profile.eligibility.criticalUnknowns.length) assert.equal(profile.recommendationEligible, false, `${opportunity.id} has unresolved eligibility.`);
  if (profile.duplicate.duplicateOf) assert.equal(profile.recommendationEligible, false, `${opportunity.id} is a secondary duplicate.`);
  if (profile.recommendationEligible) {
    assert.equal(profile.confidence.tier, "high_confidence", `${opportunity.id} must reach high confidence before ranking.`);
    assert.equal(profile.eligibility.recommendationEligibilityStatus, "eligible_for_ranking", `${opportunity.id} must pass canonical eligibility.`);
  }
}

const eligibleProfiles = profiles.filter((profile) => profile.recommendationEligible);
const partialProfiles = profiles.filter((profile) => profile.confidence.tier === "partially_verified");
assert.ok(eligibleProfiles.length >= 130, `Verified unique recommendation inventory regressed: ${eligibleProfiles.length}.`);
assert.ok(partialProfiles.length > 0, "Uncertain records must remain distinguishable as partially verified.");
assert.ok(partialProfiles.every((profile) => !profile.recommendationEligible), "Partially verified records must fail closed for Pro.");

for (const group of index.duplicateGroups) {
  assert.equal(isCanonicalCatalogOpportunity(group.canonicalId), true);
  for (const id of group.ids.filter((id) => id !== group.canonicalId)) {
    assert.equal(duplicateCanonicalId(id), group.canonicalId);
    const opportunity = opportunities.find((item) => item.id === id)!;
    assert.equal(validateOpportunityData(opportunity).allowed, false, `${id} must be suppressed by the professional gate.`);
  }
  const merged = mergeDuplicateOpportunityMetadata(group.ids.map((id) => opportunities.find((item) => item.id === id)!));
  assert.equal(merged?.canonicalId, group.canonicalId);
  assert.ok((merged?.officialSources.length ?? 0) >= 1, "Canonical duplicate metadata must preserve source provenance.");
}

const base = opportunities.find((item) => item.verification_status === "verified" && item.metadata.eligibilityRules?.recommendationEligibilityStatus === "eligible_for_ranking")!;
assert.ok(base, "A verified canonical fixture must exist.");
const expired: Opportunity = { ...base, id: "expired-platform-fixture", application_deadline: "2026-01-01", deadline: "2026-01-01", metadata: { ...base.metadata, deadlineType: "fixed", verification: { ...base.metadata.verification, status: base.verification_status, deadlineVerified: true } } };
assert.equal(assessOpportunityFreshness(expired, new Date("2026-07-22T12:00:00Z")).state, "expired");
assert.equal(buildOpportunityCatalogIndex([expired], { now: new Date("2026-07-22T12:00:00Z") }).profiles.get(expired.id)?.recommendationEligible, false);

const withoutBehavior = buildOpportunityCatalogIndex([base], { now: new Date("2026-07-22T12:00:00Z") }).profiles.get(base.id)!;
const withBehavior = buildOpportunityCatalogIndex([base], {
  now: new Date("2026-07-22T12:00:00Z"),
  behavior: new Map([[base.id, { shown: 100, opened: 70, saved: 35, applied: 20, dismissed: 3, accepted: 5 }]]),
}).profiles.get(base.id)!;
assert.ok(withBehavior.quality.popularity > withoutBehavior.quality.popularity, "Aggregate engagement must improve the independent popularity factor.");
assert.equal(withBehavior.recommendationEligible, withoutBehavior.recommendationEligible, "Behavior must not bypass confidence or eligibility gates.");
const incrementallyRefreshed = refreshOpportunityCatalogProfile(index, base, {
  now: new Date("2026-07-22T12:00:00Z"),
  behavior: { shown: 100, opened: 70, saved: 35, applied: 20, dismissed: 3, accepted: 5 },
  duplicate: index.profiles.get(base.id)?.duplicate,
});
assert.equal(incrementallyRefreshed.profiles.size, index.profiles.size, "Incremental refresh must not rebuild or drop unrelated catalog records.");
assert.ok(incrementallyRefreshed.profiles.get(base.id)!.quality.popularity > index.profiles.get(base.id)!.quality.popularity);

const relationshipIndex = buildOpportunityRelationshipIndex(opportunities);
assert.equal(buildOpportunityRelationshipIndex(opportunities), relationshipIndex, "Relationship indexes must be reused.");
const relationship = getOpportunityRelationship(base, opportunities);
assert.equal(relationship.opportunityId, base.id);
assert.ok(relationship.alternatives.every((id) => id !== base.id));

const repeatedStart = performance.now();
for (let indexValue = 0; indexValue < 100; indexValue += 1) getOpportunityRelationship(base, opportunities);
const cachedRelationshipMs = performance.now() - repeatedStart;
assert.ok(cachedRelationshipMs < 25, `Cached relationship access must stay fast; received ${cachedRelationshipMs.toFixed(2)}ms.`);

process.env.UNLOCKED_ANALYTICS_STORE = "memory";
const [{ productIntelligenceEvents }, analytics] = await Promise.all([import("../lib/analytics-types"), import("../lib/analytics-store")]);
await analytics.recordAnalyticsEnvelope({
  id: "opportunity-platform-impression-fixture",
  version: 1,
  name: productIntelligenceEvents.recommendationImpression,
  visitorId: "anonymous-platform-fixture",
  occurredAt: "2026-07-22T12:00:00.000Z",
  properties: { opportunityId: base.id, recommendationId: "recommendation-fixture", category: "internship", exposureCount: 0 },
});
await analytics.recordAnalyticsEnvelope({
  id: "opportunity-platform-acceptance-fixture",
  version: 1,
  name: productIntelligenceEvents.transitionCompleted,
  visitorId: "anonymous-platform-fixture",
  occurredAt: "2026-07-22T12:01:00.000Z",
  properties: { opportunityId: base.id, transition: "accept" },
});
const engagement = await analytics.getOpportunityEngagementSignals();
assert.equal(engagement.get(base.id)?.shown, 1, "Recommendation feedback must aggregate by opportunity without retaining user identity.");
assert.equal(engagement.get(base.id)?.accepted, 1, "Accepted Journey transitions must update aggregate opportunity outcomes.");

console.log(JSON.stringify({
  records: profiles.length,
  verifiedUniqueRecommendationInventory: eligibleProfiles.length,
  partiallyVerified: partialProfiles.length,
  duplicateGroups: index.duplicateGroups.length,
  duplicateRecordsSuppressed: index.duplicateGroups.reduce((sum, group) => sum + group.ids.length - 1, 0),
  refreshMs: Number(elapsedMs.toFixed(2)),
  cachedRelationshipMs: Number(cachedRelationshipMs.toFixed(2)),
}, null, 2));
