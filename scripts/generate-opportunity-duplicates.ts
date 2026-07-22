import fs from "node:fs";
import path from "node:path";
import { opportunities } from "../data/opportunities";
import { detectOpportunityDuplicateGroups, opportunityPlatformVersion } from "../data/opportunity-platform";

const groups = detectOpportunityDuplicateGroups(opportunities);
const payload = {
  version: opportunityPlatformVersion,
  groups,
};
fs.writeFileSync(path.join(process.cwd(), "data/db/opportunity-duplicates.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${groups.length} canonical duplicate groups.`);
