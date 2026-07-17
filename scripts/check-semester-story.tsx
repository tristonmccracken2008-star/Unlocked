import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { SemesterStoryArtwork } from "../components/semester-story-artwork";
import type { Opportunity } from "../data/opportunities";
import type { PathEvent, Pathprint } from "../data/open-line/index";
import { stableHash } from "../data/open-line/index";
import { buildSemesterStories, defaultAcademicTerm, semesterStoryLayouts, type AcademicTerm } from "../lib/semester-story";

const opportunity = {
  id: "semester-opportunity",
  title: "Private Research Fellowship",
  organization: "Private Research Organization",
  category: "Research",
} as Opportunity;

function event(id: string, kind: PathEvent["kind"], occurredAt: string, branchKey = "main"): PathEvent {
  const levels: Partial<Record<PathEvent["kind"], PathEvent["progressLevel"]>> = {
    chosen: "intention",
    active: "action",
    submitted: "commitment",
    validated: "validation",
    accepted: "validation",
    completed: "validation",
    explored: "exploration",
  };
  return {
    id,
    kind,
    occurredAt,
    progressLevel: levels[kind] ?? "exploration",
    title: `Private ${kind} title`,
    narrative: `Private ${kind} narrative`,
    whatChanged: "Private evidence details",
    opportunityId: opportunity.id,
    organizationId: "private-organization-id",
    careerDirection: "Private quantitative direction",
    category: opportunity.category,
    branchKey,
    importance: kind === "accepted" ? 98 : kind === "validated" ? 90 : 70,
    shareable: kind !== "chosen",
    publicSafe: kind !== "chosen",
  };
}

function pathprint(events: PathEvent[], horizonTitle = "Private future recommendation"): Pathprint {
  const origin = event("private-origin", "origin", "2025-09-01T00:00:00.000Z");
  const alternate = events.filter((item) => item.branchKey === "private-branch");
  return {
    version: "fixture-v1",
    signature: stableHash(events),
    userId: "private-user-id",
    generatedAt: "2026-07-16T12:00:00.000Z",
    origin,
    events,
    branches: alternate.length ? [{ key: "private-branch", label: "Private direction label", eventIds: alternate.map((item) => item.id), startedAt: alternate[0].occurredAt!, state: "active" }] : [],
    horizon: [{ id: "private-horizon", title: horizonTitle, rationale: "Private rationale" }],
    summary: { strongestProgressLevel: "validation", meaningfulEventCount: events.length, validationCount: events.filter((item) => item.progressLevel === "validation").length },
  };
}

const events = [
  event("fall-chosen", "chosen", "2025-09-12T12:00:00.000Z"),
  event("fall-active", "active", "2025-10-01T12:00:00.000Z"),
  event("winter-active", "active", "2026-01-08T12:00:00.000Z"),
  event("winter-submitted", "submitted", "2026-01-20T12:00:00.000Z"),
  event("spring-direction", "chosen", "2026-02-08T12:00:00.000Z", "private-branch"),
  event("spring-submitted", "submitted", "2026-03-04T12:00:00.000Z", "private-branch"),
  event("spring-interview", "validated", "2026-04-12T12:00:00.000Z", "private-branch"),
  event("spring-accepted", "accepted", "2026-05-06T12:00:00.000Z", "private-branch"),
  event("summer-completed", "completed", "2026-06-28T12:00:00.000Z", "private-branch"),
  event("summer-submitted", "submitted", "2026-07-10T12:00:00.000Z"),
  event("ignored-exploration", "explored", "2026-07-12T12:00:00.000Z"),
];

const identity = { firstName: "Triston", fullName: "Triston Private", school: "Private University", major: "Mathematics", profileHref: "/profile" };
const collection = buildSemesterStories({ pathprint: pathprint(events), opportunities: [opportunity], identity });

assert.equal(collection.stories.length, 4, "Meaningful evidence must be grouped into Fall, Winter, Spring, and Summer terms.");
assert.equal(collection.selectedTermId, "summer-2026", "The active term must be selected first.");
assert.equal(collection.stories[0].state, "active");
assert.equal(collection.stories[0].heading, "Summer 2026 so far");
assert.equal(collection.stories.find((story) => story.term.id === "spring-2026")?.state, "completed");
assert.equal(collection.stories.find((story) => story.term.id === "spring-2026")?.moments.length, 4, "A story must include no more than four meaningful moments.");
assert.ok(collection.stories.every((story) => story.moments.length >= 1 && story.moments.length <= 4));
assert.ok(collection.stories.every((story) => story.counts.length <= 3));
assert.ok(collection.stories.every((story) => story.geometry.geometry.openEndpointNodeId), "Every term Pathprint must preserve an open endpoint.");
assert.ok(collection.stories.every((story) => story.geometry.geometry.nodes.every((node) => !node.eventId?.includes("private"))), "Term geometry cannot expose source event IDs.");
assert.ok(collection.stories.every((story) => story.geometry.geometry.branches.every((branch) => !branch.key.includes("private-branch"))), "Term geometry must replace private branch keys.");
assert.equal(collection.diagnostics.suppressedEvents["kind:explored"], 1, "Exploration activity must be suppressed.");
assert.deepEqual(collection.defaultPrivacy, {
  nameMode: "anonymous",
  includeSchool: false,
  includeMajor: false,
  includeTerm: true,
  includeOpportunity: false,
  includeOrganization: false,
  includeDate: false,
  includeCounts: false,
  includeProfileLink: false,
});

const spring = collection.stories.find((story) => story.term.id === "spring-2026")!;
assert.match(spring.opening, /external validation|real opportunity/);
assert.ok(spring.whatChanged.some((item) => /validation|opportunity/i.test(item)));
assert.ok(spring.comparison, "A stronger term may compare with the prior term when both contain enough reliable evidence.");

const comparisonOmitted = buildSemesterStories({
  pathprint: pathprint([event("quiet-fall", "chosen", "2025-09-10T12:00:00.000Z"), event("quiet-spring", "active", "2026-02-10T12:00:00.000Z")]),
  opportunities: [opportunity],
  identity,
});
assert.ok(comparisonOmitted.stories.every((story) => !story.comparison), "Sparse terms cannot produce a comparison.");

const sparse = buildSemesterStories({ pathprint: pathprint([event("only-submission", "submitted", "2026-03-01T12:00:00.000Z")]), opportunities: [opportunity], identity });
assert.equal(sparse.stories[0].moments.length, 1);
assert.match(sparse.stories[0].opening, /concrete action/);

const empty = buildSemesterStories({ pathprint: pathprint([event("only-view", "explored", "2026-03-01T12:00:00.000Z")]), opportunities: [opportunity], identity });
assert.equal(empty.stories.length, 0, "A term with no qualifying progress must not create a dead recap.");

assert.equal(defaultAcademicTerm("2026-01-31T23:59:59.999Z").id, "winter-2026");
assert.equal(defaultAcademicTerm("2026-02-01T00:00:00.000Z").id, "spring-2026");
assert.equal(defaultAcademicTerm("2026-05-31T23:59:59.999Z").id, "spring-2026");
assert.equal(defaultAcademicTerm("2026-06-01T00:00:00.000Z").id, "summer-2026");
assert.equal(defaultAcademicTerm("2026-09-01T00:00:00.000Z").academicYear, "2026\u201327");

const customTerm: AcademicTerm = {
  id: "quarter-autumn-2025",
  label: "Autumn Quarter 2025",
  season: "fall",
  startDate: "2025-09-20T00:00:00.000Z",
  endDate: "2025-12-15T23:59:59.999Z",
  academicYear: "2025\u201326",
  source: "school_calendar",
};
const custom = buildSemesterStories({ pathprint: pathprint([event("quarter-event", "submitted", "2025-09-25T12:00:00.000Z")]), opportunities: [opportunity], identity, termOverrides: [customTerm] });
assert.equal(custom.stories[0].term.id, customTerm.id);
assert.equal(custom.diagnostics.calendarSource, "school_calendar");

const repeat = buildSemesterStories({ pathprint: pathprint(events), opportunities: [opportunity], identity });
assert.equal(repeat.diagnostics.deterministicSignature, collection.diagnostics.deterministicSignature);
assert.deepEqual(repeat.stories.map((story) => story.signature), collection.stories.map((story) => story.signature));

const changedHorizon = buildSemesterStories({ pathprint: pathprint(events, "A completely different future recommendation"), opportunities: [opportunity], identity });
assert.deepEqual(changedHorizon.stories.filter((story) => story.state === "completed").map((story) => story.signature), collection.stories.filter((story) => story.state === "completed").map((story) => story.signature), "Finalized stories cannot change when later recommendation logic changes.");

for (const layout of Object.keys(semesterStoryLayouts) as Array<keyof typeof semesterStoryLayouts>) {
  const anonymousMarkup = renderToStaticMarkup(<SemesterStoryArtwork story={spring} layout={layout} privacy={collection.defaultPrivacy} identity={identity} />);
  assert.match(anonymousMarkup, new RegExp(`width="${semesterStoryLayouts[layout].width}"`));
  assert.match(anonymousMarkup, new RegExp(`height="${semesterStoryLayouts[layout].height}"`));
  assert.match(anonymousMarkup, /data-open-line-renderer/);
  assert.ok(anonymousMarkup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").includes(spring.opening), "Export artwork must preserve the complete opening statement.");
  assert.doesNotMatch(anonymousMarkup, /Triston|Private University|Private Research Fellowship|Private Research Organization|private-user-id|private-organization-id|Private quantitative direction/);
  assert.doesNotMatch(anonymousMarkup, /GPA|rejection|citizenship|eligibility/i);
  const namedMarkup = renderToStaticMarkup(<SemesterStoryArtwork story={spring} layout={layout} privacy={{ ...collection.defaultPrivacy, nameMode: "full_name", includeSchool: true, includeMajor: true, includeOpportunity: true, includeOrganization: true, includeDate: true, includeCounts: true, includeProfileLink: true }} identity={identity} />);
  assert.match(namedMarkup, /Triston Private/);
  assert.match(namedMarkup, /Private University/);
  assert.match(namedMarkup, /Mathematics/);
  const darkMarkup = renderToStaticMarkup(<SemesterStoryArtwork story={spring} layout={layout} privacy={collection.defaultPrivacy} identity={identity} theme="dark" />);
  assert.match(darkMarkup, /data-export-theme="dark"/);
  assert.match(darkMarkup, /fill="#17120f"/);
  assert.match(darkMarkup, new RegExp(`width="${semesterStoryLayouts[layout].width}"`));
  assert.match(darkMarkup, new RegExp(`height="${semesterStoryLayouts[layout].height}"`));
}

const creatorSource = readFileSync(new URL("../components/semester-story-creator.tsx", import.meta.url), "utf8");
const entrySource = readFileSync(new URL("../components/semester-story-entry.tsx", import.meta.url), "utf8");
const artworkSource = readFileSync(new URL("../components/semester-story-artwork.tsx", import.meta.url), "utf8");
assert.match(creatorSource, /XMLSerializer/);
assert.match(creatorSource, /canvas\.toBlob/);
assert.match(creatorSource, /ClipboardItem/);
assert.match(creatorSource, /navigator\.share/);
assert.match(entrySource, /import\("@\/components\/semester-story-creator"\)/, "Export tools must load only after the entry point is activated.");
assert.doesNotMatch(artworkSource, /gradient|confetti|trophy|ranking|streak|dashboard/i);

for (let index = 0; index < 8; index += 1) buildSemesterStories({ pathprint: pathprint(events), opportunities: [opportunity], identity });
const durations: number[] = [];
for (let index = 0; index < 50; index += 1) {
  const started = performance.now();
  buildSemesterStories({ pathprint: pathprint(events), opportunities: [opportunity], identity });
  durations.push(performance.now() - started);
}
durations.sort((left, right) => left - right);
const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
const p95 = durations[Math.floor(durations.length * .95)];
assert.ok(average < 20, `Semester Story projection average must remain under 20ms; received ${average.toFixed(2)}ms.`);
assert.ok(p95 < 45, `Semester Story projection p95 must remain under 45ms; received ${p95.toFixed(2)}ms.`);

console.log("Semester Story checks passed", {
  stories: collection.stories.length,
  includedEvents: collection.diagnostics.includedEventCount,
  averageMs: Number(average.toFixed(2)),
  p95Ms: Number(p95.toFixed(2)),
  signature: collection.diagnostics.deterministicSignature,
});
