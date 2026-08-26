import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { opportunities } from "../data/opportunities";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { applicationWorkspaceEligible, projectApplicationWorkspace, trustedApplicationRequirements } from "../lib/application-workspace";
import { buildJourneyCalendarModel } from "../lib/journey-calendar";
import { buildJourneyCommandCenterModel } from "../lib/journey-command-center";

const source = (path: string) => readFileSync(path, "utf8");
const now = new Date("2026-08-13T16:00:00.000Z");
const opportunity = opportunities.find((item) => applicationWorkspaceEligible(item)
  && item.verification_status === "verified"
  && Boolean(item.application_deadline)
  && trustedApplicationRequirements(item).length > 0);
assert.ok(opportunity, "Product-coherence checks require one verified application opportunity.");

const tracked = {
  id: opportunity.id,
  status: "Applying" as const,
  savedAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-12T12:00:00.000Z",
  version: 1,
  history: [],
};
const account: AccountData = {
  profile: null,
  onboardingComplete: true,
  firstLaunchComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: [opportunity.id], claimed: [], tracked: { [opportunity.id]: tracked } },
  savedOpportunities: [{ opportunityId: opportunity.id, savedAt: tracked.savedAt }],
  tracker: { [opportunity.id]: tracked },
  applicationWorkspaces: {},
  preferences: null,
  journeyProgress: {},
  calendarEvents: {},
  advisor: null,
  referrals: null,
  updatedAt: now.toISOString(),
};

const journey = buildJourneyCommandCenterModel({ user: { id: "coherence-user", name: "Student" }, account, opportunities: [opportunity], now });
const record = journey.activeRecords[0];
const workspace = projectApplicationWorkspace({ opportunity, record: tracked, now });
const calendar = buildJourneyCalendarModel({ account, opportunities: [opportunity], now });
const officialDate = calendar.items.find((item) => item.source === "official" && item.opportunityId === opportunity.id);

assert.equal(record?.title, opportunity.title, "Journey must preserve the catalog title.");
assert.equal(record?.organization, opportunity.organization, "Journey must preserve the catalog organization.");
assert.equal(record?.applicationWorkspace?.opportunityId, opportunity.id, "Journey must open the application workspace for the same opportunity.");
assert.equal(workspace.deadline, opportunity.application_deadline ?? undefined, "Application must use the verified catalog deadline.");
assert.equal(officialDate?.opportunityTitle, opportunity.title, "Calendar must preserve opportunity identity.");
assert.equal(officialDate?.organization, opportunity.organization, "Calendar must preserve organization identity.");
assert.equal(officialDate?.date, workspace.deadline, "Calendar and Application must share the authoritative official deadline.");

const activity = source("components/opportunity-activity.tsx");
const cards = source("components/opportunity-card.tsx");
const advisor = source("components/advisor-page.tsx");
const journeyUi = source("components/journey-command-center.tsx");
const application = source("components/application-workspace.tsx");
const applicationDetail = source("components/application-packet.tsx");
const calendarUi = source("components/journey-deadline-calendar.tsx");
const updates = source("app/updates/page.tsx");
const header = source("components/header.tsx");
const learn = source("components/learn-unlocked.tsx");
const materials = source("components/application-materials.tsx");
const resumeLab = source("components/resume-lab.tsx");
const productModel = source("docs/PRODUCT_COHESION_AND_UX.md");

for (const ui of [activity, cards, advisor]) assert.match(ui, /AddToJourneyButton|Add to Journey/, "Discover, For You, and detail surfaces must share the Journey action.");
assert.doesNotMatch(`${activity}\n${advisor}`, /Save to Journey|Track this/, "The add action must not change vocabulary between recommendation and catalog surfaces.");
assert.match(activity, /#journey-record-/);
assert.match(activity, /View in Journey/);
assert.match(advisor, /Open Opportunity/);
assert.doesNotMatch(journeyUi, /Application Command Center/);
assert.match(journeyUi, /Application details/);
assert.match(journeyUi, /View opportunity/);
assert.match(journeyUi, /View official source/);
assert.match(journeyUi, /More actions/);
assert.match(application, /Official deadline/);
assert.match(application, /Add personal date/);
assert.doesNotMatch(application, /Application Command Center/);
assert.match(applicationDetail, />Application details</);
assert.doesNotMatch(applicationDetail, />Application Packet</);
assert.match(calendarUi, /Official date · Verified/);
assert.match(calendarUi, /Your date · Editable/);
assert.match(calendarUi, /View opportunity/);
assert.match(updates, /Opportunity updates/);
assert.doesNotMatch(updates, />Dashboard</);
for (const domain of ["Discover", "For You", "Journey", "Build"]) assert.match(header, new RegExp(`(?:"${domain}"|${domain}):?`), `${domain} must remain represented in primary navigation.`);
for (const stage of ["Find", "Pursue", "Apply", "Build", "Look back"]) assert.ok(learn.includes(stage), `Learn must teach the ${stage} workflow stage.`);
assert.doesNotMatch(learn, /Application Packet|Command Center/);
assert.match(materials, /This saves a record, not a file/);
assert.match(resumeLab, /returnTo\?: string/);
assert.match(productModel, /Find -> Add to Journey -> Prepare application/);

console.log("Product coherence checks passed", {
  opportunity: opportunity.id,
  identityContinuous: true,
  authoritativeDeadlineShared: true,
  canonicalJourneyAction: true,
});
