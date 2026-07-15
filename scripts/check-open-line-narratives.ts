import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import type { Opportunity } from "../data/opportunities";
import {
  analyzeJourneyBranches,
  buildOpenLineNarratives,
  buildPathprint,
  createPublicNarrativeProjection,
  getNarrativeTemplatePlaceholders,
  narrativeStoryHierarchy,
  normalizeJourneyEvents,
  openLineNarrativeRulesVersion,
  openLineNarrativeTemplates,
  renderNarrativeTemplate,
  type JourneyEvent,
  type JourneyEventType,
  type OpenLineInput,
  type OpenLineNarrativeBuildStage,
} from "../data/open-line";

const baseTime = Date.UTC(2026, 0, 1, 12);
const timestamp = (index: number) => new Date(baseTime + index * 86400000).toISOString();

function opportunity(id: string, category: string, options: { skills?: string[]; careers?: string[]; academicYears?: string[] } = {}): Opportunity {
  return {
    id,
    title: `${category} ${id}`,
    type: category === "Research" ? "Research" : category === "Scholarships" ? "Scholarship" : "Career",
    category,
    description: "A deterministic narrative fixture backed by structured metadata.",
    organization: `Private Organization ${id}`,
    school_scope: "National",
    schools: [],
    majors: ["Any Major"],
    academic_years: options.academicYears ?? ["Any Year"],
    eligibility: "Current undergraduate students may apply.",
    estimated_value: null,
    application_deadline: null,
    recurring: false,
    location: "United States",
    remote: true,
    paid: true,
    tags: [],
    official_source: `https://example.edu/${id}`,
    official_source_url: `https://example.edu/${id}`,
    verification_status: "verified",
    last_verified: "2026-07-14",
    deadline: null,
    reviewer_notes: "Fixture",
    estimated_value_note: "Unknown",
    date_added: "2026-07-14",
    difficulty: "Open",
    prestige: "Established",
    icon: null,
    featured: false,
    hidden_gem: false,
    metadata: { skillsGained: options.skills, careerPaths: options.careers },
  };
}

const internship = opportunity("internship", "Internships", { skills: ["Python", "Communication"], careers: ["Data Science"], academicYears: ["First year", "Second year"] });
const research = opportunity("research", "Research", { skills: ["Python", "Data Analysis"], careers: ["Data Science"] });
const scholarship = opportunity("scholarship", "Scholarships");
const opportunities = [internship, research, scholarship];

function event(type: JourneyEventType, index: number, options: Partial<JourneyEvent> = {}): JourneyEvent {
  const publicSafe = ["application_submitted", "interview_reached", "accepted", "opportunity_completed"].includes(type);
  return {
    id: options.id ?? `event-${type}-${index}`,
    userId: options.userId ?? "narrative-test-user",
    type,
    occurredAt: options.occurredAt ?? timestamp(index),
    category: options.category ?? "internship",
    source: options.source ?? "journey_status",
    visibility: options.visibility ?? (publicSafe ? "shareable" : "private"),
    publicSafe: options.publicSafe ?? publicSafe,
    ...options,
  };
}

function narratives(events: JourneyEvent[], input: Partial<OpenLineInput> = {}) {
  const fullInput: OpenLineInput = { userId: "narrative-test-user", opportunities, ...input };
  const branches = analyzeJourneyBranches(fullInput, events);
  return buildOpenLineNarratives(fullInput, events, branches);
}

assert.equal(openLineNarrativeRulesVersion, "open-line-narratives-v1");
assert.ok(narrativeStoryHierarchy.validation > narrativeStoryHierarchy.experience);
assert.ok(narrativeStoryHierarchy.experience > narrativeStoryHierarchy.acceptance);
assert.ok(narrativeStoryHierarchy.acceptance > narrativeStoryHierarchy.commitment);
assert.ok(narrativeStoryHierarchy.commitment > narrativeStoryHierarchy.action);
assert.ok(narrativeStoryHierarchy.direction > narrativeStoryHierarchy.exploration);

const empty = narratives([]);
assert.equal(empty.moments.length, 0, "An empty Journey must not invent moments.");
assert.equal(empty.origin.kind, "origin");
assert.equal(empty.origin.storyType, "origin");
assert.match(empty.origin.body, /no journey activity/i);
assert.equal(empty.diagnostics.sourceEventCount, 0);

const origin = narratives([event("opportunity_chosen", 1)]);
assert.match(origin.origin.explanation ?? "", /meaningful choice/i);
assert.equal(origin.moments[0]?.kind, "direction");

const submissions = narratives([
  event("application_submitted", 1, { id: "submission-one", opportunityId: internship.id }),
  event("application_submitted", 2, { id: "submission-two", opportunityId: internship.id }),
]);
assert.match(submissions.eventNarratives[0].body, /first internship application/i);
assert.match(submissions.eventNarratives[1].body, /another internship application/i);
assert.match(submissions.eventNarratives[0].explanation ?? "", /real application experience/i);
assert.equal(submissions.moments[0].storyType, "commitment");

const validation = narratives([event("interview_reached", 1, { opportunityId: internship.id })]);
assert.equal(validation.moments[0].storyType, "validation");
assert.equal(validation.moments[0].confidence, 1);
assert.equal(validation.moments[0].explanationSource, "validation_evidence");
assert.match(validation.moments[0].explanation ?? "", /outside UnlockED responded/i);

const experience = narratives([event("opportunity_completed", 1, { opportunityId: internship.id })]);
assert.equal(experience.moments[0].storyType, "experience");
assert.equal(experience.moments[0].explanationSource, "opportunity_metadata");
assert.match(experience.moments[0].explanation ?? "", /Python and Communication/i);

const skill = narratives([event("skill_evidence_created", 1, {
  category: "project",
  skillIds: ["Python", "Data Analysis"],
  evidence: { label: "Analysis project", referenceId: "project-one" },
  source: "manual_evidence",
  visibility: "private",
  publicSafe: false,
})]);
assert.equal(skill.moments[0].storyType, "skill");
assert.equal(skill.moments[0].explanationSource, "skill_evidence");
assert.match(skill.moments[0].body, /Python and Data Analysis/i);

const direction = narratives([
  event("goal_selected", 1, { careerDirection: "Medicine", category: undefined, source: "profile" }),
  event("direction_paused", 2, { careerDirection: "Medicine", category: undefined, source: "profile" }),
  event("direction_closed", 3, { careerDirection: "Medicine", category: undefined, source: "profile" }),
]);
assert.equal(direction.moments.find((moment) => moment.storyType === "pause")?.kind, "transition");
assert.match(direction.moments.find((moment) => moment.storyType === "pause")?.body ?? "", /paused Medicine/i);
assert.match(direction.moments.find((moment) => moment.storyType === "closed_opportunity")?.body ?? "", /broader Medicine direction/i);

const explorationEvents = Array.from({ length: 5 }, (_, index) => event("opportunity_viewed", index + 1, { id: `exploration-${index}`, category: "research", source: "saved_opportunity" }));
const exploration = narratives(explorationEvents);
assert.equal(exploration.moments.length, 1, "Repeated exploration must merge into one narrative moment.");
assert.match(exploration.moments[0].body, /several research opportunities/i);
assert.equal(exploration.moments[0].evidenceEventIds.length, 5);
assert.equal(exploration.diagnostics.mergedNarratives[0]?.eventCount, 5);
assert.equal(exploration.diagnostics.suppressedMoments.filter((item) => item.reason === "merged_exploration").length, 5);

const saved = narratives([event("opportunity_saved", 1, { opportunityId: internship.id, source: "saved_opportunity" })]);
assert.equal(saved.moments.length, 0, "Saved opportunities must not become major narrative moments.");
assert.equal(saved.diagnostics.suppressedMoments[0]?.reason, "saved_only");

const rejoinInput: OpenLineInput = {
  userId: "rejoin-user",
  opportunities,
  profile: { firstName: "Test", schoolSlug: "test", major: "Mathematics", graduationYear: "2029", year: "First year", careerGoal: "Data Science", interests: "Research", onboardingCompletedAt: timestamp(0) },
  activity: {
    viewed: [],
    saved: [internship.id, research.id],
    claimed: [],
    tracked: {
      [internship.id]: { id: internship.id, status: "Completed", savedAt: timestamp(1), updatedAt: timestamp(3) },
      [research.id]: { id: research.id, status: "Completed", savedAt: timestamp(2), updatedAt: timestamp(4) },
    },
  },
};
const rejoinPath = buildPathprint(rejoinInput);
assert.ok(rejoinPath.narrative?.moments.some((moment) => moment.storyType === "rejoin"), "Structured rejoin evidence must produce a rejoin narrative.");
assert.ok(rejoinPath.narrative?.moments.find((moment) => moment.storyType === "rejoin")?.evidenceEventIds.length);

const waypoint = narratives([], {
  profile: { firstName: "Test", schoolSlug: "test", major: "Mathematics", graduationYear: "2029", year: "First year", careerGoal: "Data Science", interests: "Research", onboardingCompletedAt: timestamp(0) },
  currentWaypoint: {
    type: "roadmap",
    id: "portfolio",
    title: "Build a small data project",
    whyItMatters: "Because it matches your profile.",
    estimatedTime: "2 hours",
    impact: "High",
    requiredSkills: ["Python", "Data Analysis"],
    relatedOpportunityCategories: ["Internships"],
  },
});
assert.equal(waypoint.waypoint?.estimatedMinutes, 120);
assert.equal(waypoint.waypoint?.explanationSource, "roadmap_metadata");
assert.match(waypoint.waypoint?.whyItMatters ?? "", /builds Python and Data Analysis/i);
assert.doesNotMatch(waypoint.waypoint?.whyItMatters ?? "", /matches your profile/i);

const earlyWaypoint = narratives([], {
  profile: { firstName: "Test", schoolSlug: "test", major: "Mathematics", graduationYear: "2029", year: "First year", careerGoal: "Data Science", interests: "Research", onboardingCompletedAt: timestamp(0) },
  currentWaypoint: { type: "recommendation", id: "early", title: "Apply to an early internship", whyItMatters: "A recommendation reason.", sourceOpportunityId: internship.id },
});
assert.match(earlyWaypoint.waypoint?.whyItMatters ?? "", /first-year students/i);
assert.equal(earlyWaypoint.waypoint?.explanationSource, "opportunity_metadata");

const horizon = narratives([], {
  horizon: [
    { id: "research-horizon", title: "Undergraduate research", rationale: "This guarantees graduate admission.", requiredSkills: ["Research writing"] },
    { id: "fellowship-horizon", title: "A competitive fellowship", rationale: "This ensures an offer.", prerequisiteMilestoneIds: ["first-project"] },
    { id: "career-horizon", title: "A later career program", rationale: "This will get you hired." },
  ],
});
assert.equal(horizon.horizon.length, 3);
assert.match(horizon.horizon[0].rationale, /prepare you to pursue|strengthens your preparation/i);
for (const item of horizon.horizon) assert.doesNotMatch(item.rationale, /guarantee|ensure|will get/i);

const deterministicEvents = [
  event("application_started", 1, { opportunityId: internship.id }),
  event("application_submitted", 2, { opportunityId: internship.id }),
  event("interview_reached", 3, { opportunityId: internship.id }),
];
const deterministicA = narratives(deterministicEvents);
const deterministicB = narratives(deterministicEvents);
assert.deepEqual(deterministicA, deterministicB);
assert.equal(deterministicA.signature, deterministicB.signature);
assert.equal(deterministicA.signature, deterministicA.diagnostics.deterministicSignature);
assert.equal(deterministicA.signature, "58b850a966ee1925", "Canonical private narrative signature must remain stable.");

const publicEvent = event("application_submitted", 2, { id: "public-submission", opportunityId: internship.id });
const privateEvent = event("goal_selected", 1, { id: "private-direction", careerDirection: "Private Medical Direction", source: "profile" });
const privateEvidence = event("skill_evidence_created", 3, { id: "private-evidence", skillIds: ["Private Skill"], evidence: { label: "Private Notes", referenceId: "private" }, source: "manual_evidence", visibility: "private", publicSafe: false });
const publicOnly = createPublicNarrativeProjection(narratives([publicEvent]));
const withPrivate = createPublicNarrativeProjection(narratives([privateEvent, publicEvent, privateEvidence]));
assert.deepEqual(withPrivate, publicOnly, "Private history must not alter public narrative output or signatures.");
assert.equal(withPrivate.signature, "5c4581abd654c62f", "Canonical public narrative signature must remain stable.");
const publicJson = JSON.stringify(withPrivate);
for (const secret of ["Private Medical Direction", "Private Skill", "Private Notes", internship.title, internship.organization]) assert.equal(publicJson.includes(secret), false);
assert.equal("evidenceEventIds" in withPrivate.moments[0], false, "Public narratives must not expose internal evidence IDs.");

for (const key of Object.keys(openLineNarrativeTemplates) as Array<keyof typeof openLineNarrativeTemplates>) {
  const parameters = Object.fromEntries(getNarrativeTemplatePlaceholders(key).map((placeholder) => [placeholder, "Value"]));
  const rendered = renderNarrativeTemplate(key, parameters);
  assert.doesNotMatch(rendered, /\{[a-zA-Z0-9]+\}/, `${key} must resolve every localization placeholder.`);
}
assert.throws(() => renderNarrativeTemplate("waypoint.skill", {}), /Missing narrative template parameter/);

const chronological = narratives([
  event("accepted", 4, { opportunityId: internship.id }),
  event("application_started", 1, { opportunityId: internship.id }),
  event("application_submitted", 2, { opportunityId: internship.id }),
  event("interview_reached", 3, { opportunityId: internship.id }),
]);
assert.deepEqual(chronological.moments.map((moment) => moment.occurredAt), [...chronological.moments.map((moment) => moment.occurredAt)].sort(), "Narratives must remain in chronological reading order without graphics.");

const fixtureStartedAt = performance.now();
const typicalEvents = Array.from({ length: 20 }, (_, index) => event(index % 4 === 0 ? "application_submitted" : "application_started", index + 1, { id: `typical-${index}`, opportunityId: `typical-opportunity-${index}`, category: index % 2 ? "research" : "internship" }));
const typicalInput: OpenLineInput = { userId: "typical", opportunities: [] };
const largeEvents = Array.from({ length: 1000 }, (_, index) => event(index % 5 === 0 ? "application_submitted" : "application_started", index + 1, { id: `large-${index}`, userId: "large", opportunityId: `large-opportunity-${index}`, category: index % 3 === 0 ? "research" : "internship" }));
const largeInput: OpenLineInput = { userId: "large", opportunities: [] };
const normalizationInput: OpenLineInput = {
  userId: "large-normalization",
  activity: {
    viewed: [],
    saved: [],
    claimed: [],
    tracked: Object.fromEntries(Array.from({ length: 500 }, (_, index) => {
      const id = `normalization-${index}`;
      return [id, { id, status: index % 5 === 0 ? "Submitted" as const : "Applying" as const, savedAt: timestamp(index + 1), updatedAt: timestamp(index + 2) }];
    })),
  },
};
const fixtureCreationMs = performance.now() - fixtureStartedAt;
const typicalBranches = analyzeJourneyBranches(typicalInput, typicalEvents);
const largeBranches = analyzeJourneyBranches(largeInput, largeEvents);

type BenchmarkSummary = { average: number; p95: number; maximum: number; samples: number };
let benchmarkBookkeepingMs = 0;
const percentile = (sortedValues: readonly number[], amount: number) => sortedValues[Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * amount) - 1))];
const summarize = (values: readonly number[]): BenchmarkSummary => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    average: values.reduce((total, value) => total + value, 0) / values.length,
    p95: percentile(sorted, 0.95),
    maximum: sorted.at(-1) ?? 0,
    samples: values.length,
  };
};
const benchmark = (warmupRuns: number, measuredRuns: number, operation: () => void) => {
  for (let run = 0; run < warmupRuns; run += 1) operation();
  const durations: number[] = [];
  for (let run = 0; run < measuredRuns; run += 1) {
    const started = performance.now();
    operation();
    durations.push(performance.now() - started);
  }
  const bookkeepingStartedAt = performance.now();
  const summary = summarize(durations);
  benchmarkBookkeepingMs += performance.now() - bookkeepingStartedAt;
  return summary;
};

const normalizationBenchmark = benchmark(8, 30, () => { normalizeJourneyEvents(normalizationInput); });
const branchBenchmark = benchmark(8, 30, () => { analyzeJourneyBranches(largeInput, largeEvents); });
const typicalBenchmark = benchmark(20, 120, () => { buildOpenLineNarratives(typicalInput, typicalEvents, typicalBranches); });
const largeBenchmark = benchmark(10, 40, () => { buildOpenLineNarratives(largeInput, largeEvents, largeBranches); });

const stageDurations = new Map<OpenLineNarrativeBuildStage, number[]>();
for (let run = 0; run < 20; run += 1) {
  buildOpenLineNarratives(largeInput, largeEvents, largeBranches, (stage, durationMs) => {
    const values = stageDurations.get(stage) ?? [];
    values.push(durationMs);
    stageDurations.set(stage, values);
  });
}
const narrativeStages = Object.fromEntries([...stageDurations.entries()].map(([stage, values]) => [stage, summarize(values)]));

const assertionStartedAt = performance.now();
assert.ok(typicalBenchmark.p95 < 2, `Typical narrative histories must remain under 2ms p95; received ${typicalBenchmark.p95.toFixed(2)}ms.`);
assert.ok(largeBenchmark.average < 12, `Large narrative histories must remain under 12ms average; received ${largeBenchmark.average.toFixed(2)}ms.`);
assert.ok(largeBenchmark.p95 < 15, `Large narrative histories must remain under 15ms p95; received ${largeBenchmark.p95.toFixed(2)}ms.`);
assert.ok(largeBenchmark.maximum < 50, `Large narrative histories must remain under the 50ms hard ceiling; received ${largeBenchmark.maximum.toFixed(2)}ms.`);
const assertionMs = performance.now() - assertionStartedAt;

const engineSource = readFileSync(new URL("../data/open-line/narrative.ts", import.meta.url), "utf8");
assert.doesNotMatch(engineSource, /\bfetch\s*\(/, "Narrative generation must not perform network requests.");
assert.doesNotMatch(engineSource, /\basync\s+function\b|\bPromise\b/, "Narrative generation must remain synchronous.");
const templateText = Object.values(openLineNarrativeTemplates).join(" ");
assert.doesNotMatch(templateText, /you(?:'re| are) crushing it|amazing|keep going|dreams!/i, "Narratives must avoid hype and generic coaching language.");

const diagnosticJson = JSON.stringify(withPrivate);
assert.doesNotMatch(diagnosticJson, /gpa|private notes|internal reasoning/i);

console.log(JSON.stringify({
  message: "Open Line narrative checks passed.",
  fixtureCreationMs: Number(fixtureCreationMs.toFixed(3)),
  normalization: normalizationBenchmark,
  branchIntelligence: branchBenchmark,
  typicalNarrative: typicalBenchmark,
  largeNarrative: largeBenchmark,
  narrativeStages,
  benchmarkBookkeepingMs: Number(benchmarkBookkeepingMs.toFixed(3)),
  assertionMs: Number(assertionMs.toFixed(3)),
}, null, 2));
