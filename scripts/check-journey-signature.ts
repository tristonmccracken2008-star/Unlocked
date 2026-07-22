import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { opportunities } from "../data/opportunities";
import { defaultBillingRecord } from "../lib/billing";
import type { AccountData, AuthUser } from "../lib/account-types";
import { buildJourneyTimelineModel } from "../lib/journey-timeline";
import type { TrackedOpportunity } from "../data/student-activity";

const source = (path: string) => readFileSync(path, "utf8");
const selected = [
  opportunities.find((item) => item.type === "Scholarship" && typeof item.estimated_value === "number"),
  opportunities.find((item) => item.type === "Research"),
  opportunities.find((item) => item.type === "Career"),
].filter((item): item is (typeof opportunities)[number] => Boolean(item));
assert.equal(selected.length, 3, "Signature fixtures require scholarship, research, and career opportunities.");

const statuses = ["Accepted", "Completed", "Interview"] as const;
const tracker = Object.fromEntries(selected.map((opportunity, index) => {
  const status = statuses[index];
  const record: TrackedOpportunity = {
    id: opportunity.id,
    status,
    savedAt: `2026-0${index + 1}-05T12:00:00.000Z`,
    updatedAt: `2026-0${index + 4}-10T12:00:00.000Z`,
    version: 1,
    history: [],
  };
  return [opportunity.id, record];
}));
const now = "2026-07-22T12:00:00.000Z";
const account: AccountData = {
  profile: { firstName: "Jordan", lastName: "Rivera", schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2030", year: "First year", interests: "Research", careerGoal: "Research", onboardingCompletedAt: now, updatedAt: now },
  onboardingComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: Object.keys(tracker), claimed: [], tracked: tracker },
  savedOpportunities: Object.values(tracker).map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
  tracker,
  preferences: { appearance: "light", updatedAt: now },
  journeyProgress: { "first-resume": true },
  advisor: null,
  referrals: null,
  updatedAt: now,
};
const user: AuthUser = { id: "journey-signature", email: "journey-signature@example.test", name: "Jordan Rivera" };
const model = buildJourneyTimelineModel({ user, account, opportunities: selected });

assert.equal(model.story.title, "Jordan's story");
assert.ok(model.summary.length > 0 && model.summary.every((metric) => metric.value > 0), "Journey must hide empty summary metrics.");
assert.ok(model.summary.some((metric) => metric.id === "scholarships" && metric.value === 1), "Awarded scholarships must be backed by accepted/completed scholarship records.");
assert.ok(model.summary.some((metric) => metric.id === "research" && metric.value === 1), "Research experiences must require a completed research record.");
assert.ok(model.highlights.length > 0 && model.highlights.length <= 4, "Highlights must remain curated and bounded.");
assert.ok(model.highlights.filter((item) => /application|interview|offer/i.test(item.label)).every((item) => item.opportunity && !["Benefit", "AI"].includes(item.opportunity.type) && item.opportunity.category !== "Software"), "Application highlights cannot be inferred from benefit or software records.");
assert.equal(new Set(model.highlights.map((item) => `${item.title}|${item.occurredAt}`)).size, model.highlights.length, "Highlights cannot repeat the same recorded moment.");
assert.equal(model.filterCounts.everything, model.events.length);
assert.equal(model.filterCounts.scholarships, model.events.filter((event) => event.filters.includes("scholarships")).length);
assert.ok(model.card.periodTitle === "My 2026" || /^(Spring|Summer|Fall) 2026$/.test(model.card.periodTitle), "Share titles must be derived from recorded dates.");
assert.ok(model.card.highlights.every((item) => item.title && item.date), "Every exported highlight must come from a dated Journey event.");

const timeline = source("components/journey-timeline.tsx");
const filters = source("components/journey-timeline-filters.tsx");
const styles = source("components/journey-timeline.module.css");
const artwork = source("components/journey-card-artwork.tsx");
for (const token of ["My story", "Current progress", "Moments worth remembering.", "The story so far.", "Your progress, ready to keep."]) assert.ok(timeline.includes(token), `Journey signature UI must include ${token}.`);
assert.match(filters, /localStorage\.setItem\(storageKey, filter\)/, "The last selected Journey filter must be remembered locally.");
assert.match(filters, /aria-pressed=\{active === filter\}/, "Journey filters must expose selected state.");
assert.match(styles, /content-visibility:\s*auto/, "Large histories must retain browser rendering containment.");
assert.match(styles, /prefers-reduced-motion:\s*reduce/, "Journey motion must respect reduced-motion preferences.");
assert.match(artwork, /periodTitle/);
assert.match(artwork, /moment\.organization/);
assert.doesNotMatch(timeline, /\bXP\b|streak|leaderboard|confetti|fake progress/i);

console.log(JSON.stringify({
  message: "Journey signature experience checks passed.",
  factualSummaryMetrics: model.summary.map((metric) => metric.id),
  factualHighlights: model.highlights.map((highlight) => highlight.id),
  eventCount: model.events.length,
  filterCounts: model.filterCounts,
  shareTitle: model.card.periodTitle,
}, null, 2));
