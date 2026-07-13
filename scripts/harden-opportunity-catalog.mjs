import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "data/db/opportunities.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const duplicateIds = new Set(["research--nasa-ostem-internships"]);

function deduplicateSentences(value) {
  const seen = new Set();
  return String(value ?? "")
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const key = sentence.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ")
    .trim();
}

const next = catalog.filter((opportunity) => !duplicateIds.has(opportunity.id)).map((opportunity) => {
  const description = deduplicateSentences(opportunity.description);
  if (!opportunity.id.startsWith("v1-school-resource--")) return { ...opportunity, description };
  const notes = "Generated school-directory coverage has not received office-level eligibility verification and is excluded from Pro recommendations until manual review.";
  return {
    ...opportunity,
    description,
    verification_status: "needs_review",
    reviewer_notes: opportunity.reviewer_notes.includes(notes) ? opportunity.reviewer_notes : `${opportunity.reviewer_notes} ${notes}`,
    metadata: {
      ...opportunity.metadata,
      verification: {
        status: "needs_review",
        eligibilityVerified: false,
        notes,
      },
    },
  };
});

fs.writeFileSync(catalogPath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Hardened ${next.length} opportunities: removed ${catalog.length - next.length} duplicate and downgraded ${next.filter((item) => item.id.startsWith("v1-school-resource--")).length} generated school-directory records.`);
