import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import {
  analyticsSchemaVersion,
  productIntelligenceDefinitions,
  productIntelligenceEvents,
  sanitizeAnalyticsProperties,
  type AnalyticsEnvelope,
  type AnalyticsEventName,
} from "../lib/analytics-types";

process.env.AUTH_SECRET = "journey-analytics-check-secret-with-at-least-thirty-two-bytes";
process.env.UNLOCKED_ANALYTICS_STORE = "memory";

const { getAnalyticsSummary, recordAnalyticsEnvelope } = await import("../lib/analytics-store");

const names = Object.values(productIntelligenceEvents);
assert.equal(new Set(names).size, names.length, "Canonical analytics event names must be unique.");
assert.ok(names.every((name) => name.endsWith("_v1")), "Every canonical analytics event must carry a stable schema version.");
assert.deepEqual(Object.keys(productIntelligenceDefinitions).sort(), [...names].sort(), "Every canonical event needs a field and retention definition.");
for (const [name, definition] of Object.entries(productIntelligenceDefinitions)) {
  assert.ok(definition.purpose.length >= 20, `${name} must explain the product question it answers.`);
  assert.ok(definition.retentionDays > 0 && definition.retentionDays <= 90, `${name} must have bounded retention.`);
  assert.doesNotMatch(definition.allowedProperties.join(" "), /gpa|essay|citizenship|financial|note|narrative|explanation|text|position/i, `${name} cannot admit sensitive or invasive fields.`);
}

const privateInput = {
  recommendationId: "recommendation-safe-1",
  opportunityId: "opportunity-safe-1",
  gpa: 4,
  essay: "private essay",
  citizenship: "private citizenship",
  privateNotes: "private notes",
  narrative: "private Journey narrative",
  explanation: "private recommendation explanation",
  position: 1,
};
const sanitized = sanitizeAnalyticsProperties(productIntelligenceEvents.recommendationOpened, privateInput);
assert.deepEqual(sanitized, { opportunityId: "opportunity-safe-1", recommendationId: "recommendation-safe-1" });
assert.deepEqual(
  Object.keys(sanitizeAnalyticsProperties(productIntelligenceEvents.recommendationOpened, { recommendationId: "recommendation-safe-1", opportunityId: "opportunity-safe-1" })),
  Object.keys(sanitized),
  "Sanitized payload ordering must be deterministic.",
);
assert.deepEqual(sanitizeAnalyticsProperties(productIntelligenceEvents.operationalError, {
  component: "path_moment",
  errorType: "export",
  action: "download",
  message: "student content and stack trace",
  stack: "private stack",
}), { action: "download", component: "path_moment", errorType: "export" });
assert.deepEqual(sanitizeAnalyticsProperties(productIntelligenceEvents.productHealthTiming, {
  component: "journey",
  metric: "server_projection",
  durationMs: 12.4,
  narrative: "never store this",
}), { component: "journey", durationMs: 12, metric: "server_projection" });
assert.deepEqual(sanitizeAnalyticsProperties("filter_applied", { filterName: "discover", filterValue: JSON.stringify({ school: "private-school" }) }), { filterName: "discover" }, "Structured filter payloads must not enter analytics.");

const run = crypto.randomUUID().replaceAll("-", "");
const envelope = (name: AnalyticsEventName, properties: AnalyticsEnvelope["properties"] = {}, id: string = crypto.randomUUID()): AnalyticsEnvelope => ({
  id: `analytics-${run}-${id}`,
  version: analyticsSchemaVersion,
  name,
  visitorId: `visitor-${run}`,
  occurredAt: new Date().toISOString(),
  properties,
});
const journeyView = envelope(productIntelligenceEvents.journeyViewed, { status: "active" }, "journey-view");
assert.equal(await recordAnalyticsEnvelope(journeyView), true);
assert.equal(await recordAnalyticsEnvelope(journeyView), false, "A retried envelope must be accepted only once.");
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.waypointClicked, { source: "journey" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.waypointCompleted, { transition: "submit" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.horizonOpened));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.transitionStarted, { opportunityId: "opportunity-safe-1", transition: "submit" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.transitionCompleted, { opportunityId: "opportunity-safe-1", transition: "submit" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.pathMomentCreatorOpened, { format: "story" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.pathMomentDownloaded, { format: "story" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.journeyCardCreatorOpened, { format: "story" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.journeyCardDownloaded, { format: "story" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.recommendationOpened, { opportunityId: "opportunity-safe-1", recommendationId: "recommendation-safe-1" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.recommendationSaved, { opportunityId: "opportunity-safe-1", recommendationId: "recommendation-safe-1" }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.productHealthTiming, { component: "journey", metric: "server_projection", durationMs: 24 }));
await recordAnalyticsEnvelope(envelope(productIntelligenceEvents.operationalError, { component: "path_moment", errorType: "export", action: "download" }));
const summary = await getAnalyticsSummary();
assert.ok(summary.productIntelligence.journey.views >= 1);
assert.ok(summary.productIntelligence.journey.transitionSuccessRate > 0);
assert.ok(summary.productIntelligence.journey.horizonEngagementRate > 0);
assert.ok(summary.productIntelligence.exports.exportRate > 0);
assert.ok(summary.productIntelligence.recommendations.saveRate > 0);
assert.equal(summary.productIntelligence.performance["journey.server_projection"]?.averageMs, 24);
assert.ok(summary.productIntelligence.errors.byComponent.some(([component]) => component === "path_moment"));

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const transport = source("data/product-analytics.ts");
const api = source("app/api/analytics/event/route.ts");
const journey = source("components/journey-analytics.tsx");
const transition = source("components/journey-transition-control.tsx");
const pathMoment = source("components/path-moment-creator.tsx");
const semesterStory = source("components/semester-story-creator.tsx");
const journeyCard = source("components/journey-card-creator.tsx");
const recommendations = source("components/advisor-page.tsx");
const account = source("components/account-auth.tsx");
const layout = source("app/layout.tsx");
const docs = source("docs/PRODUCT_INTELLIGENCE.md");

for (const token of ["analyticsQueueKey", "navigator.onLine", "sendBeacon", "scheduleRetry", "clearProductAnalyticsSession", "bindProductAnalyticsAccount", "globalPrivacyControl", "doNotTrack"]) assert.ok(transport.includes(token), `Transport must implement ${token}.`);
for (const token of ["assertSameOrigin", "enforceRateLimit", "readBoundedJson", "recordAnalyticsEnvelope"]) assert.ok(api.includes(token), `Analytics API must enforce ${token}.`);
for (const token of ["trackJourneyView", "waypointClicked", "historyExpanded", "historyExplored", "horizonOpened", "applicationManagementOpened"]) assert.ok(journey.includes(token), `Journey analytics must emit ${token}.`);
for (const token of ["transitionStarted", "transitionCompleted", "transitionFailed", "waypointCompleted", "transition_latency"]) assert.ok(transition.includes(token), `Transition analytics must emit ${token}.`);
for (const token of ["pathMomentCreatorOpened", "pathMomentPrivacyChanged", "pathMomentAppearanceChanged", "pathMomentPreviewRendered", "pathMomentDownloaded", "pathMomentShared", "pathMomentCopied", "pathMomentCanceled"]) assert.ok(pathMoment.includes(token), `Path Moment analytics must emit ${token}.`);
for (const token of ["semesterStoryCreatorOpened", "semesterStoryPreviousViewed", "semesterStoryComparisonViewed", "semesterStoryPrivacyChanged", "semesterStoryDownloaded", "semesterStoryShared", "semesterStoryCanceled"]) assert.ok(semesterStory.includes(token), `Semester Story analytics must emit ${token}.`);
for (const token of ["journeyCardDownloaded", "journeyCardShared", "journeyCardCopied"]) assert.ok(journeyCard.includes(token), `Journey Card analytics must emit ${token}.`);
for (const token of ["recommendationOpened", "recommendationSaved"]) assert.ok(`${recommendations}\n${source("components/opportunity-activity.tsx")}`.includes(token), `Recommendation analytics must emit ${token}.`);
assert.ok(account.includes("clearProductAnalyticsSession"), "Logout must clear queued analytics and recommendation attribution.");
assert.doesNotMatch(layout, /@vercel\/analytics|@vercel\/speed-insights/, "The app must have one analytics transport rather than parallel third-party collectors.");
for (const name of names) assert.ok(docs.includes(name), `Analytics documentation must cover ${name}.`);

console.log("Journey analytics checks passed", {
  schemaVersion: analyticsSchemaVersion,
  canonicalEvents: names.length,
  aggregateMetrics: Object.keys(summary.productIntelligence.performance).length,
  duplicatePrevented: true,
  privacyFieldsRejected: Object.keys(privateInput).length - Object.keys(sanitized).length,
});
