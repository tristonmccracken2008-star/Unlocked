import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");
const primitive = source("components/smart-empty-state.tsx");
const styles = source("components/smart-empty-state.module.css");

assert.match(primitive, /title: string/);
assert.match(primitive, /description: ReactNode/);
assert.match(primitive, /primaryAction\?: EmptyStateAction/);
assert.match(primitive, /secondaryAction\?: EmptyStateAction/);
assert.match(primitive, /compact\?: boolean/);
assert.match(primitive, /aria-label=\{title\}/);
assert.match(primitive, /opens in a new tab/);
assert.match(styles, /min-height: 46px/);
assert.match(styles, /@media \(max-width: 520px\)/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(styles, /@media \(forced-colors: active\)/);

const journey = source("components/journey-command-center.tsx");
for (const copy of [
  "Start building your Journey.",
  "Nothing active right now.",
  "No professional history yet.",
  "Nothing to share yet.",
  "No Journey records match",
]) assert.ok(journey.includes(copy), `Journey must include contextual empty state: ${copy}`);
assert.match(journey, /!hasRecords && model\.calendar\.groups\.length === 0/);
assert.match(journey, /model\.historyCount > 0/);

const calendar = source("components/journey-deadline-calendar.tsx");
assert.match(calendar, /Nothing coming up yet/);
assert.match(calendar, /onClick: \(\) => openAdd\(\)/);

const applications = source("components/application-workspace.tsx");
assert.match(applications, /No application tasks yet/);
assert.match(applications, /workspace\.officialSource, external: true/);
assert.match(applications, /workspace\.tasks\.length/);

const discover = source("components/opportunity-filter.tsx");
assert.match(discover, /No opportunities match this search/);
assert.match(discover, /Clear filters/);
assert.match(discover, /CatalogUnavailable/);
assert.match(discover, /catalogError/);

const advisor = source("components/advisor-page.tsx");
assert.match(advisor, /No matches yet/);
assert.match(advisor, /Nothing has cleared the eligibility and source checks/);
assert.match(advisor, /ForYouErrorState/);
assert.match(advisor, /ForYouLoading/);

const notifications = source("components/notification-center.tsx");
assert.match(notifications, /!loading && !error && !items\.length/);
assert.match(notifications, /You’re all caught up/);
assert.match(notifications, /Review notification preferences/);

console.log(JSON.stringify({
  message: "Smart empty-state checks passed.",
  reusablePrimitive: true,
  contextualJourneyStates: 5,
  errorsRemainDistinct: true,
  loadingRemainsDistinct: true,
}, null, 2));
