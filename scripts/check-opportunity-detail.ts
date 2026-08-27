import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { opportunities } from "../data/opportunities";
import type { StudentProfile } from "../data/student-profile";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { buildOpportunityDetailProjection } from "../lib/opportunity-detail-projection";
import {
  applicationSectionTitle,
  conciseOpportunityDescription,
  eligibilityScopeFacts,
  opportunityEligibilityCriteria,
  opportunityOfficialActionLabel,
  opportunityDetailKind,
  primaryOpportunityFacts,
  specificRequirements,
} from "../lib/opportunity-detail";

function opportunity(id: string) {
  const item = opportunities.find((candidate) => candidate.id === id);
  assert.ok(item, `Missing opportunity fixture ${id}.`);
  return item;
}

const fixtures = {
  benefit: opportunity("benefit--github-student-developer-pack"),
  scholarship: opportunity("scholarship--goldwater-scholarship"),
  internship: opportunity("career--google-student-internships"),
  research: opportunity("research--nsf-reu-sites"),
  competition: opportunity("career--icpc"),
  generatedResource: opportunity(
    "v1-expanded-resource--university-of-chicago--certifications",
  ),
};

assert.equal(opportunityDetailKind(fixtures.benefit), "benefit");
assert.equal(opportunityDetailKind(fixtures.scholarship), "scholarship");
assert.equal(opportunityDetailKind(fixtures.internship), "internship");
assert.equal(opportunityDetailKind(fixtures.research), "research");
assert.equal(opportunityDetailKind(fixtures.competition), "competition");

assert.deepEqual(
  primaryOpportunityFacts(fixtures.benefit).map((fact) => fact.label),
  ["Value", "Access", "Deadline"],
);
assert.deepEqual(
  primaryOpportunityFacts(fixtures.scholarship).map((fact) => fact.label),
  ["Award", "Deadline", "Application", "Renewal"],
);
assert.deepEqual(
  primaryOpportunityFacts(fixtures.internship).map((fact) => fact.label),
  ["Location", "Format", "Compensation", "Deadline"],
);
assert.deepEqual(
  primaryOpportunityFacts(fixtures.research).map((fact) => fact.label),
  ["Research focus", "Term", "Location", "Funding", "Deadline"],
);
assert.deepEqual(
  primaryOpportunityFacts(fixtures.competition).map((fact) => fact.label),
  ["Deadline", "Format", "Difficulty"],
);
assert.equal(applicationSectionTitle(fixtures.benefit), "How to claim it");
assert.equal(applicationSectionTitle(fixtures.scholarship), "How to apply");
assert.equal(
  opportunityOfficialActionLabel(fixtures.benefit, true),
  "Claim student benefit",
);
assert.equal(
  opportunityOfficialActionLabel(fixtures.scholarship, true),
  "View scholarship",
);
assert.equal(
  opportunityOfficialActionLabel(fixtures.internship, true),
  "Apply on Google",
);
assert.equal(
  opportunityOfficialActionLabel(fixtures.internship, false),
  "View official source",
);
const broadMajorSummary =
  eligibilityScopeFacts(fixtures.scholarship, []).find(
    (fact) => fact.label === "Majors",
  )?.value ?? "";
assert.match(
  broadMajorSummary,
  /^\d+ listed majors · Full list in details$/,
  "Broad eligibility must stay scannable above the fold.",
);
assert.ok(
  broadMajorSummary.length < 60,
  "Broad major eligibility must not render as a wall of text.",
);

for (const item of Object.values(fixtures)) {
  const description = conciseOpportunityDescription(item);
  assert.ok(
    description.length <= 220,
    `${item.id} should have a decision-focused summary.`,
  );
  assert.doesNotMatch(
    description,
    /This matters because|should review the official|confirm current requirements/i,
    `${item.id} retained generated catalog boilerplate.`,
  );
}
assert.deepEqual(
  specificRequirements(fixtures.generatedResource),
  [],
  "Generic directory instructions must not masquerade as application requirements.",
);
assert.deepEqual(specificRequirements(fixtures.scholarship), [
  "Institutional nomination",
  "Research-career commitment",
  "Academic and research materials",
]);
const sparseInternship = {
  ...fixtures.internship,
  paid: null,
  remote: null,
  metadata: {
    ...fixtures.internship.metadata,
    compensation: undefined,
    workMode: undefined,
    internshipDuration: undefined,
  },
};
assert.deepEqual(
  primaryOpportunityFacts(sparseInternship).map((fact) => fact.label),
  ["Location", "Deadline"],
  "Unsupported facts must be omitted rather than displayed as empty template fields.",
);
const criteria = opportunityEligibilityCriteria(
  {
    ...fixtures.scholarship,
    metadata: {
      ...fixtures.scholarship.metadata,
      eligibilityRules: {
        minimumGpa: 3,
        citizenship: "us_citizen",
        educationLevels: ["undergraduate"],
      },
    },
  },
  [],
);
assert.deepEqual(criteria.slice(-3), [
  { label: "Education level", value: "undergraduate" },
  { label: "Citizenship", value: "us citizen" },
  { label: "Minimum GPA", value: "3+" },
]);

const page = readFileSync("app/opportunities/[id]/page.tsx", "utf8");
const experience = readFileSync(
  "components/opportunity-detail-experience.tsx",
  "utf8",
);
const projection = readFileSync("lib/opportunity-detail-projection.ts", "utf8");
for (const token of [
  "data-opportunity-kind",
  "Who qualifies",
  "Source and verification",
  "Checked against the provider",
  "Your next action",
  "How this connects",
]) {
  assert.ok(
    experience.includes(token),
    `Opportunity details must retain ${token}.`,
  );
}
for (const removed of [
  "whyThisMatters",
  "Frequently asked questions",
  "What is documented—and what is not",
  "Explore related listings",
]) {
  assert.ok(
    !experience.includes(removed),
    `Opportunity details must remove report-style content: ${removed}.`,
  );
}
assert.match(
  experience,
  /<details[^>]*data-learn-more/,
  "Lower-priority detail must use progressive disclosure.",
);
assert.ok(
  experience.indexOf("Who qualifies") < experience.indexOf("How to proceed"),
  "Eligibility must remain visible before application detail.",
);
assert.ok(
  experience.indexOf("Your next action") < experience.indexOf("Who qualifies"),
  "The decision action must remain visible before supporting detail.",
);
assert.match(
  page,
  /buildOpportunityDetailProjection/,
  "The route must consume one canonical server-side decision projection.",
);
assert.match(
  projection,
  /evaluateOpportunityEligibility/,
  "Personal eligibility must reuse the canonical strict evaluator.",
);
assert.match(
  projection,
  /opportunityMatchesPathStage/,
  "Path context must reuse canonical stage matching without scanning the catalog.",
);
assert.match(
  projection,
  /buildOpportunityCollectionIndex/,
  "Collection context must reuse the canonical index.",
);
assert.doesNotMatch(
  page,
  /listPublishedOpportunities\(\)/,
  "Opportunity details must not load the full catalog on the request path.",
);
assert.match(
  projection,
  /projectApplicationWorkspace/,
  "Application context must reuse the canonical workspace projection.",
);

const profile: StudentProfile = {
  firstName: "Casey",
  schoolSlug: "university-of-chicago",
  schoolName: "University of Chicago",
  major: "Mathematics",
  graduationYear: "2029",
  year: "Second year",
  careerGoal: "Research",
  interests: "Mathematics, research",
  institutionType: "university",
  enrollmentStatus: "enrolled",
  degreeLevel: "undergraduate",
  citizenshipStatus: "us_citizen",
  gpaStatus: "reported",
  gpa: 3.8,
};
const account = (tracked = false): AccountData => ({
  profile,
  onboardingComplete: true,
  billing: defaultBillingRecord(),
  activity: tracked
    ? {
        viewed: [],
        saved: [fixtures.scholarship.id],
        claimed: [],
        tracked: {
          [fixtures.scholarship.id]: {
            id: fixtures.scholarship.id,
            status: "Applying",
            savedAt: "2026-08-01T12:00:00.000Z",
            updatedAt: "2026-08-02T12:00:00.000Z",
            version: 1,
          },
        },
      }
    : { viewed: [], saved: [], claimed: [], tracked: {} },
  savedOpportunities: tracked
    ? [
        {
          opportunityId: fixtures.scholarship.id,
          savedAt: "2026-08-01T12:00:00.000Z",
        },
      ]
    : [],
  tracker: {},
  preferences: null,
  journeyProgress: {},
  advisor: null,
  referrals: null,
  updatedAt: "2026-08-02T12:00:00.000Z",
});
const availableProjection = buildOpportunityDetailProjection({
  opportunity: fixtures.scholarship,
  account: account(),
  catalog: opportunities,
  related: [],
  now: new Date("2026-08-02T12:00:00.000Z"),
});
assert.equal(availableProjection.account.action.kind, "add_to_journey");
assert.equal(
  availableProjection.application.workspace,
  null,
  "Viewing a detail page must not create application state.",
);
assert.ok(
  availableProjection.eligibility.personal,
  "A completed profile should receive a factual eligibility comparison.",
);
const unknownProjection = buildOpportunityDetailProjection({
  opportunity: fixtures.generatedResource,
  account: account(),
  catalog: opportunities,
  related: [],
  now: new Date("2026-08-02T12:00:00.000Z"),
});
assert.notEqual(
  unknownProjection.eligibility.personal?.state,
  "meets_recorded",
  "Unknown critical eligibility must never be presented as a positive match.",
);
const trackedProjection = buildOpportunityDetailProjection({
  opportunity: fixtures.scholarship,
  account: account(true),
  catalog: opportunities,
  related: [],
  now: new Date("2026-08-02T12:00:00.000Z"),
});
assert.equal(trackedProjection.account.action.kind, "continue_application");
assert.ok(
  trackedProjection.application.workspace,
  "Existing Journey state should project the canonical application workspace.",
);
assert.ok(
  Array.isArray(trackedProjection.context.paths) &&
    Array.isArray(trackedProjection.context.collections),
  "Path and collection context must remain an explicit, bounded projection even when no safe membership exists.",
);

const coverage = {
  total: opportunities.length,
  sparse: 0,
  withDeadline: 0,
  withVerifiedEligibility: 0,
  withVerifiedRequirements: 0,
  withValue: 0,
  withChangelog: 0,
};
const ids = new Set<string>();
for (const item of opportunities) {
  assert.ok(item.id && !ids.has(item.id), `Every opportunity must have a unique canonical detail route: ${item.id}.`);
  ids.add(item.id);
  assert.ok(item.title.trim(), `${item.id} is missing a title.`);
  assert.ok(item.organization.trim(), `${item.id} is missing an organization.`);
  assert.match(item.official_source, /^https?:\/\//, `${item.id} needs a valid provider source URL.`);
  assert.ok(conciseOpportunityDescription(item).length <= 220, `${item.id} needs a bounded summary.`);
  const facts = primaryOpportunityFacts(item);
  assert.equal(new Set(facts.map((fact) => fact.label)).size, facts.length, `${item.id} repeats an at-a-glance fact.`);
  assert.ok(facts.every((fact) => fact.value.trim() && !/^(unknown|n\/a|not available)$/i.test(fact.value)), `${item.id} exposes meaningless unknown facts.`);
  if (facts.length <= 2) coverage.sparse += 1;
  if (item.application_deadline) coverage.withDeadline += 1;
  if (item.metadata.verification?.eligibilityVerified) coverage.withVerifiedEligibility += 1;
  if (specificRequirements(item).length && item.metadata.verification?.eligibilityVerified) coverage.withVerifiedRequirements += 1;
  if (item.estimated_value !== null || item.paid !== null) coverage.withValue += 1;
  if (item.metadata.changelog?.length) coverage.withChangelog += 1;
}

console.log("Opportunity detail clarity checks passed", {
  kinds: Object.keys(fixtures).length - 1,
  benefitFacts: primaryOpportunityFacts(fixtures.benefit).length,
  complexFacts: primaryOpportunityFacts(fixtures.scholarship).length,
  coverage,
});
