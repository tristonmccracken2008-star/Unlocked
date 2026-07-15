import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import type { Opportunity } from "../data/opportunities";
import {
  analyzeJourneyBranches,
  branchActivationThreshold,
  buildPathprint,
  canonicalCareerDirection,
  canonicalOpportunityCategory,
  canonicalSkillDirection,
  createPublicPathprint,
  normalizeJourneyEvents,
  openLineBranchRulesVersion,
  type BranchIntelligenceBuildStage,
  type JourneyEvent,
  type OpenLineInput,
} from "../data/open-line";

const strictBenchmark = process.argv.includes("--strict-benchmark");

const dates = Array.from({ length: 20 }, (_, index) => new Date(Date.UTC(2026, 0, index + 1, 12)).toISOString());

function opportunity(id: string, category: string, options: {
  type?: Opportunity["type"];
  careerPaths?: string[];
  skills?: string[];
  title?: string;
} = {}): Opportunity {
  return {
    id,
    title: options.title ?? `${category} fixture`,
    type: options.type ?? (category === "Research" ? "Research" : category === "Scholarships" ? "Scholarship" : "Career"),
    category,
    description: "A deterministic Open Line branch fixture.",
    organization: `Organization ${id}`,
    school_scope: "National",
    schools: [],
    majors: ["Any Major"],
    academic_years: ["Any Year"],
    eligibility: "Current students may apply.",
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
    metadata: { careerPaths: options.careerPaths, skillsGained: options.skills },
  };
}

const research = opportunity("research", "Research", { careerPaths: ["Quantitative Finance"], skills: ["Python", "Data Analysis"] });
const internship = opportunity("internship", "Internships", { careerPaths: ["Quant Finance"], skills: ["Python", "Financial Modeling"] });
const scholarship = opportunity("scholarship", "Scholarships");
const competition = opportunity("competition", "Competitions");
const fellowship = opportunity("fellowship", "Fellowships");
const campusJob = opportunity("campus-job", "Campus Jobs");
const opportunities = [research, internship, scholarship, competition, fellowship, campusJob];

function tracked(id: string, status: "Saved" | "Interested" | "Applying" | "Submitted" | "Interview" | "Accepted" | "Rejected" | "Completed", savedAt = dates[0], updatedAt = dates[1]) {
  return { id, status, savedAt, updatedAt } as const;
}

function inputWithTracked(records: ReturnType<typeof tracked>[], extra: Partial<OpenLineInput> = {}): OpenLineInput {
  return {
    userId: "branch-test-user",
    opportunities,
    activity: {
      viewed: [],
      saved: records.map((record) => record.id),
      claimed: [],
      tracked: Object.fromEntries(records.map((record) => [record.id, record])),
    },
    generatedAt: dates[19],
    ...extra,
  };
}

function analyze(input: OpenLineInput, maxVisibleBranches = 3) {
  const normalized = normalizeJourneyEvents(input);
  return analyzeJourneyBranches(input, normalized.events, { maxVisibleBranches });
}

assert.equal(openLineBranchRulesVersion, "open-line-branches-v1");
assert.equal(branchActivationThreshold(), 0.55);
assert.equal(canonicalCareerDirection("Quant"), "quantitative-finance");
assert.equal(canonicalCareerDirection("Quant Finance"), canonicalCareerDirection("Quantitative Finance"));
assert.equal(canonicalSkillDirection("Data Analytics"), canonicalSkillDirection("Data Analysis"));
assert.equal(canonicalSkillDirection("Presentation"), canonicalSkillDirection("Public Speaking"));
assert.equal(canonicalOpportunityCategory("internship"), "internships");

const empty = analyze({ userId: "empty" });
assert.equal(empty.directions.length, 0, "An empty Journey must not invent a direction.");
assert.equal(empty.primaryDirectionKey, undefined);

const savedOnlyInput: OpenLineInput = {
  userId: "saved-only",
  opportunities,
  activity: { viewed: [], saved: [research.id], claimed: [], tracked: {} },
  savedRecords: [{ opportunityId: research.id, savedAt: dates[0] }],
};
const savedOnly = analyze(savedOnlyInput);
assert.equal(savedOnly.directions[0]?.state, "exploring");
assert.equal(savedOnly.secondaryDirectionKeys.length, 0, "Saved-only activity cannot create a visible branch.");
assert.equal(buildPathprint(savedOnlyInput).branches.length, 0);
assert.ok(savedOnly.diagnostics.ignoredCandidates.some((item) => item.reason === "saved_only"));

for (const [status, minimumConfidence] of [["Saved", 0.55], ["Applying", 0.7], ["Submitted", 0.82]] as const) {
  const result = analyze(inputWithTracked([tracked(internship.id, status)]));
  const direction = result.directions.find((item) => item.key === "experience:internships");
  assert.ok(direction && direction.confidence >= minimumConfidence, `${status} must activate or strengthen the internship direction.`);
  assert.notEqual(direction.state, "exploring");
}

const interview = analyze(inputWithTracked([tracked(internship.id, "Interview")]));
assert.equal(interview.validationEvidence.at(-1)?.type, "interview");
const accepted = analyze(inputWithTracked([tracked(internship.id, "Accepted")]));
assert.equal(accepted.validationEvidence.at(-1)?.type, "acceptance");

const explicitGoalInput = inputWithTracked([], {
  profile: { firstName: "Test", schoolSlug: "test", major: "Mathematics", graduationYear: "2029", year: "First year", careerGoal: "Quant Finance", interests: "Finance", onboardingCompletedAt: dates[0] },
});
const explicitGoal = analyze(explicitGoalInput);
assert.equal(explicitGoal.primaryDirectionKey, "career:quantitative-finance");
assert.equal(explicitGoal.directions.find((item) => item.key === explicitGoal.primaryDirectionKey)?.state, "exploring", "A profile goal alone expresses intent, not completed progress.");

const goalChangeInput: OpenLineInput = {
  userId: "goal-change",
  directionHistory: [
    { type: "goal_selected", occurredAt: dates[0], careerDirection: "Medicine" },
    { type: "goal_changed", occurredAt: dates[2], careerDirection: "Data Science", previousCareerDirection: "Medicine" },
  ],
};
const goalChange = analyze(goalChangeInput);
assert.equal(goalChange.transitions.at(-1)?.type, "shifted");
assert.equal(goalChange.directions.find((item) => item.key === "career:medicine")?.state, "paused");
assert.ok(goalChange.directions.some((item) => item.key === "career:data-science"));

const expansion = analyze({
  userId: "expansion",
  directionHistory: [
    { type: "goal_selected", occurredAt: dates[0], careerDirection: "Research" },
    { type: "goal_selected", occurredAt: dates[2], careerDirection: "Entrepreneurship" },
  ],
});
assert.equal(expansion.transitions.at(-1)?.type, "expanded");

const pausedInput = inputWithTracked([tracked(internship.id, "Applying", dates[0], dates[1])], {
  directionHistory: [
    { type: "goal_selected", occurredAt: dates[0], careerDirection: "Quantitative Finance" },
    { type: "direction_paused", occurredAt: dates[3], careerDirection: "Quantitative Finance" },
  ],
});
const paused = analyze(pausedInput);
assert.equal(paused.directions.find((item) => item.key === "career:quantitative-finance")?.state, "paused");

const resumedInput = inputWithTracked([tracked(internship.id, "Submitted", dates[4], dates[5])], {
  directionHistory: [
    { type: "goal_selected", occurredAt: dates[0], careerDirection: "Quantitative Finance" },
    { type: "direction_paused", occurredAt: dates[2], careerDirection: "Quantitative Finance" },
  ],
});
const resumed = analyze(resumedInput);
const resumedDirections = resumed.directions.filter((item) => item.key === "career:quantitative-finance");
assert.equal(resumedDirections.length, 1, "A resumed direction must retain its canonical branch identity.");
assert.equal(resumedDirections[0].state, "rejoined");
assert.ok(resumed.transitions.some((transition) => transition.type === "rejoined"));

const rejectedInput = inputWithTracked([tracked(internship.id, "Rejected")], {
  directionHistory: [{ type: "goal_selected", occurredAt: dates[0], careerDirection: "Quantitative Finance" }],
});
const rejected = analyze(rejectedInput);
const closedOpportunity = rejected.directions.find((item) => item.parentDirectionKey === "experience:internships");
assert.equal(closedOpportunity?.state, "closed", "Rejection closes the opportunity-specific path.");
assert.notEqual(rejected.directions.find((item) => item.key === "career:quantitative-finance")?.state, "closed", "One rejection cannot close the broader career direction.");

const multipleCareers = analyze({
  userId: "careers",
  directionHistory: [
    { type: "goal_selected", occurredAt: dates[0], careerDirection: "Research" },
    { type: "goal_selected", occurredAt: dates[1], careerDirection: "Entrepreneurship" },
  ],
});
assert.equal(multipleCareers.directions.filter((item) => item.kind === "career").length, 2);

const skillInput: OpenLineInput = {
  userId: "skills",
  manualEvidence: [
    { id: "artifact-a", occurredAt: dates[0], label: "Analysis notebook", skillIds: ["Data Analysis"], publicSafe: false },
    { id: "artifact-b", occurredAt: dates[1], label: "Analytics notebook", skillIds: ["Data Analytics"], publicSafe: false },
  ],
};
const skills = analyze(skillInput);
assert.equal(skills.directions.filter((item) => item.kind === "skill").length, 1, "Skill aliases must merge into one strand.");
assert.equal(skills.directions[0].evidenceEventIds.length, 2);
assert.ok(skills.diagnostics.ignoredCandidates.some((item) => item.reason === "duplicate_alias"));

const completedRejoinInput = inputWithTracked([tracked(internship.id, "Completed")], {
  profile: { firstName: "Test", schoolSlug: "test", major: "Mathematics", graduationYear: "2029", year: "First year", careerGoal: "Quantitative Finance", interests: "Finance", onboardingCompletedAt: dates[0] },
});
const completedRejoin = analyze(completedRejoinInput);
assert.ok(completedRejoin.rejoins.some((item) => item.reason === "experience_completed"));
assert.equal(completedRejoin.validationEvidence.some((item) => item.type === "completed_experience"), true);

const sharedInput = inputWithTracked([
  tracked(research.id, "Completed", dates[0], dates[4]),
  tracked(internship.id, "Completed", dates[1], dates[5]),
], {
  profile: { firstName: "Test", schoolSlug: "test", major: "Mathematics", graduationYear: "2029", year: "First year", careerGoal: "Quantitative Finance", interests: "Finance", onboardingCompletedAt: dates[0] },
});
const shared = analyze(sharedInput);
assert.ok(shared.rejoins.some((item) => item.reason === "shared_goal"), "Explicit career metadata can support a shared-goal rejoin.");
assert.ok(shared.rejoins.some((item) => item.reason === "shared_skill" && item.supportingSkillIds?.includes("python")), "Verified activities can rejoin through an explicitly shared skill.");

const math = opportunity("math", "Competitions", { careerPaths: ["Mathematics"] });
const software = opportunity("software", "Internships", { careerPaths: ["Software Engineering"] });
const quant = opportunity("quant", "Fellowships", { careerPaths: ["Quantitative Finance"] });
const synthesisInput: OpenLineInput = {
  ...inputWithTracked([
    tracked(math.id, "Applying", dates[0], dates[3]),
    tracked(software.id, "Applying", dates[1], dates[4]),
    tracked(quant.id, "Accepted", dates[2], dates[5]),
  ]),
  opportunities: [...opportunities, math, software, quant],
  directionHistory: [
    { type: "goal_selected", occurredAt: dates[0], careerDirection: "Mathematics" },
    { type: "goal_selected", occurredAt: dates[1], careerDirection: "Software Engineering" },
    { type: "goal_changed", occurredAt: dates[2], careerDirection: "Quantitative Finance", previousCareerDirection: "Software Engineering" },
  ],
};
const synthesis = analyze(synthesisInput);
assert.ok(synthesis.rejoins.some((item) => item.reason === "direction_synthesis"), "Only an explicit synthesis rule may combine separate directions.");

const keywordOnlyA = opportunity("keyword-a", "Competitions", { title: "Python finance project" });
const keywordOnlyB = opportunity("keyword-b", "Fellowships", { title: "Python finance program" });
const keywordOnly = analyze({
  ...inputWithTracked([tracked(keywordOnlyA.id, "Completed"), tracked(keywordOnlyB.id, "Completed", dates[1], dates[3])]),
  opportunities: [keywordOnlyA, keywordOnlyB],
});
assert.equal(keywordOnly.rejoins.some((item) => item.reason === "shared_goal" || item.reason === "shared_skill"), false, "Titles and keywords alone cannot create a rejoin.");

const stableBase = inputWithTracked([
  tracked(research.id, "Submitted", dates[0], dates[5]),
  tracked(internship.id, "Applying", dates[1], dates[4]),
]);
const stableBefore = analyze(stableBase);
const stableAfter = analyze({
  ...stableBase,
  activity: { ...stableBase.activity!, saved: [...stableBase.activity!.saved, scholarship.id] },
  savedRecords: [{ opportunityId: scholarship.id, savedAt: dates[6] }],
});
assert.equal(stableAfter.primaryDirectionKey, stableBefore.primaryDirectionKey, "A low-importance save cannot reshuffle the primary direction.");
assert.deepEqual(stableAfter.secondaryDirectionKeys.filter((key) => !key.includes("scholarship")), stableBefore.secondaryDirectionKeys);

const overflowInput = inputWithTracked([
  tracked(research.id, "Applying", dates[0], dates[5]),
  tracked(internship.id, "Applying", dates[1], dates[6]),
  tracked(scholarship.id, "Applying", dates[2], dates[7]),
  tracked(competition.id, "Applying", dates[3], dates[8]),
  tracked(fellowship.id, "Applying", dates[4], dates[9]),
  tracked(campusJob.id, "Applying", dates[5], dates[10]),
]);
const desktop = analyze(overflowInput, 3);
const mobile = analyze(overflowInput, 2);
assert.ok(desktop.secondaryDirectionKeys.length > 3, "Overflow directions remain in the model.");
assert.equal(desktop.visibleSecondaryDirectionKeys.length, 3);
assert.equal(mobile.visibleSecondaryDirectionKeys.length, 2);
assert.deepEqual(mobile.visibleSecondaryDirectionKeys, desktop.visibleSecondaryDirectionKeys.slice(0, 2));
assert.ok(desktop.diagnostics.ignoredCandidates.some((item) => item.reason === "display_limit"));

const publicBase = buildPathprint(inputWithTracked([tracked(internship.id, "Accepted")], {
  directionHistory: [{ type: "goal_selected", occurredAt: dates[0], careerDirection: "Quantitative Finance" }],
}));
const publicWithPrivate = buildPathprint(inputWithTracked([tracked(internship.id, "Accepted")], {
  directionHistory: [
    { type: "goal_selected", occurredAt: dates[0], careerDirection: "Quantitative Finance" },
    { type: "goal_selected", occurredAt: dates[2], careerDirection: "Private Experimental Direction" },
    { type: "direction_paused", occurredAt: dates[3], careerDirection: "Private Experimental Direction" },
  ],
}));
const publicA = createPublicPathprint(publicBase);
const publicB = createPublicPathprint(publicWithPrivate);
assert.equal(publicA.signature, publicB.signature, "Hidden private direction activity cannot alter the public signature.");
assert.deepEqual(publicA.branches, publicB.branches, "Public branch ordering is projected only from public events.");
assert.equal(JSON.stringify(publicB).includes("Private Experimental Direction"), false);

const repeatA = analyze(sharedInput);
const repeatB = analyze(sharedInput);
assert.deepEqual(repeatA, repeatB, "Branch analysis must be deterministic across repeated runs.");
assert.equal(repeatA.signature, repeatB.signature);
assert.equal(repeatA.signature, "3c681c89edb820ed", "Canonical branch signature must remain stable.");
assert.equal(publicA.signature, "bd9a4b0b50fdc61f", "Canonical public Pathprint signature must remain stable.");

const legacy = buildPathprint({
  userId: "legacy",
  opportunities,
  activity: { viewed: [], saved: [research.id], claimed: [], tracked: {} },
  savedRecords: [{ opportunityId: research.id, savedAt: dates[0] }],
});
assert.equal(legacy.events[0]?.kind, "explored", "Legacy saved records remain compatible.");

const malformed = opportunity("malformed", "Internships");
(malformed.metadata as { careerPaths?: unknown; skillsGained?: unknown }).careerPaths = "not-an-array";
(malformed.metadata as { careerPaths?: unknown; skillsGained?: unknown }).skillsGained = { invalid: true };
assert.doesNotThrow(() => analyze({ ...inputWithTracked([tracked(malformed.id, "Applying")]), opportunities: [malformed] }));

const fixtureStartedAt = performance.now();
const typicalEvents = normalizeJourneyEvents(overflowInput).events;
const largeEvents: JourneyEvent[] = Array.from({ length: 2_000 }, (_, index) => ({
  id: `large-event-${index}`,
  userId: "large-history",
  type: index % 5 === 0 ? "application_submitted" : index % 3 === 0 ? "application_started" : "opportunity_chosen",
  occurredAt: new Date(Date.UTC(2020, 0, 1) + index * 3_600_000).toISOString(),
  opportunityId: `large-opportunity-${index % 20}`,
  category: ["internship", "research", "competition", "scholarship"][index % 4],
  source: "journey_status",
  visibility: "private",
  publicSafe: false,
}));
const largeInput: OpenLineInput = { userId: "large-history" };
const normalizationInput: OpenLineInput = {
  userId: "large-normalization",
  activity: {
    viewed: [],
    saved: [],
    claimed: [],
    tracked: Object.fromEntries(Array.from({ length: 1_000 }, (_, index) => {
      const id = `normalized-branch-${index}`;
      const savedAt = new Date(Date.UTC(2020, 0, 1) + index * 7_200_000).toISOString();
      const updatedAt = new Date(Date.UTC(2020, 0, 1) + index * 7_200_000 + 3_600_000).toISOString();
      return [id, { id, status: index % 5 === 0 ? "Submitted" as const : "Applying" as const, savedAt, updatedAt }];
    })),
  },
};
const fixtureCreationMs = performance.now() - fixtureStartedAt;

type BenchmarkSummary = { average: number; p95: number; maximum: number; samples: number };
let benchmarkBookkeepingMs = 0;
const summarize = (values: readonly number[]): BenchmarkSummary => {
  const ordered = [...values].sort((a, b) => a - b);
  return {
    average: values.reduce((total, value) => total + value, 0) / values.length,
    p95: ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * 0.95) - 1))] ?? 0,
    maximum: ordered.at(-1) ?? 0,
    samples: values.length,
  };
};
const benchmark = (warmupRuns: number, measuredRuns: number, operation: () => void) => {
  for (let index = 0; index < warmupRuns; index += 1) operation();
  const durations: number[] = [];
  for (let index = 0; index < measuredRuns; index += 1) {
    const startedAt = performance.now();
    operation();
    durations.push(performance.now() - startedAt);
  }
  const bookkeepingStartedAt = performance.now();
  const summary = summarize(durations);
  benchmarkBookkeepingMs += performance.now() - bookkeepingStartedAt;
  return summary;
};

const normalizationBenchmark = benchmark(8, 30, () => { normalizeJourneyEvents(normalizationInput); });
const typicalBenchmark = benchmark(20, 150, () => { analyzeJourneyBranches(overflowInput, typicalEvents); });
const largeBenchmark = benchmark(10, 40, () => { analyzeJourneyBranches(largeInput, largeEvents); });

const stageDurations = new Map<BranchIntelligenceBuildStage, number[]>();
for (let run = 0; run < 20; run += 1) {
  analyzeJourneyBranches(largeInput, largeEvents, {}, (stage, durationMs) => {
    const values = stageDurations.get(stage) ?? [];
    values.push(durationMs);
    stageDurations.set(stage, values);
  });
}
const branchStages = Object.fromEntries([...stageDurations.entries()].map(([stage, values]) => [stage, summarize(values)]));

const assertionStartedAt = performance.now();
if (strictBenchmark) {
  assert.ok(typicalBenchmark.p95 < 5, `Typical branch analysis p95 must remain under 5ms; measured ${typicalBenchmark.p95.toFixed(2)}ms.`);
  assert.ok(largeBenchmark.average < 15, `Large-history branch analysis average must remain under 15ms; measured ${largeBenchmark.average.toFixed(2)}ms.`);
  assert.ok(largeBenchmark.p95 < 25, `Large-history branch analysis p95 must remain under 25ms; measured ${largeBenchmark.p95.toFixed(2)}ms.`);
  assert.ok(largeBenchmark.maximum < 75, `Large-history branch analysis must remain under the 75ms hard ceiling; measured ${largeBenchmark.maximum.toFixed(2)}ms.`);
} else {
  assert.ok(largeBenchmark.maximum < 250, `Large-history branch analysis exceeded the deployment catastrophic ceiling of 250ms; measured ${largeBenchmark.maximum.toFixed(2)}ms.`);
}
const assertionMs = performance.now() - assertionStartedAt;

console.log(JSON.stringify({
  message: "Open Line branch intelligence checks passed.",
  mode: strictBenchmark ? "strict_benchmark" : "build_safe",
  fixtureCreationMs: Number(fixtureCreationMs.toFixed(3)),
  normalization: normalizationBenchmark,
  typicalBranchAnalysis: typicalBenchmark,
  largeBranchAnalysis: largeBenchmark,
  branchStages,
  benchmarkBookkeepingMs: Number(benchmarkBookkeepingMs.toFixed(3)),
  assertionMs: Number(assertionMs.toFixed(3)),
}, null, 2));
