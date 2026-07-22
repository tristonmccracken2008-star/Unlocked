import duplicateData from "./db/opportunity-duplicates.json";

type DuplicateManifest = {
  version: string;
  groups: Array<{ canonicalId: string; ids: string[]; similarity: number; reasons: string[] }>;
};

const manifest = duplicateData as DuplicateManifest;
const duplicateOf = new Map<string, string>();
for (const group of manifest.groups) for (const id of group.ids) if (id !== group.canonicalId) duplicateOf.set(id, group.canonicalId);

export const opportunityDuplicateManifest = manifest;
export const canonicalOpportunityIds = new Set(manifest.groups.map((group) => group.canonicalId));

export function canonicalOpportunityId(opportunityId: string) {
  return duplicateOf.get(opportunityId) ?? opportunityId;
}

export function isCanonicalCatalogOpportunity(opportunityId: string) {
  return !duplicateOf.has(opportunityId);
}

export function duplicateCanonicalId(opportunityId: string) {
  return duplicateOf.get(opportunityId) ?? null;
}
