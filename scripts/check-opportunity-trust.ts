import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { opportunities, type Opportunity } from "../data/opportunities";
import { detectMeaningfulOpportunityChanges } from "../data/opportunity-changelog";
import { auditOpportunityTrust } from "../data/opportunity-trust-audit";
import { projectOpportunityTrust, verifiedApplicationRequirements } from "../data/opportunity-trust";
import { projectApplicationWorkspace } from "../lib/application-workspace";

function opportunity(id: string) { const item = opportunities.find((candidate) => candidate.id === id); assert.ok(item, `Missing trust fixture ${id}.`); return item; }
const now = new Date("2026-08-13T12:00:00.000Z");
const strong = opportunity("national-curated-2026--nasa--nasa-ostem-internships");
const incomplete = opportunity("national-curated-2026--u-s-department-of-state--gilman-international-scholarship");
const strongTrust = projectOpportunityTrust(strong, now);
const incompleteTrust = projectOpportunityTrust(incomplete, now);
assert.equal(strongTrust.source.state, "official_source");
assert.equal(strongTrust.deadline.state, "verified");
assert.equal(strongTrust.eligibility.state, "verified");
assert.notEqual(strongTrust.deadline.displayValue, "Deadline not confirmed");
assert.equal(incompleteTrust.deadline.displayValue, "Deadline not confirmed");
assert.equal(incompleteTrust.eligibility.state, "unconfirmed");
assert.deepEqual(verifiedApplicationRequirements(incomplete), []);
const incompleteWorkspace = projectApplicationWorkspace({
  opportunity: incomplete,
  record: { id: incomplete.id, status: "Saved", savedAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-01T12:00:00.000Z" },
  workspace: {
    opportunityId: incomplete.id,
    tasks: { personal: { id: "personal", title: "Review provider page", source: "user", completed: true, completedAt: "2026-08-02T12:00:00.000Z", createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-02T12:00:00.000Z", version: 1 } },
    deletedTasks: {}, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-02T12:00:00.000Z", version: 1,
  },
  now,
});
assert.equal(incompleteWorkspace.requirementsVerified, false);
assert.equal(incompleteWorkspace.readyForSubmission, false, "Private task completion must not imply that unverified provider requirements are complete.");
assert.equal(incompleteWorkspace.sourceVerified, true, "A verified source link must remain distinct from unverified eligibility and requirements.");
function withDeadline(item: Opportunity, deadline: string): Opportunity {
  return {
    ...item,
    application_deadline: deadline,
    deadline,
    metadata: {
      ...item.metadata,
      lifecycle: item.metadata.lifecycle ? {
        ...item.metadata.lifecycle,
        finalDeadline: { ...item.metadata.lifecycle.finalDeadline!, sourceValue: deadline, normalizedValue: deadline },
      } : undefined,
    },
  };
}
const before = withDeadline(strong, "2026-09-15");
const after = withDeadline(strong, "2026-09-21");
const deadlineChange = detectMeaningfulOpportunityChanges(before, after, now).find((event) => event.field === "deadline");
assert.ok(deadlineChange);
assert.equal(deadlineChange.previousValue, "2026-09-15");
assert.equal(deadlineChange.newValue, "2026-09-21");
assert.equal(deadlineChange.calendarImpact, true);
const { coverage, issues } = auditOpportunityTrust(opportunities, now);
assert.equal(coverage.totalRecords, opportunities.length);
assert.ok(coverage.canonicalRecords < coverage.totalRecords);
assert.ok(coverage.confirmedDeadlineRecords > 0);
assert.ok(coverage.unconfirmedDeadlineRecords > coverage.confirmedDeadlineRecords);
assert.equal(issues.filter((issue) => issue.severity === "error").length, 0, `Trust audit found blocking errors: ${JSON.stringify(issues.filter((issue) => issue.severity === "error").slice(0, 5))}`);
const page = readFileSync("app/opportunities/[id]/page.tsx", "utf8");
const detail = readFileSync("components/opportunity-detail-experience.tsx", "utf8");
const detailProjection = readFileSync("lib/opportunity-detail-projection.ts", "utf8");
const card = readFileSync("components/opportunity-card.tsx", "utf8");
const workspace = readFileSync("components/application-workspace.tsx", "utf8");
const forYou = readFileSync("components/advisor-page.tsx", "utf8");
assert.match(detail, /trust\.eligibility/);
assert.match(detailProjection, /projectOpportunityTrust/);
assert.match(detail, /complete verified checklist/);
assert.match(detail, /View official source/);
assert.doesNotMatch(`${page}\n${detail}`, /label="Confidence"/);
assert.match(card, /Not fully confirmed/);
assert.match(workspace, /Official requirements are separated from your private tasks/);
assert.match(workspace, /data-task-source/);
assert.match(forYou, /trustedDeadlineLabel/);
assert.match(forYou, /not a guarantee of eligibility/);
assert.doesNotMatch(forYou, /Official source verified/);
console.log(JSON.stringify({ message: "Opportunity trust and data-transparency checks passed.", coverage, reviewIssues: issues.filter((issue) => issue.severity === "review").length }, null, 2));
