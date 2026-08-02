import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getJourneyProfessionalWorkflow, journeyProfessionalWorkflows, type JourneyWorkflowKind } from "../data/journey-professional";
import { opportunities, type Opportunity } from "../data/opportunities";
import type { JourneyProgressTransition, OpportunityTrackerStatus, TrackedOpportunity } from "../data/student-activity";
import type { AccountData, AuthUser } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { buildJourneyCommandCenterModel } from "../lib/journey-command-center";

const now = new Date("2026-08-02T12:00:00.000Z");
const user: AuthUser = { id: "journey-career-dashboard", email: "journey-dashboard@example.test", name: "Jordan Rivera" };

function opportunityFor(kind: JourneyWorkflowKind, offset = 0) {
  const matches = opportunities.filter((opportunity) => getJourneyProfessionalWorkflow(opportunity).id === kind);
  const opportunity = matches[offset];
  assert.ok(opportunity, `The catalog needs a ${kind} fixture at offset ${offset}.`);
  return opportunity;
}

function tracked(input: {
  opportunity: Opportunity;
  status: OpportunityTrackerStatus;
  stageId: string;
  transition: JourneyProgressTransition;
  occurredAt: string;
  history?: TrackedOpportunity["history"];
}): TrackedOpportunity {
  return {
    id: input.opportunity.id,
    status: input.status,
    professionalStageId: input.stageId,
    savedAt: "2026-01-02T12:00:00.000Z",
    updatedAt: input.occurredAt,
    version: 1,
    history: input.history ?? [{
      id: `career-dashboard:${input.opportunity.id}:${input.stageId}`,
      transition: input.transition,
      priorStatus: "Applying",
      resultingStatus: input.status,
      professionalStageId: input.stageId,
      occurredAt: input.occurredAt,
    }],
  };
}

function account(records: readonly TrackedOpportunity[]): AccountData {
  const tracker = Object.fromEntries(records.map((record) => [record.id, record]));
  return {
    profile: { firstName: "Jordan", schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2030", year: "First year", careerGoal: "Research", interests: "Research", onboardingCompletedAt: now.toISOString() },
    onboardingComplete: true,
    billing: defaultBillingRecord(),
    activity: { viewed: [], saved: records.map((record) => record.id), claimed: [], tracked: tracker },
    savedOpportunities: records.map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
    tracker,
    preferences: { appearance: "light", updatedAt: now.toISOString() },
    journeyProgress: {},
    advisor: null,
    referrals: null,
    updatedAt: now.toISOString(),
  };
}

const expectedLabels = {
  career: ["Application submitted", "Offer received", "Offer accepted", "Experience completed"],
  scholarship: ["Application submitted", "Awarded", "Funds received"],
  research: ["Research interview", "Research position accepted", "Research underway", "Research completed"],
  competition: ["Competition entered", "Competition won", "Competition completed"],
  resource: ["Resource activated", "Resource completed"],
} as const;
for (const [kind, labels] of Object.entries(expectedLabels)) {
  const stageLabels = journeyProfessionalWorkflows[kind as JourneyWorkflowKind].stages.map((stage) => stage.label);
  for (const label of labels) assert.ok(stageLabels.includes(label), `${kind} must expose the professional label “${label}”.`);
}

const career = opportunityFor("career");
const firstInterview = tracked({ opportunity: career, status: "Interview", stageId: "interview_received", transition: "interview", occurredAt: "2026-04-02T12:00:00.000Z" });
const firstInterviewModel = buildJourneyCommandCenterModel({ user, account: account([firstInterview]), opportunities: [career], now });
assert.equal(firstInterviewModel.activeRecords[0]?.stageLabel, "Interview received");
assert.equal(firstInterviewModel.activeRecords[0]?.statusDetail, "Interview progress recorded");
assert.equal(firstInterviewModel.activeRecords[0]?.history[0]?.label, "Interview received", "History must resolve canonical labels rather than expose internal stage IDs.");
assert.equal(firstInterviewModel.overview.find((card) => card.id === "newest_milestone")?.label, "First interview recorded");

const secondCareer = opportunityFor("career", 1);
const secondInterview = tracked({ opportunity: secondCareer, status: "Interview", stageId: "interview_received", transition: "interview", occurredAt: "2026-05-02T12:00:00.000Z" });
const repeatModel = buildJourneyCommandCenterModel({ user, account: account([firstInterview, secondInterview]), opportunities: [career, secondCareer], now });
assert.equal(repeatModel.overview.find((card) => card.id === "newest_milestone")?.label, "Recent progress", "Repeated progress must not receive first-time language.");

const longHistory = Array.from({ length: 11 }, (_, index) => ({
  id: `career-dashboard:long:${index}`,
  transition: (index === 10 ? "interview" : "choose") as JourneyProgressTransition,
  priorStatus: "Saved" as OpportunityTrackerStatus,
  resultingStatus: (index === 10 ? "Interview" : "Saved") as OpportunityTrackerStatus,
  professionalStageId: index === 10 ? "interview_received" : "saved",
  occurredAt: `2026-03-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
}));
const truncated = tracked({ opportunity: career, status: "Interview", stageId: "interview_received", transition: "interview", occurredAt: "2026-03-11T12:00:00.000Z", history: longHistory });
const truncatedModel = buildJourneyCommandCenterModel({ user, account: account([truncated]), opportunities: [career], now });
assert.equal(truncatedModel.overview.find((card) => card.id === "newest_milestone")?.label, "Recent progress", "A bounded history projection must never claim an unproven first.");

const scholarship = opportunityFor("scholarship");
const research = opportunityFor("research");
const awarded = tracked({ opportunity: scholarship, status: "Accepted", stageId: "awarded", transition: "accept", occurredAt: "2026-06-02T12:00:00.000Z" });
const researchAccepted = tracked({ opportunity: research, status: "Accepted", stageId: "research_accepted", transition: "accept", occurredAt: "2026-07-02T12:00:00.000Z" });
const mixedResults = buildJourneyCommandCenterModel({ user, account: account([awarded, researchAccepted]), opportunities: [scholarship, research], now });
assert.equal(mixedResults.overview.find((card) => card.id === "year")?.title, "2 results recorded · 0 interviews", "Cross-category outcomes must never be mislabeled as job offers.");
assert.equal(mixedResults.overview.find((card) => card.id === "newest_milestone")?.value, "Research position accepted", "The overview must describe the actual event, not a later record state.");
assert.equal(mixedResults.overview.find((card) => card.id === "newest_milestone")?.label, "First research acceptance recorded", "A confirmed first must be recognized within its professional opportunity type.");

const unavailable = tracked({ opportunity: career, status: "Accepted", stageId: "accepted", transition: "accept", occurredAt: "2026-07-03T12:00:00.000Z" });
const unavailableModel = buildJourneyCommandCenterModel({ user, account: account([unavailable]), opportunities: [], now, filter: "accepted" });
assert.equal(unavailableModel.activeRecords[0]?.stageLabel, "Acceptance recorded", "Unavailable legacy records need factual fallback language.");

const component = readFileSync("components/journey-command-center.tsx", "utf8");
for (const phrase of ["Needs attention", "Active opportunities", "Professional history", "Present a confirmed milestone."]) {
  assert.ok(component.includes(phrase), `Journey must include “${phrase}”.`);
}
assert.doesNotMatch(component, /Things to do|Celebrate a confirmed milestone|Newest milestone|Current stage:/, "The professional dashboard must not retain generic prototype language.");
assert.doesNotMatch(component, /\bXP\b|streak|badge|leaderboard|AI coach/i, "Professional progress must remain factual and free of gamification or invented coaching.");

console.log("Journey professional career-dashboard semantics and trust checks passed.");
