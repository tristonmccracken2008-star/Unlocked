import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { renderToStaticMarkup } from "react-dom/server";
import { JourneyCardArtwork, journeyCardAltDescription } from "../components/journey-card-artwork";
import { opportunities } from "../data/opportunities";
import type { TrackedOpportunity } from "../data/student-activity";
import type { AccountData, AuthUser } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import {
  buildJourneyTimelineModel,
  journeyCardLayouts,
  journeyCardTemplates,
  journeyCardThemes,
  type JourneyCardPrivacy,
} from "../lib/journey-timeline";

const scholarship = opportunities.find((item) => item.type === "Scholarship");
const research = opportunities.find((item) => item.type === "Research");
const internship = opportunities.find((item) => item.type === "Career" && /intern|co-?op|apprentice/i.test(`${item.title} ${item.category}`));
assert.ok(scholarship && research && internship, "Journey Card fixtures require scholarship, research, and internship opportunities.");

const now = "2026-07-30T12:00:00.000Z";
const selected = [scholarship, research, internship];
const statuses = ["Accepted", "Completed", "Accepted"] as const;
const tracker = Object.fromEntries(selected.map((opportunity, index) => {
  const record: TrackedOpportunity = {
    id: opportunity.id,
    status: statuses[index],
    savedAt: `2026-0${index + 1}-05T12:00:00.000Z`,
    updatedAt: `2026-0${index + 4}-15T12:00:00.000Z`,
    version: 1,
    history: [],
  };
  return [opportunity.id, record];
}));
const account: AccountData = {
  profile: {
    firstName: "Jordan",
    lastName: "Rivera",
    schoolSlug: "university-of-chicago",
    major: "Mathematics",
    graduationYear: "2030",
    year: "First year",
    interests: "Research",
    careerGoal: "Research",
    onboardingCompletedAt: now,
    updatedAt: now,
  },
  onboardingComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: Object.keys(tracker), claimed: [], tracked: tracker },
  savedOpportunities: Object.values(tracker).map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
  tracker,
  preferences: { appearance: "light", updatedAt: now },
  journeyProgress: {},
  advisor: null,
  referrals: null,
  updatedAt: now,
};
const user: AuthUser = { id: "journey-card-test", email: "private@example.test", name: "Jordan Rivera" };
const model = buildJourneyTimelineModel({ user, account, opportunities: selected, now: new Date(now) });
const templates = new Set(model.card.achievements.flatMap((achievement) => achievement.templates));
assert.deepEqual([...journeyCardTemplates].filter((template) => !templates.has(template)), [], "Confirmed fixtures must cover every Journey Card template.");
assert.ok(model.card.achievements.filter((item) => item.id !== "year-review").every((item) => model.events.some((event) => event.id === item.id)), "Every achievement must resolve to a confirmed Journey event.");
assert.deepEqual(model.card.achievements.find((item) => item.label === "Scholarship awarded")?.templates, ["scholarship"], "Scholarship achievements cannot select unrelated templates.");
assert.deepEqual(model.card.achievements.find((item) => item.id === "year-review")?.templates, ["year_review"], "Annual summaries must use only Year in Review.");
assert.ok(model.card.achievements.every((item) => !item.organizationMark?.src || item.organizationMark.src.startsWith("/")), "Exports may embed only same-origin organization marks.");

const privateDefaults: JourneyCardPrivacy = {
  nameMode: "first_name",
  includeSchool: true,
  includeDates: true,
  includeOrganization: true,
  includeBranding: true,
  includeRole: true,
  includeLocation: true,
  includeAwardAmount: true,
};
const combinations: string[] = [];
const started = performance.now();
for (const template of journeyCardTemplates) {
  const achievement = model.card.achievements.find((item) => item.templates.includes(template));
  assert.ok(achievement, `${template} requires a compatible factual achievement.`);
  for (const theme of journeyCardThemes) {
    for (const layout of Object.keys(journeyCardLayouts) as Array<keyof typeof journeyCardLayouts>) {
      const markup = renderToStaticMarkup(<JourneyCardArtwork card={model.card} achievement={achievement} template={template} theme={theme} layout={layout} privacy={privateDefaults} />);
      assert.match(markup, new RegExp(`width="${journeyCardLayouts[layout].width}"`));
      assert.match(markup, new RegExp(`height="${journeyCardLayouts[layout].height}"`));
      assert.match(markup, new RegExp(`data-journey-card-template="${template}"`));
      assert.match(markup, new RegExp(`data-export-theme="${theme}"`));
      assert.doesNotMatch(markup, /private@example\.test|undefined|NaN/);
      combinations.push(`${template}:${theme}:${layout}`);
    }
  }
}
const durationMs = performance.now() - started;
assert.equal(combinations.length, 84, "All template, theme, and format combinations must render.");
assert.ok(durationMs < 500, `Journey Card server rendering must stay bounded; received ${durationMs.toFixed(2)}ms.`);

const achievement = model.card.achievements.find((item) => item.id !== "year-review");
assert.ok(achievement);
const hidden: JourneyCardPrivacy = {
  ...privateDefaults,
  nameMode: "anonymous",
  includeSchool: false,
  includeDates: false,
  includeOrganization: false,
  includeBranding: false,
  includeRole: false,
  includeLocation: false,
  includeAwardAmount: false,
};
const hiddenMarkup = renderToStaticMarkup(<JourneyCardArtwork card={model.card} achievement={achievement} template={achievement.defaultTemplate} theme="cream" layout="square" privacy={hidden} />);
assert.doesNotMatch(hiddenMarkup, /Jordan|Rivera|University of Chicago/);
assert.match(journeyCardAltDescription(model.card, achievement, achievement.defaultTemplate, hidden), /Anonymous/);
assert.doesNotMatch(journeyCardAltDescription(model.card, achievement, achievement.defaultTemplate, hidden), /University of Chicago|private@example\.test/);

console.log(JSON.stringify({
  message: "Journey Cards 2.0 checks passed.",
  factualAchievements: model.card.achievements.length,
  templates: [...templates],
  renderScenarios: combinations.length,
  renderingMs: Number(durationMs.toFixed(2)),
}, null, 2));
