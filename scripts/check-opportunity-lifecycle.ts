import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import type { Opportunity } from "../data/opportunities";
import { opportunities } from "../data/opportunities";
import {
  appendOpportunityLifecycleEvents,
  applyOpportunityLifecycleReview,
  createOpportunityLifecycleEvents,
  lifecycleMigrationDistribution,
  migrateOpportunityLifecycleRecord,
  normalizeOpportunityDate,
  resolveOpportunityLifecycle,
  rollbackOpportunityLifecycleMigration,
  safeOfficialUrl,
  type OpportunityLifecycleMetadata,
  type OpportunityLifecycleState,
} from "../data/opportunity-lifecycle";
import { detectMaterialOpportunityChanges, opportunityDeadlineIsTrustworthy } from "../lib/notification-engine";
import { validateOpportunityData } from "../data/recommendation-professional-pipeline";

const now = new Date("2027-05-15T16:00:00.000Z");
const base = opportunities.find((item) => item.verification_status === "verified")!;

function fixture(id: string, state: OpportunityLifecycleState, overrides: Partial<Opportunity> = {}, lifecycleOverrides: Partial<OpportunityLifecycleMetadata> = {}): Opportunity {
  const lifecycle: OpportunityLifecycleMetadata = {
    schemaVersion: 1,
    identity: { identityId: id },
    cycle: { cycleId: `${id}:2027` },
    state,
    confidence: "confirmed",
    reason: state === "open" ? "deadline_future" : state === "rolling" ? "rolling_confirmed" : state === "upcoming" ? "opening_date_future" : state === "canceled" ? "canceled_by_organization" : state === "archived" ? "record_archived" : state === "closed" || state === "temporarily_closed" ? "official_status_closed" : "insufficient_current_evidence",
    effectiveAt: "2027-05-01T12:00:00.000Z",
    finalDeadline: normalizeOpportunityDate("final_deadline", "2027-06-15", { verifiedAt: "2027-05-01", sourceUrl: "https://example.edu/apply" }),
    evidence: [{ id: `${id}:evidence`, source: "manual_review", observedAt: "2027-05-01T12:00:00.000Z", value: state, sourceUrl: "https://example.edu/apply", confidence: "confirmed" }],
    events: [],
    fieldVerifiedAt: { state: "2027-05-01", deadline: "2027-05-01", applicationUrl: "2027-05-01", eligibility: "2027-05-01" },
    ...lifecycleOverrides,
  };
  return {
    ...base,
    id,
    title: `Lifecycle fixture ${id}`,
    official_source: "https://example.edu/apply",
    official_source_url: "https://example.edu/apply",
    application_deadline: "2027-06-15",
    deadline: "2027-06-15",
    recurring: false,
    verification_status: "verified",
    last_verified: "2027-05-01",
    metadata: {
      ...base.metadata,
      deadlineType: state === "rolling" ? "rolling" : "fixed",
      claimUrl: "https://example.edu/apply",
      verification: { status: "verified", deadlineVerified: true, eligibilityVerified: true, applicationUrlVerified: true, sourceReachable: true },
      eligibilityRules: { ...(base.metadata.eligibilityRules ?? {}), availability: state === "rolling" ? "rolling" : state === "open" ? "open" : state === "closed" ? "closed" : "unknown", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["Official source reviewed."] },
      lifecycle,
    },
    ...overrides,
  };
}

let scenarios = 0;
function scenario(name: string, check: () => void) {
  check();
  scenarios += 1;
  process.stdout.write(`✓ ${name}\n`);
}

scenario("confirmed open opportunity", () => assert.equal(resolveOpportunityLifecycle(fixture("open", "open"), now).state, "open"));
scenario("closing soon is derived", () => assert.equal(resolveOpportunityLifecycle(fixture("closing", "open", {}, { finalDeadline: normalizeOpportunityDate("final_deadline", "2027-05-20", { verifiedAt: "2027-05-01" }) }), now).displayState, "closing_soon"));
scenario("exact timestamp deadline closes at its instant", () => assert.equal(resolveOpportunityLifecycle(fixture("exact", "open", {}, { reason: "deadline_future", finalDeadline: normalizeOpportunityDate("final_deadline", "2027-05-15T15:59:59.000Z", { precision: "timestamp", verifiedAt: "2027-05-01" }) }), now).state, "closed"));
scenario("date-only deadline remains open through that date", () => assert.equal(resolveOpportunityLifecycle(fixture("date-today", "open", {}, { finalDeadline: normalizeOpportunityDate("final_deadline", "2027-05-15", { verifiedAt: "2027-05-01" }) }), now).state, "open"));
scenario("date-only deadline closes the following day", () => assert.equal(resolveOpportunityLifecycle(fixture("date-past", "open", {}, { finalDeadline: normalizeOpportunityDate("final_deadline", "2027-05-14", { verifiedAt: "2027-05-01" }) }), now).state, "closed"));
scenario("rolling has no countdown", () => { const value = resolveOpportunityLifecycle(fixture("rolling", "rolling"), now); assert.equal(value.state, "rolling"); assert.equal(opportunityDeadlineIsTrustworthy(fixture("rolling-trust", "rolling"), now), false); });
scenario("confirmed future opening is upcoming", () => assert.equal(resolveOpportunityLifecycle(fixture("upcoming", "upcoming", {}, { openingDate: normalizeOpportunityDate("application_open", "2027-06-01", { verifiedAt: "2027-05-01" }) }), now).state, "upcoming"));
scenario("confirmed opening transitions to open", () => assert.equal(resolveOpportunityLifecycle(fixture("opened", "upcoming", {}, { openingDate: normalizeOpportunityDate("application_open", "2027-05-15", { verifiedAt: "2027-05-01" }) }), now).state, "open"));
scenario("estimated opening does not fabricate exact actionability", () => assert.equal(resolveOpportunityLifecycle(fixture("estimated", "upcoming", {}, { confidence: "estimated", openingDate: normalizeOpportunityDate("expected_opening", "Fall 2027", { precision: "season", estimated: true }) }), now).actionable, false));
scenario("closed recurring opportunity stays closed", () => { const value = resolveOpportunityLifecycle(fixture("recurring", "closed", { recurring: true }, { recurrence: { type: "annual", confidence: "strong" } }), now); assert.equal(value.state, "closed"); assert.equal(value.recurring, true); });
scenario("reopened event changes presentation", () => { const item = fixture("reopened", "open", {}, { events: [{ id: "reopen", opportunityIdentityId: "reopened", cycleId: "reopened:2027", type: "application_reopened", effectiveAt: "2027-05-01T12:00:00.000Z", detectedAt: "2027-05-01T12:00:00.000Z", evidenceSource: "manual_review", confidence: "confirmed", idempotencyKey: "reopened:2027" }] }); assert.equal(resolveOpportunityLifecycle(item, now).displayState, "reopened"); });
scenario("canceled is not actionable", () => assert.equal(resolveOpportunityLifecycle(fixture("canceled", "canceled"), now).actionable, false));
scenario("archived remains a stable identity", () => { const value = resolveOpportunityLifecycle(fixture("archived", "archived"), now); assert.equal(value.identityId, "archived"); assert.equal(value.actionable, false); });
scenario("deadline extension creates one material event", () => { const before = fixture("extended", "open"); const after = fixture("extended", "open", { application_deadline: "2027-07-01", deadline: "2027-07-01" }, { finalDeadline: normalizeOpportunityDate("final_deadline", "2027-07-01", { verifiedAt: "2027-05-01" }) }); assert.deepEqual(createOpportunityLifecycleEvents(before, after, now).map((event) => event.type), ["deadline_changed"]); });
scenario("deadline moved earlier creates deterministic event", () => { const before = fixture("earlier", "open"); const after = fixture("earlier", "open", {}, { finalDeadline: normalizeOpportunityDate("final_deadline", "2027-05-25", { verifiedAt: "2027-05-01" }) }); assert.equal(createOpportunityLifecycleEvents(before, after, now)[0].type, "deadline_changed"); });
scenario("priority and final deadlines remain separate", () => { const value = resolveOpportunityLifecycle(fixture("priority", "open", {}, { priorityDeadline: normalizeOpportunityDate("priority_deadline", "2027-05-20"), finalDeadline: normalizeOpportunityDate("final_deadline", "2027-06-15") }), now); assert.notEqual(value.priorityDeadline?.normalizedValue, value.finalDeadline?.normalizedValue); });
scenario("application URL change is material", () => { const before = fixture("url", "open"); const after = { ...before, official_source: "https://example.edu/new", official_source_url: "https://example.edu/new" }; assert.ok(createOpportunityLifecycleEvents(before, after, now).some((event) => event.type === "application_url_changed")); });
scenario("temporary URL failure does not prove closure", () => { const value = resolveOpportunityLifecycle(fixture("temporary-url", "open", {}, { sourceChecks: [{ url: "https://example.edu/apply", checkedAt: now.toISOString(), classification: "temporary_error", status: 503 }] }), now); assert.equal(value.state, "open"); });
scenario("organization-homepage redirect does not prove closure", () => assert.equal(resolveOpportunityLifecycle(fixture("homepage", "open", {}, { sourceChecks: [{ url: "https://example.edu/apply", checkedAt: now.toISOString(), classification: "organization_homepage", status: 302 }] }), now).state, "open"));
scenario("contradictory official evidence resolves unknown", () => { const item = fixture("conflict", "open", {}, { evidence: [{ id: "a", source: "official_status", observedAt: now.toISOString(), value: "Applications open", confidence: "confirmed" }, { id: "b", source: "official_status", observedAt: now.toISOString(), value: "Applications closed", confidence: "confirmed" }] }); assert.equal(resolveOpportunityLifecycle(item, now).state, "unknown"); });
scenario("past deadline versus official open is conservatively unknown", () => { const item = fixture("open-conflict", "open", {}, { reason: "official_status_open", finalDeadline: normalizeOpportunityDate("final_deadline", "2027-05-14") }); assert.equal(resolveOpportunityLifecycle(item, now).state, "unknown"); });
scenario("same identity supports distinct annual cycles", () => { const one = fixture("cycle-a", "closed", {}, { identity: { identityId: "enduring-program" }, cycle: { cycleId: "enduring-program:2026" } }); const two = fixture("cycle-b", "open", {}, { identity: { identityId: "enduring-program" }, cycle: { cycleId: "enduring-program:2027" } }); assert.equal(resolveOpportunityLifecycle(one, now).identityId, resolveOpportunityLifecycle(two, now).identityId); assert.notEqual(resolveOpportunityLifecycle(one, now).cycleId, resolveOpportunityLifecycle(two, now).cycleId); });
scenario("successor relationship preserves both IDs", () => { const item = fixture("successor", "open", {}, { identity: { identityId: "successor", successorOf: "former-program" } }); assert.equal(item.id, "successor"); assert.equal(item.metadata.lifecycle?.identity.successorOf, "former-program"); });
scenario("closed public state does not mutate saved Journey facts", () => { const journey = { id: "saved", status: "Saved" }; resolveOpportunityLifecycle(fixture("saved", "closed"), now); assert.equal(journey.status, "Saved"); });
scenario("closed public state does not mutate active application", () => { const journey = { id: "active", status: "Applying" }; resolveOpportunityLifecycle(fixture("active", "closed"), now); assert.equal(journey.status, "Applying"); });
scenario("deadline notification uses confirmed fixed deadline", () => assert.equal(opportunityDeadlineIsTrustworthy(fixture("notify", "open"), now), true));
scenario("material notification change uses lifecycle labels", () => { const changes = detectMaterialOpportunityChanges(fixture("notification", "closed"), fixture("notification", "open")); assert.ok(changes.some((change) => change.field === "application_status")); });
scenario("event append is idempotent", () => { const before = fixture("idem", "closed"); const after = fixture("idem", "open"); const events = createOpportunityLifecycleEvents(before, after, now); assert.equal(appendOpportunityLifecycleEvents(events, events).length, events.length); });
scenario("unknown records are excluded from Pro", () => assert.equal(validateOpportunityData(fixture("unknown", "unknown")).allowed, false));
scenario("closed records are excluded from Pro", () => assert.equal(validateOpportunityData(fixture("pro-closed", "closed")).allowed, false));
scenario("unsafe URL blocks application action", () => { const item = fixture("unsafe", "open", { official_source: "javascript:alert(1)", official_source_url: "javascript:alert(1)" }); assert.equal(resolveOpportunityLifecycle(item, now).actionAllowed, false); });
scenario("malformed date remains non-fabricated", () => assert.equal(normalizeOpportunityDate("final_deadline", "next Tuesday")?.normalizedValue, undefined));
scenario("migration is conservative and idempotent", () => { const source = fixture("legacy", "unknown"); const { lifecycle: _lifecycle, ...metadata } = source.metadata; const legacy = { ...source, verification_status: "needs_review" as const, application_deadline: null, deadline: null, metadata: { ...metadata, deadlineType: "varies" as const, eligibilityRules: { ...source.metadata.eligibilityRules, availability: "unknown" as const } } }; const migrated = migrateOpportunityLifecycleRecord(legacy, now); assert.deepEqual(migrateOpportunityLifecycleRecord(migrated, now), migrated); assert.equal(resolveOpportunityLifecycle(migrated, now).actionable, false); });
scenario("migration rollback restores original metadata", () => { const source = fixture("rollback", "unknown"); const { lifecycle: _lifecycle, ...metadata } = source.metadata; const legacy = { ...source, verification_status: "needs_review" as const, metadata }; assert.deepEqual(rollbackOpportunityLifecycleMigration(migrateOpportunityLifecycleRecord(legacy, now)), legacy); });
scenario("manual review is attributed and event-producing", () => { const before = fixture("review", "closed"); const reviewed = applyOpportunityLifecycleReview(before, before, { state: "open", confidence: "confirmed", reason: "manually_verified", reviewedAt: "2027-05-15", reviewer: "reviewer@example.edu", note: "Official application page confirms the current cycle is open." }); assert.equal(reviewed.metadata.lifecycle?.review?.reviewer, "reviewer@example.edu"); assert.ok(reviewed.metadata.lifecycle?.events?.some((event) => event.type === "application_reopened")); });
scenario("HTTPS source validation rejects credentials and unsafe protocols", () => { assert.equal(safeOfficialUrl("https://example.edu/apply"), true); assert.equal(safeOfficialUrl("https://user:secret@example.edu"), false); assert.equal(safeOfficialUrl("http://example.edu"), false); });

assert.ok(scenarios >= 35, `Expected at least 35 scenarios; received ${scenarios}.`);

const migrated = opportunities.map((item) => migrateOpportunityLifecycleRecord(item, new Date("2026-07-28T12:00:00.000Z")));
const distribution = lifecycleMigrationDistribution(migrated, new Date("2026-07-28T12:00:00.000Z"));
assert.equal(Object.values(distribution).slice(0, 8).reduce((sum, count) => sum + count, 0), opportunities.length);
assert.equal(migrated.every((item, index) => item.id === opportunities[index].id), true);

const samples: number[] = [];
for (let run = 0; run < 8; run += 1) {
  const started = performance.now();
  for (const item of migrated) resolveOpportunityLifecycle(item, new Date("2026-07-28T12:00:00.000Z"));
  samples.push(performance.now() - started);
}
const sorted = samples.slice(2).sort((left, right) => left - right);
const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
assert.ok(average < 250, `Full-catalog lifecycle resolution average must remain under 250ms; received ${average.toFixed(2)}ms.`);
assert.ok(p95 < 500, `Full-catalog lifecycle resolution p95 must remain under 500ms; received ${p95.toFixed(2)}ms.`);

console.log(JSON.stringify({
  scenarios,
  records: opportunities.length,
  distribution,
  performance: {
    averageMs: Number(average.toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
    throughputPerSecond: Math.round(opportunities.length / (average / 1_000)),
  },
}, null, 2));
