import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunities, type Opportunity } from "../data/opportunities";
import { buildPathprint, type OpenLineInput } from "../data/open-line/index";
import type { JourneyProgressTransition, TrackedOpportunity } from "../data/student-activity";
import { PathMomentArtwork } from "../components/path-moment-artwork";
import { buildPathMoments, pathMomentLayouts, type PathMomentType } from "../lib/path-moments";

const baseOpportunity = opportunities.find((item) => item.type === "Career" && item.category === "Internships") ?? opportunities[0];
assert.ok(baseOpportunity, "A catalog opportunity is required for Path Moment fixtures.");

const timestamps = [
  "2026-01-08T12:00:00.000Z",
  "2026-01-10T12:00:00.000Z",
  "2026-01-15T12:00:00.000Z",
  "2026-02-02T12:00:00.000Z",
  "2026-02-18T12:00:00.000Z",
  "2026-03-05T12:00:00.000Z",
  "2026-04-20T12:00:00.000Z",
] as const;

const transitions: Array<{ transition: JourneyProgressTransition; priorStatus: TrackedOpportunity["status"]; resultingStatus: TrackedOpportunity["status"] }> = [
  { transition: "choose", priorStatus: "Saved", resultingStatus: "Interested" },
  { transition: "start", priorStatus: "Interested", resultingStatus: "Applying" },
  { transition: "submit", priorStatus: "Applying", resultingStatus: "Submitted" },
  { transition: "interview", priorStatus: "Submitted", resultingStatus: "Interview" },
  { transition: "accept", priorStatus: "Interview", resultingStatus: "Accepted" },
  { transition: "complete", priorStatus: "Accepted", resultingStatus: "Completed" },
];

function tracked(opportunityId: string): TrackedOpportunity {
  return {
    id: opportunityId,
    status: "Completed",
    savedAt: timestamps[0],
    updatedAt: timestamps.at(-1) as string,
    version: transitions.length,
    history: transitions.map((transition, index) => ({ id: `history-${index}`, ...transition, occurredAt: timestamps[index + 1] })),
  };
}

function inputFor(opportunity: Opportunity, extra: Partial<OpenLineInput> = {}): OpenLineInput {
  const record = tracked(opportunity.id);
  return {
    userId: "path-moment-test-user",
    profile: null,
    activity: { viewed: [], saved: [opportunity.id], claimed: [], tracked: { [opportunity.id]: record } },
    savedRecords: [{ opportunityId: opportunity.id, savedAt: record.savedAt }],
    opportunities: [opportunity],
    generatedAt: timestamps.at(-1),
    ...extra,
  };
}

function collectionFor(opportunity: Opportunity = baseOpportunity, extra: Partial<OpenLineInput> = {}) {
  return buildPathMoments({
    pathprint: buildPathprint(inputFor(opportunity, extra)),
    opportunities: [opportunity],
    identity: { firstName: "Triston", fullName: "Triston McCracken", school: "University of Chicago" },
  });
}

const collection = collectionFor();
const types = new Set(collection.moments.map((moment) => moment.type));
for (const expected of ["first_application", "first_submission", "first_interview", "first_acceptance", "first_completed_experience", "semester_recap"] satisfies PathMomentType[]) {
  assert.ok(types.has(expected), `${expected} must be generated from canonical transition evidence.`);
}
assert.equal(collection.defaultPrivacy.nameMode, "anonymous");
assert.equal(collection.defaultPrivacy.includeSchool, false);
assert.equal(collection.defaultPrivacy.includeOrganization, false);
assert.equal(collection.defaultPrivacy.includeOpportunity, false);
assert.equal(collection.defaultPrivacy.includeDate, false);
assert.ok(collection.moments.every((moment) => moment.geometry.geometry.nodes.length === 1), "Each Path Moment must contain exactly one semantic marker.");
assert.ok(collection.moments.every((moment) => moment.geometry.geometry.segments.length <= 2), "Each Path Moment must crop one local Pathprint segment.");
assert.ok(collection.moments.every((moment) => /^I\b|^This semester\b/.test(moment.headline)), "Path Moment headlines must use calm first-person narrative language.");
assert.ok(collection.moments.every((moment) => !/crushing it|you are amazing|great job/i.test(`${moment.headline} ${moment.explanation}`)), "Path Moments cannot use generic motivational copy.");
assert.equal(collection.diagnostics.suppressedSavedCount > 0, true, "Saved activity must be explicitly suppressed.");

const savedOnly = buildPathMoments({
  pathprint: buildPathprint({
    userId: "saved-only",
    activity: { viewed: [], saved: [baseOpportunity.id], claimed: [], tracked: {} },
    savedRecords: [{ opportunityId: baseOpportunity.id, savedAt: timestamps[0] }],
    opportunities: [baseOpportunity],
    generatedAt: timestamps[0],
  }),
  opportunities: [baseOpportunity],
  identity: { firstName: "Student", fullName: "Student" },
});
assert.equal(savedOnly.moments.length, 0, "Routine saved opportunities must never produce Path Moments.");

function specialized(category: string, type: Opportunity["type"] = "Career") {
  return { ...baseOpportunity, id: `fixture-${category.toLowerCase().replace(/\W+/g, "-")}`, category, type } as Opportunity;
}

const specializedExpectations: Array<[Opportunity, PathMomentType]> = [
  [specialized("Research", "Research"), "first_research_experience"],
  [specialized("Scholarships", "Scholarship"), "scholarship"],
  [specialized("Fellowships"), "fellowship"],
  [specialized("Leadership Programs"), "leadership"],
  [specialized("Portfolio Projects"), "portfolio_milestone"],
];
for (const [opportunity, expected] of specializedExpectations) assert.ok(collectionFor(opportunity).moments.some((moment) => moment.type === expected), `${expected} must be supported.`);

const directionPath = buildPathprint({
  userId: "direction-shift",
  directionHistory: [{ id: "direction-one", type: "goal_selected", occurredAt: timestamps[0], careerDirection: "Software Engineering" }, { id: "direction-two", type: "goal_changed", occurredAt: timestamps[1], careerDirection: "Quantitative Finance", previousCareerDirection: "Software Engineering" }],
  generatedAt: timestamps[1],
});
const directionMoments = buildPathMoments({ pathprint: directionPath, opportunities: [], identity: { firstName: "Student", fullName: "Student" } });
assert.ok(directionMoments.moments.some((moment) => moment.type === "career_direction_shift"), "Canonical career-direction shifts must be supported.");

const repeat = collectionFor();
assert.equal(repeat.diagnostics.deterministicSignature, collection.diagnostics.deterministicSignature, "Path Moment projections must remain deterministic.");
assert.deepEqual(repeat.moments.map((moment) => moment.signature), collection.moments.map((moment) => moment.signature));

const first = collection.moments[0];
for (const layout of Object.keys(pathMomentLayouts) as Array<keyof typeof pathMomentLayouts>) {
  const markup = renderToStaticMarkup(<PathMomentArtwork
    moment={first}
    layout={layout}
    privacy={{ nameMode: "anonymous", includeSchool: false, includeOrganization: false, includeOpportunity: false, includeDate: false }}
    identity={collection.identity}
  />);
  assert.match(markup, new RegExp(`width="${pathMomentLayouts[layout].width}"`));
  assert.match(markup, new RegExp(`height="${pathMomentLayouts[layout].height}"`));
  assert.match(markup, /data-open-line-renderer/);
  assert.doesNotMatch(markup, /…/, "Path Moment headlines and explanations must fit without truncation.");
  assert.doesNotMatch(markup, /Triston|University of Chicago|GPA|rejection|application counts|internal IDs/i, "Anonymous artwork must not contain optional or sensitive identity data.");
  const darkMarkup = renderToStaticMarkup(<PathMomentArtwork
    moment={first}
    layout={layout}
    privacy={{ nameMode: "anonymous", includeSchool: false, includeOrganization: false, includeOpportunity: false, includeDate: false }}
    identity={collection.identity}
    theme="dark"
  />);
  assert.match(darkMarkup, /data-export-theme="dark"/);
  assert.match(darkMarkup, /fill="#17120f"/);
  assert.match(darkMarkup, new RegExp(`width="${pathMomentLayouts[layout].width}"`));
  assert.match(darkMarkup, new RegExp(`height="${pathMomentLayouts[layout].height}"`));
}

const creatorSource = readFileSync(new URL("../components/path-moment-creator.tsx", import.meta.url), "utf8");
const entrySource = readFileSync(new URL("../components/path-moment-entry.tsx", import.meta.url), "utf8");
const artworkSource = readFileSync(new URL("../components/path-moment-artwork.tsx", import.meta.url), "utf8");
assert.match(creatorSource, /XMLSerializer/);
assert.match(creatorSource, /canvas\.toBlob/);
assert.match(creatorSource, /ClipboardItem/);
assert.match(creatorSource, /navigator\.share/);
assert.match(creatorSource, /initialPrivacy\(collection\)/);
assert.match(creatorSource, /GPA, notes, application counts, rejection history, internal IDs/);
assert.match(entrySource, /import\("@\/components\/path-moment-creator"\)/, "Path Moment exports must remain outside the initial Journey bundle.");
assert.match(entrySource, /onPointerEnter=\{preload\}/);
assert.match(entrySource, /onFocus=\{preload\}/);
assert.doesNotMatch(entrySource, /PathMomentArtwork|XMLSerializer|canvas\.toBlob/, "The entry boundary must remain lightweight.");
assert.doesNotMatch(artworkSource, /gradient|confetti|progress ring|chart/i);

for (let index = 0; index < 10; index += 1) collectionFor();
const durations: number[] = [];
for (let index = 0; index < 50; index += 1) {
  const started = performance.now();
  collectionFor();
  durations.push(performance.now() - started);
}
durations.sort((a, b) => a - b);
const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
const p95 = durations[Math.floor(durations.length * 0.95)];
assert.ok(average < 20, `Path Moment projection average must remain under 20ms; received ${average.toFixed(2)}ms.`);
assert.ok(p95 < 45, `Path Moment projection p95 must remain under 45ms; received ${p95.toFixed(2)}ms.`);

console.log("Path Moment checks passed", {
  supportedTypes: [...new Set([...types, ...specializedExpectations.map(([, type]) => type), "career_direction_shift"])].length,
  moments: collection.moments.length,
  averageMs: Number(average.toFixed(2)),
  p95Ms: Number(p95.toFixed(2)),
  signature: collection.diagnostics.deterministicSignature,
});
