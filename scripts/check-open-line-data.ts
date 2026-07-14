import assert from "node:assert/strict";
import type { Opportunity } from "../data/opportunities";
import { journeyEventImportance } from "../data/open-line/normalize";
import {
  buildPathprint,
  createPublicPathprint,
  getOpenLineDiagnostics,
  normalizeJourneyEvents,
  openLineInputFromAccount,
  waypointFromRecommendation,
  waypointFromRoadmap,
} from "../data/open-line";
import type { OpenLineInput } from "../data/open-line";
import type { StudentProfile } from "../data/student-profile";

const dates = {
  saved: "2026-01-10T12:00:00.000Z",
  changed: "2026-02-11T12:00:00.000Z",
  later: "2026-03-12T12:00:00.000Z",
  generated: "2026-07-14T12:00:00.000Z",
};

function opportunity(id: string, category = "Internships", type: Opportunity["type"] = "Career"): Opportunity {
  return {
    id,
    title: `${category} opportunity`,
    type,
    category,
    description: "A verified fixture for deterministic Open Line checks.",
    organization: "Fixture Organization",
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
    official_source: "https://example.edu/official",
    official_source_url: "https://example.edu/official",
    verification_status: "verified",
    last_verified: "2026-07-14",
    deadline: null,
    reviewer_notes: "Verified fixture.",
    estimated_value_note: "Unknown",
    date_added: "2026-07-14",
    difficulty: "Open",
    prestige: "Established",
    icon: null,
    featured: false,
    hidden_gem: false,
    metadata: {},
  };
}

const research = opportunity("research-one", "Research", "Research");
const researchTwo = opportunity("research-two", "Research", "Research");
const internship = opportunity("internship-one", "Internships");
const scholarship = opportunity("scholarship-one", "Scholarships", "Scholarship");
const opportunities = [research, researchTwo, internship, scholarship];

const profile: StudentProfile = {
  firstName: "Test",
  schoolSlug: "test-university",
  major: "Mathematics",
  graduationYear: "2029",
  year: "First year",
  careerGoal: "Quantitative Finance",
  interests: "Research, Finance",
  onboardingCompletedAt: dates.saved,
};

function trackedInput(status: "Saved" | "Interested" | "Applying" | "Submitted" | "Interview" | "Accepted" | "Rejected" | "Completed", id = internship.id): OpenLineInput {
  return {
    userId: "user-test",
    opportunities,
    activity: {
      viewed: [],
      saved: [id],
      claimed: [],
      tracked: { [id]: { id, status, savedAt: dates.saved, updatedAt: dates.changed } },
    },
    generatedAt: dates.generated,
  };
}

const empty = buildPathprint({ userId: "empty-user", generatedAt: dates.generated });
assert.equal(empty.events.length, 0, "An empty user must produce no inferred history.");
assert.equal(empty.branches.length, 0, "An empty user must produce no branches.");
assert.equal(empty.currentWaypoint, undefined, "An empty user must not receive an invented waypoint.");
assert.equal(empty.summary.strongestProgressLevel, "exploration");

const savedOnly = buildPathprint({
  userId: "saved-user",
  opportunities,
  activity: { viewed: [], saved: [research.id], claimed: [], tracked: {} },
  savedRecords: [{ opportunityId: research.id, savedAt: dates.saved }],
  generatedAt: dates.generated,
});
assert.deepEqual(savedOnly.events.map((event) => event.kind), ["explored"]);
assert.equal(savedOnly.branches.length, 0, "Saving alone must remain on the main line.");
assert.match(savedOnly.events[0].narrative, /began exploring research/i);

const chosen = buildPathprint(trackedInput("Saved"));
assert.equal(chosen.events[0].kind, "chosen");
assert.equal(chosen.events[0].progressLevel, "intention");
assert.equal(chosen.branches[0].key, "category:internship");

const expectedStatusEvents = [
  ["Applying", "active", "action"],
  ["Submitted", "submitted", "commitment"],
  ["Interview", "validated", "validation"],
  ["Accepted", "accepted", "validation"],
  ["Completed", "completed", "validation"],
] as const;
for (const [status, kind, progressLevel] of expectedStatusEvents) {
  const pathprint = buildPathprint(trackedInput(status));
  assert.equal(pathprint.events.at(-1)?.kind, kind, `${status} must map to ${kind}.`);
  assert.equal(pathprint.summary.strongestProgressLevel, progressLevel, `${status} must map to ${progressLevel}.`);
}
assert.ok(journeyEventImportance.application_submitted > journeyEventImportance.opportunity_saved, "Commitment must outweigh exploration without engagement points.");

const multipleBranches = buildPathprint({
  userId: "branch-user",
  opportunities,
  activity: {
    viewed: [],
    saved: [research.id, internship.id],
    claimed: [],
    tracked: {
      [research.id]: { id: research.id, status: "Submitted", savedAt: dates.saved, updatedAt: dates.changed },
      [internship.id]: { id: internship.id, status: "Applying", savedAt: dates.saved, updatedAt: dates.later },
    },
  },
  manualEvidence: [{ id: "python-project", occurredAt: dates.later, label: "Python analysis project", skillIds: ["Python"], visibility: "private" }],
  generatedAt: dates.generated,
});
assert.deepEqual(multipleBranches.branches.map((branch) => branch.key), ["category:internship", "category:research", "skill:python"]);

const directionPath = buildPathprint({
  userId: "direction-user",
  directionHistory: [
    { id: "one", type: "goal_selected", occurredAt: dates.saved, careerDirection: "Medicine" },
    { id: "two", type: "goal_changed", occurredAt: dates.changed, careerDirection: "Research", previousCareerDirection: "Medicine" },
    { id: "three", type: "direction_paused", occurredAt: dates.later, careerDirection: "Research" },
    { id: "four", type: "direction_closed", occurredAt: "2026-04-13T12:00:00.000Z", careerDirection: "Medicine" },
  ],
  generatedAt: dates.generated,
});
assert.equal(directionPath.summary.currentDirection, "Research");
assert.match(directionPath.events[1].narrative, /shifted your direction from Medicine to Research/i);
assert.equal(directionPath.branches.find((branch) => branch.key === "career:research")?.state, "paused");
assert.equal(directionPath.branches.find((branch) => branch.key === "career:medicine")?.state, "closed");

const repeated = buildPathprint({
  userId: "repeat-user",
  opportunities,
  activity: {
    viewed: [],
    saved: [research.id, scholarship.id],
    claimed: [],
    tracked: {
      [research.id]: { id: research.id, status: "Submitted", savedAt: dates.saved, updatedAt: dates.changed },
      [scholarship.id]: { id: scholarship.id, status: "Submitted", savedAt: dates.changed, updatedAt: dates.later },
    },
  },
  generatedAt: dates.generated,
});
const submittedNarratives = repeated.events.filter((event) => event.kind === "submitted").map((event) => event.narrative);
assert.match(submittedNarratives[0], /first research application/i);
assert.match(submittedNarratives[1], /first scholarship application/i, "First-event language is category-specific.");

const repeatedCategory = buildPathprint({
  userId: "repeat-category-user",
  opportunities,
  activity: {
    viewed: [],
    saved: [research.id, researchTwo.id],
    claimed: [],
    tracked: {
      [research.id]: { id: research.id, status: "Submitted", savedAt: dates.saved, updatedAt: dates.changed },
      [researchTwo.id]: { id: researchTwo.id, status: "Submitted", savedAt: dates.changed, updatedAt: dates.later },
    },
  },
  generatedAt: dates.generated,
});
assert.match(repeatedCategory.events.filter((event) => event.kind === "submitted")[1].narrative, /another research application/i, "Repeated events must not reuse first-event copy.");

const sameHistoryA = buildPathprint({ ...trackedInput("Submitted"), generatedAt: "2026-07-14T01:00:00.000Z" });
const sameHistoryB = buildPathprint({ ...trackedInput("Submitted"), generatedAt: "2026-07-14T02:00:00.000Z" });
assert.deepEqual(sameHistoryA.events, sameHistoryB.events, "Stable ordering and IDs must not depend on generation time.");
assert.equal(sameHistoryA.signature, sameHistoryB.signature, "The transformation signature must ignore generatedAt.");

const duplicateInput = trackedInput("Applying");
duplicateInput.progress = {
  milestones: {},
  applications: {
    [internship.id]: { opportunityId: internship.id, status: "applying", priority: "High", lastUpdated: dates.changed, source: "inferred" },
  },
};
const duplicateNormalization = normalizeJourneyEvents(duplicateInput);
assert.equal(duplicateNormalization.events.filter((event) => event.type === "application_started").length, 1, "Overlapping status sources must not duplicate semantic events.");
assert.equal(duplicateNormalization.diagnostics.ignored.duplicate_semantic_event, 1);

const recommendationWaypoint = waypointFromRecommendation({
  id: "recommendation-one",
  title: "Review a verified internship",
  reason: "It matches the student's current direction.",
  priority: "High",
  relatedOpportunityId: internship.id,
}, "45 minutes");
assert.ok(recommendationWaypoint);
const waypointPath = buildPathprint({ userId: "waypoint-user", currentWaypoint: recommendationWaypoint, generatedAt: dates.generated });
assert.equal(waypointPath.currentWaypoint?.estimatedMinutes, 45);
assert.equal(waypointPath.currentWaypoint?.source, "recommendation");
assert.equal(waypointFromRecommendation({ id: "bad", title: "", reason: "", priority: "High" }), null, "Unsafe incomplete recommendations must not become waypoints.");
assert.equal(waypointFromRoadmap({ id: "resume", title: "Create a resume", description: "Prepare before recruiting.", estimatedCompletionTime: "1-2 hours", importance: "High" })?.estimatedTime, "1-2 hours");

const legacyInput = openLineInputFromAccount({
  userId: "legacy-user",
  account: {
    profile: null,
    activity: { viewed: [], saved: [research.id], claimed: [], tracked: {} },
    savedOpportunities: [{ opportunityId: research.id, savedAt: dates.saved }],
    tracker: {},
  },
  generatedAt: dates.generated,
});
legacyInput.opportunities = opportunities;
assert.equal(buildPathprint(legacyInput).events[0]?.kind, "explored", "Legacy saved records must retain their persisted timestamp.");

const privatePath = buildPathprint({
  userId: "private-user-id",
  profile: { ...profile, gpa: 3.8, gpaStatus: "reported" },
  opportunities,
  activity: {
    viewed: [],
    saved: [internship.id],
    claimed: [],
    tracked: { [internship.id]: { id: internship.id, status: "Accepted", savedAt: dates.saved, updatedAt: dates.changed } },
  },
  directionHistory: [{ id: "closed-private", type: "direction_closed", occurredAt: dates.later, careerDirection: "Private Career Direction" }],
  manualEvidence: [{ id: "private-notes", occurredAt: dates.later, label: "Private note text", skillIds: ["Private Skill"], visibility: "private" }],
  generatedAt: dates.generated,
});
const publicPath = createPublicPathprint(privatePath);
const publicJson = JSON.stringify(publicPath);
for (const event of [publicPath.origin, ...publicPath.events]) {
  assert.equal("opportunityId" in event, false, "Public events must not expose opportunity IDs.");
  assert.equal("organizationId" in event, false, "Public events must not expose organization IDs.");
  assert.equal("careerDirection" in event, false, "Public events must not expose private career directions.");
}
for (const privateValue of ["private-user-id", "Private Career Direction", "Private note text", "3.8", "rejected"]) {
  assert.equal(publicJson.includes(privateValue), false, `Public Pathprints must exclude ${privateValue}.`);
}
assert.equal(publicPath.events.length, 1, "Only the explicitly shareable accepted event should remain public.");
assert.equal(publicPath.branches[0]?.state, "active", "Private closure state must not leak through a public branch.");
const privateHistoryChanged = createPublicPathprint(buildPathprint({
  ...trackedInput("Accepted"),
  userId: "another-private-user",
  directionHistory: [{ id: "unrelated-private-history", type: "goal_selected", occurredAt: dates.saved, careerDirection: "Private alternate direction" }],
}));
assert.equal(privateHistoryChanged.signature, publicPath.signature, "Equivalent public history must not reveal private-history changes through its signature.");

const diagnostics = getOpenLineDiagnostics({ ...trackedInput("Rejected"), profile: { ...profile, gpa: 3.9, gpaStatus: "reported" } });
const diagnosticJson = JSON.stringify(diagnostics);
for (const privateValue of ["user-test", internship.id, "Quantitative Finance", "3.9"]) {
  assert.equal(diagnosticJson.includes(privateValue), false, "Diagnostics must contain counts and reason codes only.");
}
assert.ok(diagnostics.privacyExclusions.excludedSensitiveFields.includes("gpa"));
assert.ok(diagnostics.privacyExclusions.privateEventCount > 0);

console.log("Open Line data foundation checks passed.");
