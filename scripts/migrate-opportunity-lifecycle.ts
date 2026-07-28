import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Opportunity } from "../data/opportunities";
import {
  lifecycleMigrationDistribution,
  migrateOpportunityLifecycleRecord,
  rollbackOpportunityLifecycleMigration,
} from "../data/opportunity-lifecycle";

const catalogPath = resolve(process.cwd(), "data/db/opportunities.json");
const originalText = await readFile(catalogPath, "utf8");
const original = JSON.parse(originalText) as Opportunity[];
const now = new Date(process.env.UNLOCKED_LIFECYCLE_MIGRATION_DATE ?? "2026-07-28T12:00:00.000Z");
const rollback = process.argv.includes("--rollback");
const write = process.argv.includes("--write");
const migrated = rollback
  ? original.map(rollbackOpportunityLifecycleMigration)
  : original.map((item) => migrateOpportunityLifecycleRecord(item, now));

const remigrated = migrated.map((item) => migrateOpportunityLifecycleRecord(item, now));
assert.deepEqual(remigrated, migrated, "Lifecycle migration must be idempotent.");
if (!rollback) {
  const restored = migrated.map(rollbackOpportunityLifecycleMigration);
  assert.deepEqual(restored, original, "Lifecycle migration rollback must restore the original records.");
}
for (let index = 0; index < original.length; index += 1) {
  assert.equal(migrated[index].id, original[index].id, `Migration changed stable ID ${original[index].id}.`);
  assert.equal(migrated[index].official_source, original[index].official_source, `Migration changed source ${original[index].id}.`);
  assert.equal(migrated[index].application_deadline, original[index].application_deadline, `Migration changed deadline ${original[index].id}.`);
}

const distribution = lifecycleMigrationDistribution(migrated, now);
if (write) await writeFile(catalogPath, `${JSON.stringify(migrated, null, 2)}\n`);
console.log(JSON.stringify({
  mode: rollback ? "rollback" : "forward",
  write,
  records: migrated.length,
  stableIds: true,
  idempotent: true,
  rollbackVerified: !rollback,
  distribution,
}, null, 2));
