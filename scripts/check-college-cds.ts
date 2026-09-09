import assert from "node:assert/strict";
import { collegeCdsRecords, collegeCdsSources, cdsImportanceLevels } from "../data/college-cds";
import { derivedRate, groupedCdsFactors, latestCollegeCds } from "../lib/college-admissions-insights";

const michigan = latestCollegeCds("170976");
const williams = latestCollegeCds("168342");
const mit = latestCollegeCds("166683");
assert.ok(michigan && williams && mit, "verified public university, liberal arts college, and technical institute snapshots are required");
assert.equal(michigan.factors?.rigor, "very_important");
assert.equal(michigan.factors?.class_rank, "not_considered");
assert.equal(williams.factors?.recommendations, "very_important");
assert.equal(williams.classRank?.reportingPercent, 20.5);
assert.equal(mit.factors?.character_personal_qualities, "very_important");
assert.equal(mit.admissions?.applicants, 29281);
assert.equal(derivedRate(15373, 98310)?.toFixed(4), "0.1564");
assert.equal(derivedRate(7278, 15373)?.toFixed(4), "0.4734");
assert.equal(derivedRate(12, 10), undefined, "invalid source counts must not produce a rate");
assert.equal(derivedRate(undefined, 10), undefined);
assert.deepEqual(groupedCdsFactors(michigan).map((group) => group.importance), cdsImportanceLevels);

for (const record of Object.values(collegeCdsRecords)) {
  assert.ok(record.snapshots.length > 0);
  for (const snapshot of record.snapshots) {
    assert.match(snapshot.academicYear, /^20\d{2}–\d{2}$/);
    assert.match(snapshot.verifiedAt, /^20\d{2}-\d{2}-\d{2}$/);
    assert.match(snapshot.sourceUrl, /^https:\/\//);
    assert.ok(snapshot.cohortLabel.length > 0);
    for (const importance of Object.values(snapshot.factors ?? {})) assert.ok(cdsImportanceLevels.includes(importance));
  }
}

assert.ok(Object.keys(collegeCdsSources).length >= 6, "launch sources should span a mixed institution set");
assert.equal(latestCollegeCds("144740"), undefined, "an official source must not imply populated CDS values");

console.log(`College CDS checks passed (${Object.keys(collegeCdsRecords).length} verified records; ${Object.keys(collegeCdsSources).length} institutional sources).`);
