import assert from "node:assert/strict";
import type { AccountData } from "../lib/account-types";
import type { Opportunity } from "../data/opportunities";
import { defaultBillingRecord } from "../lib/billing";
import { emptyHighSchoolAcademicStore } from "../data/high-school-academics";

const { opportunities } = await import("../data/opportunities");
const { buildHighSchoolHomeSummary } = await import("../lib/high-school-home");

const now = new Date("2026-09-11T14:00:00.000Z");
const timestamp = now.toISOString();
const account = (overrides: Partial<AccountData> = {}): AccountData => ({
  educationalStage: "high_school",
  profile: null,
  onboardingComplete: true,
  firstLaunchComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: [], claimed: [], tracked: {} },
  savedOpportunities: [],
  savedColleges: [],
  tracker: {},
  preferences: null,
  journeyProgress: {},
  advisor: null,
  referrals: null,
  updatedAt: timestamp,
  ...overrides,
});

const empty = buildHighSchoolHomeSummary({ data: account(), firstName: "Avery", opportunities: [], now });
assert.equal(empty.empty, true, "A new high-school account should receive the intentional empty state.");
assert.equal(empty.next.id, "explore", "An empty account should get one broad, useful starting action.");
assert.deepEqual(empty.comingUp, [], "The Home must not invent dates for a new account.");

const academics = emptyHighSchoolAcademicStore();
academics.gradeLevel = 11;
academics.testing.plans = [{ test: "sat", date: "2026-09-25", registrationStatus: "registered", createdAt: timestamp, updatedAt: timestamp }];
const sat = buildHighSchoolHomeSummary({ data: account({ highSchoolAcademics: academics }), firstName: "Avery", opportunities: [], now });
assert.equal(sat.next.id, "sat-test:2026-09-25", "An SAT within 21 days should become the next step when no verified deadline is more urgent.");
assert.equal(sat.comingUp[0]?.provenance, "Your date", "Student-entered test dates must be labeled as user-provided.");

const source = opportunities[0]!;
const verified: Opportunity = {
  ...source,
  id: "home-verified-deadline",
  title: "Verified summer program",
  application_deadline: "2026-09-15",
  deadline: "2026-09-15",
  metadata: {
    ...source.metadata,
    deadlineType: "fixed",
    verification: { ...source.metadata.verification, status: "verified", deadlineVerified: true },
  },
};
const tracked = { id: verified.id, status: "Applying" as const, savedAt: timestamp, updatedAt: timestamp };
const deadline = buildHighSchoolHomeSummary({
  data: account({ tracker: { [verified.id]: tracked }, activity: { viewed: [], saved: [verified.id], claimed: [], tracked: { [verified.id]: tracked } }, highSchoolAcademics: academics }),
  firstName: "Avery",
  opportunities: [verified],
  now,
});
assert.equal(deadline.next.id, `opportunity:${verified.id}`, "A verified deadline inside 14 days must outrank SAT preparation.");
assert.equal(deadline.next.provenance, "Verified date", "Verified deadlines must retain their provenance in the Home model.");

const unverified: Opportunity = {
  ...verified,
  id: "home-unverified-deadline",
  title: "Unverified program",
  application_deadline: "2026-09-12",
  deadline: "2026-09-12",
  metadata: { ...verified.metadata, verification: { ...verified.metadata.verification, status: "needs_review", deadlineVerified: false } },
};
const unverifiedTracked = { ...tracked, id: unverified.id };
const safe = buildHighSchoolHomeSummary({
  data: account({ tracker: { [unverified.id]: unverifiedTracked }, activity: { viewed: [], saved: [unverified.id], claimed: [], tracked: { [unverified.id]: unverifiedTracked } }, highSchoolAcademics: academics }),
  firstName: "Avery",
  opportunities: [unverified],
  now,
});
assert.equal(safe.comingUp.some((item) => item.id === `opportunity:${unverified.id}`), false, "Unverified opportunity dates must stay off Coming Up.");
assert.equal(safe.next.id, "sat-test:2026-09-25", "An unverified deadline must not displace a trusted next step.");

const writingAccount = account({
  writing: {
    documents: {
      "writing-document:home": {
        id: "writing-document:home",
        promptId: "common-app-2026-choice",
        cycle: "2026–27",
        title: "Common App Personal Essay",
        status: "drafting",
        content: "A draft in the student’s own words.",
        planningDate: "2026-09-20",
        ideaIds: [],
        versions: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      },
    },
    ideas: {},
    assignments: {},
    feedback: {},
    version: 1,
    updatedAt: timestamp,
  },
});
const writing = buildHighSchoolHomeSummary({ data: writingAccount, firstName: "Avery", opportunities: [], now });
assert.equal(writing.next.id, "writing-next:writing-document:home", "A planned writing commitment inside 14 days should become the next step when nothing more urgent exists.");
assert.equal(writing.comingUp[0]?.label, "Writing");
assert.equal(writing.continuing[0]?.id, "continue-writing", "A real in-progress draft should appear in Continue.");

console.log("High School Home checks passed.");
