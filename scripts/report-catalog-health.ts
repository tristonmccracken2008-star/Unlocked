import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import duplicateData from "../data/db/opportunity-duplicates.json";
import { buildCatalogReliabilityReport } from "../data/catalog-reliability";
import { allOpportunityAcquisitionCandidates, allOpportunityAcquisitionRecords, opportunityAcquisitionBatches } from "../data/opportunity-acquisition-batches";
import { opportunities } from "../data/opportunities";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const view = process.argv.find((argument) => argument.startsWith("--view="))?.split("=")[1] ?? "summary";
const asOfArgument = process.argv.find((argument) => argument.startsWith("--as-of="))?.split("=")[1] ?? new Date().toISOString().slice(0, 10);
const now = new Date(`${asOfArgument}T12:00:00.000Z`);
if (!Number.isFinite(now.getTime())) throw new Error(`Invalid --as-of date: ${asOfArgument}`);

const report = buildCatalogReliabilityReport(opportunities, { now, duplicateGroups: duplicateData.groups });
const countBy = (values: string[]) => Object.fromEntries([...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>())].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
const organizationClass = (organization: string, url: string) => {
  const text = `${organization} ${url}`.toLowerCase();
  if (/\.gov\b|department|agency|national lab|white house|congress|americorps/.test(text)) return "government";
  if (/university|college|institute of technology/.test(text)) return "university";
  if (/united nations|world bank|oecd|international organization/.test(text)) return "international_organization";
  if (/museum|smithsonian|library|archives|gallery/.test(text)) return "museum_or_library";
  if (/foundation|scholarship fund/.test(text)) return "foundation";
  if (/association|society|institute|council/.test(text)) return "professional_society";
  if (/\.org\b/.test(text)) return "nonprofit";
  return "other";
};
const machineReport = {
  schemaVersion: report.schemaVersion,
  asOf: report.asOf,
  totals: report.totals,
  healthStates: report.healthStates,
  blockers: report.blockers,
  lifecycle: report.lifecycle,
  sourceTiers: report.sourceTiers,
  coverage: report.coverage,
  trustCoverage: report.trustCoverage,
  review: report.review,
  artifactScope: {
    completeAggregates: true,
    completeRecordQueueAvailableVia: "npm run report:catalog-health",
    coverageGapLimit: 100,
    deeperResearchLimit: 25,
  },
  queues: {
    recertification: report.queue.filter((record) => record.queueTier === "recertify_stale"),
    nearSafe: report.queue.filter((record) => record.state === "NEAR_SAFE"),
    archiveOrDuplicate: report.queue.filter((record) => record.queueTier === "archive_or_duplicate_review"),
    coverageGaps: report.queue.filter((record) => record.queueTier === "coverage_gap").slice(0, 100),
    deeperResearch: report.queue.filter((record) => record.queueTier === "deeper_research").slice(0, 25),
  },
  operationalTargets: { recommendationSafe: 100, scholarships: 15, research: 20, career: 35, firstYear: 40, international: 25, transfer: 10, fellowships: 8, competitions: 8 },
  acquisition: {
    batchIds: opportunityAcquisitionBatches.map((batch) => batch.batchId),
    ledger: {
      researched: allOpportunityAcquisitionCandidates.length,
      accepted: allOpportunityAcquisitionRecords.length,
      rejectedOrDeferred: allOpportunityAcquisitionCandidates.length - allOpportunityAcquisitionRecords.length,
      sourceWatch: allOpportunityAcquisitionCandidates.filter((candidate) => candidate.sourceWatch).length,
      dispositions: countBy(allOpportunityAcquisitionCandidates.map((candidate) => candidate.disposition)),
      coverageGapsResearched: countBy(allOpportunityAcquisitionCandidates.flatMap((candidate) => candidate.coverageGaps)),
      acceptedSourceMix: countBy(allOpportunityAcquisitionRecords.map((record) => organizationClass(record.organization, record.official_source_url))),
    },
    currentDryRun: { wouldAdd: 0, wouldUpdate: 0, unchangedAcceptedRecords: allOpportunityAcquisitionRecords.length, duplicateAdditions: 0 },
  },
};
const outputPath = path.join(root, "docs", "catalog-health.json");
if (write) fs.writeFileSync(outputPath, `${JSON.stringify(machineReport, null, 2)}\n`);

const selected = view === "blockers"
  ? { asOf: report.asOf, blockers: report.blockers }
  : view === "near-safe"
    ? { asOf: report.asOf, count: report.review.nearSafe, records: report.queue.filter((record) => record.state === "NEAR_SAFE") }
    : view === "stale"
      ? { asOf: report.asOf, count: report.review.stale, records: report.queue.filter((record) => record.state === "STALE") }
      : view === "gaps"
        ? { asOf: report.asOf, coverage: report.coverage, queue: report.queue.filter((record) => record.queueTier === "coverage_gap").slice(0, 100) }
        : {
            asOf: report.asOf,
            totals: report.totals,
            healthStates: report.healthStates,
            lifecycle: report.lifecycle,
            sourceTiers: report.sourceTiers,
            review: report.review,
            coverage: report.coverage,
            trustCoverage: report.trustCoverage,
            acquisition: machineReport.acquisition,
            artifact: write ? path.relative(root, outputPath) : null,
          };
console.log(JSON.stringify(selected, null, 2));
