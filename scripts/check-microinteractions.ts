import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolveMilestoneCelebration } from "../data/milestone-celebrations";
import type { JourneyProgressTransition, JourneyTransitionHistoryRecord } from "../data/student-activity";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { journeyDeadlineTiming } from "../lib/journey-command-center";

function account(history: JourneyTransitionHistoryRecord[] = []): AccountData {
  const record = {
    id: "fixture",
    status: "Accepted" as const,
    savedAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-02-01T12:00:00.000Z",
    version: history.length,
    history,
  };
  return {
    profile: null,
    onboardingComplete: true,
    billing: defaultBillingRecord(),
    activity: { viewed: [], saved: ["fixture"], claimed: [], tracked: { fixture: record } },
    savedOpportunities: [],
    tracker: { fixture: record },
    preferences: null,
    journeyProgress: {},
    advisor: null,
    referrals: null,
    updatedAt: "2026-02-01T12:00:00.000Z",
  };
}

function event(transition: JourneyProgressTransition, professionalStageId?: string): JourneyTransitionHistoryRecord {
  return {
    id: `past:${transition}:${professionalStageId ?? "none"}`,
    transition,
    priorStatus: "Applying",
    resultingStatus: transition === "complete" ? "Completed" : transition === "accept" ? "Accepted" : transition === "interview" ? "Interview" : transition === "submit" ? "Submitted" : "Applying",
    occurredAt: "2026-01-01T12:00:00.000Z",
    professionalStageId,
  };
}

function resolve(
  transition: JourneyProgressTransition,
  stage?: { id: string; label: string; major: boolean },
  history: JourneyTransitionHistoryRecord[] = [],
  duplicate = false,
  correction = false,
) {
  return resolveMilestoneCelebration({
    account: account(history),
    eventId: "journey:test:new",
    transition,
    professionalStage: stage,
    duplicate,
    correction,
  });
}

assert.equal(resolve("choose"), null, "Saving or choosing an opportunity must not trigger a milestone celebration.");
assert.equal(resolve("start", { id: "preparing_application", label: "Preparing application", major: false }), null, "Routine preparation must remain calm.");
assert.equal(resolve("pause"), null);
assert.equal(resolve("close"), null);
assert.equal(resolve("submit")?.level, "meaningful");
assert.equal(resolve("submit")?.particleAccent, false);
assert.equal(resolve("interview")?.level, "meaningful");
assert.equal(resolve("interview")?.particleAccent, false);
assert.deepEqual(resolve("start", { id: "research_active", label: "Research active", major: true }), {
  eventId: "journey:test:new",
  kind: "program_started",
  level: "meaningful",
  first: true,
  particleAccent: false,
});
assert.equal(resolve("accept", { id: "research_active", label: "Research active", major: true })?.level, "meaningful", "Starting a research program is meaningful progress, not an offer celebration.");
assert.equal(resolve("accept", { id: "offer_received", label: "Offer received", major: true })?.level, "signature");
assert.equal(resolve("accept", { id: "offer_received", label: "Offer received", major: true }, [event("accept", "offer_received")])?.level, "major");
assert.equal(resolve("accept", { id: "accepted", label: "Accepted", major: true })?.kind, "acceptance");
assert.equal(resolve("accept", { id: "awarded", label: "Awarded", major: true })?.kind, "scholarship_awarded");
assert.equal(resolve("accept", { id: "winner", label: "Winner", major: true })?.kind, "competition_result");
assert.equal(resolve("complete", { id: "completed_program", label: "Completed program", major: true })?.level, "signature");
assert.equal(resolve("complete", { id: "completed_program", label: "Completed program", major: true }, [event("complete", "research_completed")])?.level, "major");
assert.equal(resolve("accept", { id: "accepted", label: "Accepted", major: true }, [], true), null, "A duplicate response must never replay celebration eligibility.");
assert.equal(resolve("accept", { id: "accepted", label: "Accepted", major: true }, [], false, true), null, "A corrected earlier stage must not replay a milestone celebration.");

const now = new Date("2026-07-29T14:00:00.000Z");
assert.equal(journeyDeadlineTiming("2026-08-20", now, "America/New_York").urgency, "normal");
assert.equal(journeyDeadlineTiming("2026-08-10", now, "America/New_York").urgency, "approaching");
assert.equal(journeyDeadlineTiming("2026-08-03", now, "America/New_York").urgency, "due_soon");
assert.equal(journeyDeadlineTiming("2026-07-30", now, "America/New_York").timingLabel, "Due tomorrow");
assert.equal(journeyDeadlineTiming("2026-07-29", now, "America/New_York").timingLabel, "Due today");
assert.equal(journeyDeadlineTiming("2026-07-28", now, "America/New_York").urgency, "overdue");

const control = readFileSync("components/journey-timeline-control.tsx", "utf8");
const effect = readFileSync("components/milestone-celebration-effect.tsx", "utf8");
const effectStyles = readFileSync("components/milestone-celebration-effect.module.css", "utf8");
const activity = readFileSync("components/opportunity-activity.tsx", "utf8");
const saveMotion = readFileSync("components/journey-save-motion.ts", "utf8");
const saveMotionStyles = readFileSync("components/journey-save-motion.module.css", "utf8");
const saveButtonStyles = readFileSync("components/opportunity-activity.module.css", "utf8");
const header = readFileSync("components/header.tsx", "utf8");
const card = readFileSync("components/journey-card-creator.tsx", "utf8");
const discover = readFileSync("components/opportunity-filter.tsx", "utf8");
const notifications = readFileSync("components/notification-center.tsx", "utf8");
const globalStyles = readFileSync("app/globals.css", "utf8");
assert.match(control, /if \(!response\.ok[\s\S]*setResult\(body\)/, "Success UI must follow a confirmed server response.");
assert.match(control, /claimCelebration\(body\.milestoneEventId\)/);
assert.match(control, /CelebrationBoundary/);
assert.match(effect, /aria-hidden="true"/);
assert.match(effect, /"--particle-index": index/);
assert.match(effectStyles, /prefers-reduced-motion:\s*reduce/);
assert.match(effectStyles, /pointer-events:\s*none/);
assert.match(activity, /Added to Journey/);
assert.match(activity, /setConfirmedThisSession\(!body\.duplicate\)/);
assert.match(activity, /playJourneySaveMotion\(buttonRef\.current\)/);
assert.match(activity, /data-journey-save-state=/);
assert.match(activity, /data-journey-save-progress=/);
assert.match(activity, /error \? "Try again"/);
assert.match(saveMotion, /maximumConcurrentFlights = 2/);
assert.match(saveMotion, /prefers-reduced-motion: reduce/);
assert.match(saveMotion, /if \(reducedMotion\) return/);
assert.match(saveMotion, /duration: 540/);
assert.match(saveMotion, /navigator\.vibrate\(8\)/);
assert.match(saveMotion, /data-journey-save-flight/);
assert.match(saveMotionStyles, /will-change: transform, opacity/);
assert.match(saveMotionStyles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(saveButtonStyles, /save-progress-trace/);
assert.doesNotMatch(saveMotionStyles, /transition:\s*all\b/);
assert.match(header, /data-journey-destination=/);
assert.match(card, /Your PNG is ready\./);
assert.match(card, /data-inline-feedback=/);
assert.match(discover, /data-search-surface/);
assert.match(discover, /aria-label="Clear opportunity search"/);
assert.match(discover, /data-filter-results/);
assert.match(notifications, /data-notification-item=/);
assert.match(notifications, /data-dismissing=/);
assert.match(globalStyles, /--motion-micro:\s*140ms/);
assert.match(globalStyles, /--motion-surface:\s*280ms/);
assert.match(globalStyles, /display var\(--motion-standard\) allow-discrete/);
assert.match(globalStyles, /@starting-style/);
assert.match(globalStyles, /prefers-reduced-motion:\s*reduce/);
assert.doesNotMatch(globalStyles, /transition:\s*all\b/, "The shared polish layer must animate only compositor-friendly or narrowly scoped properties.");
assert.doesNotMatch(readFileSync("package.json", "utf8"), /framer-motion|canvas-confetti|lottie/, "Microinteractions must not add a heavy animation dependency.");

const started = performance.now();
for (let index = 0; index < 10_000; index += 1) {
  resolveMilestoneCelebration({
    account: account(index % 2 ? [event("accept", "offer_received")] : []),
    eventId: `event:${index}`,
    transition: index % 3 ? "accept" : "submit",
    professionalStage: index % 3 ? { id: "offer_received", label: "Offer received", major: true } : undefined,
    duplicate: false,
  });
}
const classificationMs = performance.now() - started;
assert.ok(classificationMs < 250, `Milestone classification must remain lightweight; received ${classificationMs.toFixed(2)}ms.`);

console.log(JSON.stringify({
  message: "Microinteraction and milestone celebration checks passed.",
  classification10kMs: Number(classificationMs.toFixed(3)),
  dependenciesAdded: 0,
  deadlineTimezone: "America/New_York",
}, null, 2));
