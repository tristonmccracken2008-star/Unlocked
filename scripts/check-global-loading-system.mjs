import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(path, "utf8");
const loadingSystem = read("components/loading-system.tsx");
const pendingLabel = read("components/delayed-pending-label.tsx");
const globals = read("app/globals.css");
const rootLoading = read("app/loading.tsx");
const advisorLoading = read("app/advisor/loading.tsx");

assert.match(loadingSystem, /export function LoadingRegion/);
assert.match(loadingSystem, /export function SkeletonBlock/);
assert.match(loadingSystem, /export function AppPageLoading/);
assert.match(loadingSystem, /export function AccountPageLoading/);
assert.match(loadingSystem, /export function SectionLoading/);
assert.match(loadingSystem, /export function AdvisorRecommendationLoading/);
assert.match(pendingLabel, /window\.setTimeout\(\(\) => setVisible\(true\), delay\)/);
assert.match(pendingLabel, /delay = 300/);
assert.match(pendingLabel, /unlocked-button-label/);
assert.match(globals, /--loading-base:/);
assert.match(globals, /unlocked-skeleton-shimmer/);
assert.match(globals, /translate3d/);
assert.match(globals, /data-loading-delay="true"/);
assert.match(globals, /animation:[^;]+300ms/);
assert.match(globals, /prefers-reduced-motion:\s*reduce/);
assert.match(globals, /forced-colors:\s*active/);
assert.match(rootLoading, /AppPageLoading/);
assert.match(advisorLoading, /AdvisorRecommendationLoading/);

const requiredPendingFiles = [
  "components/billing-checkout-button.tsx",
  "components/notification-settings.tsx",
  "components/opportunity-activity.tsx",
  "components/personalized-home.tsx",
  "components/journey-transition-control.tsx",
  "components/journey-timeline-control.tsx",
  "components/journey-card-creator.tsx",
  "components/path-moment-creator.tsx",
  "components/semester-story-creator.tsx",
  "components/report-outdated-button.tsx",
];
for (const file of requiredPendingFiles) {
  const source = read(file);
  assert.match(source, /DelayedPendingLabel/, `${file} must use the shared delayed button state.`);
  assert.match(source, /aria-busy=/, `${file} must expose pending state to assistive technology.`);
  assert.match(source, /data-action-state=/, `${file} must use the shared action-state styling.`);
}

const productionFiles = [];
for (const root of ["app", "components"]) {
  const walk = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (/\.(?:tsx?|css)$/.test(name)) productionFiles.push(path);
    }
  };
  walk(root);
}
const productionSource = productionFiles.map((file) => read(file)).join("\n");
assert.doesNotMatch(productionSource, /animate-spin|data-journey-save-progress|\bspinner\b/i, "Generic or legacy circular loading indicators must not return.");
assert.doesNotMatch(productionSource, />\s*Loading(?:…|\.\.\.)\s*</, "Generic visible Loading labels must use the shared system.");

const discover = read("components/opportunity-filter.tsx");
assert.match(discover, /data-filter-results=""/);
assert.match(discover, /data-refreshing=/);
assert.match(discover, /catalogError[\s\S]*Retry/);
assert.match(read("components/notification-center.tsx"), /NotificationSkeleton[\s\S]*We couldn’t load[\s\S]*Retry/);
assert.match(read("components/notification-settings.tsx"), /SectionLoading[\s\S]*Retry notification settings/);

console.log(`Premium global loading system checks passed across ${productionFiles.length} source files.`);
