import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { queueJourneySaveRequest } from "../data/journey-save-request";

const source = (path: string) => readFileSync(path, "utf8");
const activity = source("components/opportunity-activity.tsx");
const activityStyles = source("components/opportunity-activity.module.css");
const motion = source("components/journey-save-motion.ts");
const motionStyles = source("components/journey-save-motion.module.css");
const header = source("components/header.tsx");

assert.match(activity, /Save to Journey/);
assert.match(activity, /pendingLabel="Saving…"/);
assert.match(activity, /Added to Journey/);
assert.match(activity, /queueJourneySaveRequest/);
assert.match(activity, /cancelJourneySaveMotion/);
assert.match(activity, /aria-busy=/);
assert.match(activity, /role="status" aria-live="polite"/);
assert.match(activityStyles, /save-bookmark-settle/);
assert.match(activityStyles, /save-check-arrive/);
assert.match(activityStyles, /prefers-reduced-motion:\s*reduce/);
assert.match(motion, /transferQueue/);
assert.match(motion, /confirmationQueue/);
assert.match(motion, /maximumConcurrentFlights = 2/);
assert.match(motion, /cancelJourneySaveMotion/);
assert.match(motion, /navigator\.vibrate\(8\)/);
assert.match(motion, /prefersReducedMotion/);
assert.match(motionStyles, /will-change: transform, opacity/);
assert.match(motionStyles, /journey-destination-icon/);
assert.doesNotMatch(motionStyles, /transition:\s*all\b/);
assert.match(header, /data-journey-destination-icon/);
assert.match(source("components/opportunity-card.tsx"), /AddToJourneyButton/);
assert.match(source("components/advisor-page.tsx"), /AddToJourneyButton/);
assert.match(activity, /OpportunityActivityActions[\s\S]*AddToJourneyButton/);
assert.doesNotMatch(`${activity}\n${motion}`, /animate-spin|spinner|data-journey-save-progress/i);

const order: string[] = [];
const first = queueJourneySaveRequest(async () => {
  order.push("first:start");
  await new Promise((resolve) => setTimeout(resolve, 12));
  order.push("first:end");
  return 1;
}, new AbortController().signal);
const second = queueJourneySaveRequest(async () => {
  order.push("second:start");
  order.push("second:end");
  return 2;
}, new AbortController().signal);
assert.deepEqual(await Promise.all([first, second]), [1, 2]);
assert.deepEqual(order, ["first:start", "first:end", "second:start", "second:end"], "Rapid Journey saves must execute in order.");

let releaseBlocker!: () => void;
let markBlockerStarted!: () => void;
const blockerStarted = new Promise<void>((resolve) => { markBlockerStarted = resolve; });
const blocker = queueJourneySaveRequest(async () => {
  markBlockerStarted();
  return await new Promise<void>((resolve) => { releaseBlocker = resolve; });
}, new AbortController().signal);
const cancelledController = new AbortController();
const cancelled = queueJourneySaveRequest(async () => "unexpected", cancelledController.signal);
await blockerStarted;
cancelledController.abort("account-changed");
releaseBlocker();
await blocker;
await assert.rejects(cancelled, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
assert.equal(await queueJourneySaveRequest(async () => "ready", new AbortController().signal), "ready", "The queue must release after cancellation.");

console.log("Premium Save-to-Journey checks passed.");
