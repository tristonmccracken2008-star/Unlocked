import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizedFirstLaunchComplete } from "../lib/first-launch-state";

const source = (path: string) => readFileSync(path, "utf8");

assert.equal(normalizedFirstLaunchComplete({ firstLaunchComplete: false }, true), false, "Newly onboarded accounts must remain eligible for the walkthrough.");
assert.equal(normalizedFirstLaunchComplete({ firstLaunchComplete: true }, true), true, "Completed walkthrough state must remain complete.");
assert.equal(normalizedFirstLaunchComplete({}, true), true, "Legacy onboarded accounts without the field must migrate as complete.");
assert.equal(normalizedFirstLaunchComplete({}, false), false, "Legacy incomplete accounts must not bypass onboarding.");

const accountStore = source("lib/auth-store.ts");
assert.match(accountStore, /firstLaunchComplete: false/, "New accounts must begin with an explicit incomplete walkthrough state.");
assert.match(accountStore, /current\.firstLaunchComplete \|\| incoming\.firstLaunchComplete/, "Completion must be monotonic and resist accidental reset.");
assert.match(accountStore, /normalizedFirstLaunchComplete/, "Stored legacy accounts must use the migration helper.");

const service = source("lib/first-launch.ts");
for (const requirement of ["withSecurityLock", "accountHasCompletedOnboarding", "duplicate: true", "firstLaunchCompletedAt"]) {
  assert.ok(service.includes(requirement), `First-launch service must preserve ${requirement}.`);
}

const route = source("app/api/account/first-launch/route.ts");
for (const requirement of ["assertSameOrigin", "getSession", "enforceRateLimit", "completeFirstLaunch", "Cache-Control"]) {
  assert.ok(route.includes(requirement), `First-launch endpoint must preserve ${requirement}.`);
}
assert.doesNotMatch(route, /userId.*request|email|profile/, "The completion endpoint must derive ownership from the authenticated session and accept no profile payload.");

const guard = source("lib/onboarding.ts");
assert.match(guard, /redirect\("\/welcome"\)/, "Protected product routes must stop incomplete first launches at the walkthrough.");
assert.match(guard, /requireFirstLaunchSession/, "The walkthrough must have a dedicated server guard.");

const walkthrough = source("components/first-launch-walkthrough.tsx");
const preview = source("components/first-launch-preview.tsx");
const presentation = source("components/first-launch-walkthrough.module.css");
for (const copy of ["Discover Opportunities", "Personalized For You", "Build Your Journey", "You’re Ready", "Start Exploring", "Browse thousands of opportunities", "surface opportunities worth your attention", "stay on top of what’s next", "make more of your time in college"]) {
  assert.ok(walkthrough.includes(copy), `Walkthrough must include ${copy}.`);
}
for (const behavior of ["ArrowRight", "ArrowLeft", "onTouchStart", "onTouchEnd", "prefers-reduced-motion", "first_launch_completed", "sessionStorage", "accountSessionEvent"]) {
  assert.ok(walkthrough.includes(behavior), `Walkthrough must support ${behavior}.`);
}
for (const feature of ["previewSearch", "previewCardGrid", "matchSignals", "recommendationFeature", "journeySummary", "journeyActions", "journeyRecords"]) {
  assert.ok(preview.includes(feature), `The art-directed product preview must include ${feature}.`);
}
assert.doesNotMatch(walkthrough, /<picture|<img|\/walkthrough\//, "The tour must not depend on incidental page screenshots.");
assert.doesNotMatch(preview, /<button/, "Decorative product previews must not add hidden keyboard stops.");
for (const behavior of ["preview-enter-forward", "preview-enter-back", "tour-crossfade", "data-theme=\"midnight\"", "backdrop-filter", ".finish .veil", "min-height: 430px"]) {
  assert.ok(presentation.includes(behavior), `Walkthrough presentation must preserve ${behavior}.`);
}

console.log("First-launch walkthrough regression checks passed.");
