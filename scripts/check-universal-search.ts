import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { opportunities } from "../data/opportunities";
import type { TrackedOpportunity } from "../data/student-activity";
import type { AccomplishmentRecord } from "../data/accomplishments";
import { defaultBillingRecord } from "../lib/billing";
import type { AccountData, AuthUser } from "../lib/account-types";
import { buildUniversalSearch } from "../lib/universal-search";

const now = new Date("2026-08-14T12:00:00.000Z");
const user: AuthUser = { id: "universal-search-owner", email: "search@example.test", name: "Taylor Student" };
const nasa = opportunities.find((item) => /NASA/i.test(`${item.title} ${item.organization}`) && item.type === "Career") ?? opportunities.find((item) => /NASA/i.test(`${item.title} ${item.organization}`));
assert.ok(nasa, "Universal search checks require an existing NASA catalog opportunity.");

function account(record?: TrackedOpportunity): AccountData {
  const accomplishment: AccomplishmentRecord | undefined = record ? {
    id: "manual:research-assistant",
    source: "manual",
    snapshot: { title: "Research Assistant", organization: "Campus Lab", capturedAt: now.toISOString() },
    kind: "research",
    outcome: "completed",
    outcomeDate: "2026-05-10",
    notes: "private accomplishment note",
    hidden: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: 0,
  } : undefined;
  return {
    profile: { firstName: "Taylor", lastName: "Student", schoolSlug: "university-of-chicago", major: "Computer Science", graduationYear: "2030", year: "First year", interests: "Software, Research", careerGoal: "Software Engineering", onboardingCompletedAt: now.toISOString() },
    onboardingComplete: true,
    firstLaunchComplete: true,
    billing: defaultBillingRecord(),
    activity: { viewed: [], saved: record ? [record.id] : [], claimed: [], tracked: record ? { [record.id]: record } : {} },
    savedOpportunities: record ? [{ opportunityId: record.id, savedAt: record.savedAt }] : [],
    tracker: record ? { [record.id]: record } : {},
    applicationWorkspaces: record ? { [record.id]: {
      opportunityId: record.id,
      tasks: { resume: { id: "resume", title: "Update résumé", dueDate: "2026-08-18", source: "user", completed: false, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 0 } },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      version: 0,
    } } : {},
    preferences: { appearance: "light", updatedAt: now.toISOString() },
    journeyProgress: {},
    accomplishments: accomplishment ? { [accomplishment.id]: accomplishment } : {},
    advisor: null,
    referrals: null,
    updatedAt: now.toISOString(),
  };
}

const tracked: TrackedOpportunity = {
  id: nasa.id,
  status: "Applying",
  savedAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-09T12:00:00.000Z",
  version: 1,
  history: [{ id: "search-history", transition: "start", priorStatus: "Saved", resultingStatus: "Applying", occurredAt: "2026-08-09T12:00:00.000Z", details: { notes: "private search fixture note", source: "student_reported" } }],
};

const owner = buildUniversalSearch({ user, account: account(tracked), opportunities, query: "NASA", now });
assert.equal(owner.query, "NASA");
assert.equal(owner.results[0]?.group, "Your Journey", "A matching private Journey result must outrank the public catalog result.");
assert.ok(owner.results.some((item) => item.group === "Opportunities" && /NASA/i.test(item.title)), "The canonical Discover index must supply public opportunity results.");
assert.doesNotMatch(JSON.stringify(owner), /private search fixture note|search@example\.test|Computer Science/, "Search responses must not expose notes, email, or profile answers.");

const other = buildUniversalSearch({ user: { ...user, id: "other-account" }, account: account(), opportunities, query: "NASA", now });
assert.equal(other.results.some((item) => item.group === "Your Journey"), false, "Another account must never receive the owner's Journey result.");
assert.equal(other.results.some((item) => item.group === "Application tasks"), false, "Another account must never receive the owner's application tasks.");

const tasks = buildUniversalSearch({ user, account: account(tracked), opportunities, query: "resume", now });
assert.ok(tasks.results.some((item) => item.group === "Application tasks" && item.title === "Update résumé"), "Application task search must use the owner's canonical workspace.");
const accomplishmentResults = buildUniversalSearch({ user, account: account(tracked), opportunities, query: "Research Assistant", now });
assert.ok(accomplishmentResults.results.some((item) => item.group === "Accomplishments" && item.title === "Research Assistant"), "Private accomplishment titles must be searchable by their owner.");
assert.doesNotMatch(JSON.stringify(accomplishmentResults), /private accomplishment note/, "Private accomplishment notes must never enter broad search results.");
assert.equal(buildUniversalSearch({ user: { ...user, id: "other-account" }, account: account(), opportunities, query: "Research Assistant", now }).results.some((item) => item.group === "Accomplishments"), false, "Accomplishments must remain account-isolated in search.");
const pathResults = buildUniversalSearch({ user, account: account(tracked), opportunities, query: "quant path", now });
assert.ok(pathResults.results.some((item) => item.group === "Paths" && item.href === "/paths/quantitative-data"), "Universal Search must distinguish goal-oriented Paths from catalog opportunities.");
assert.equal(pathResults.results.filter((item) => item.group === "Paths").every((item) => item.kind === "path"), true);
const collectionResults = buildUniversalSearch({ user, account: account(tracked), opportunities, query: "first year opportunities", now });
assert.ok(collectionResults.results.some((item) => item.group === "Collections" && item.href === "/collections/first-year"), "Universal Search must expose launched curated starting points.");
assert.equal(collectionResults.results.some((item) => item.href === "/collections/transfer-friendly"), false, "Deferred collections must remain absent from search.");
const strategyResults = buildUniversalSearch({ user, account: account(tracked), opportunities, query: "current mix", now });
assert.equal(strategyResults.results[0]?.href, "/#journey-strategy", "Strategy intent must hand off to the private Journey context instead of creating a top-level destination.");

const timings: number[] = [];
for (let run = 0; run < 8; run += 1) {
  const started = performance.now();
  buildUniversalSearch({ user, account: account(tracked), opportunities, query: run % 2 ? "research" : "NASA", now });
  timings.push(performance.now() - started);
}
const average = timings.reduce((sum, value) => sum + value, 0) / timings.length;
assert.ok(average < 500, `Warm universal search must remain under 500ms average; received ${average.toFixed(2)}ms.`);

const component = readFileSync("components/universal-command-center.tsx", "utf8");
const styles = readFileSync("components/universal-command-center.module.css", "utf8");
const header = readFileSync("components/header.tsx", "utf8");
const route = readFileSync("app/api/search/route.ts", "utf8");
for (const contract of ["role=\"combobox\"", "role=\"listbox\"", "aria-activedescendant", "ArrowDown", "ArrowUp", "Escape", "Search UnlockED…", "No results for"]) {
  assert.ok(component.includes(contract), `Universal Search must preserve interaction contract: ${contract}`);
}
assert.match(component, /requestRef\.current\?\.abort/);
assert.match(component, /authenticatedFetch\(\s*`\/api\/search/);
assert.doesNotMatch(component, /from "@\/data\/opportunities"|opportunities\.json/, "The client must never hydrate the opportunity catalog.");
assert.match(header, /aria-keyshortcuts="Meta\+K Control\+K"/);
assert.match(header, /const loadUniversalCommandCenter = \(\) =>\s*import\("\.\/universal-command-center"\)/);
assert.match(header, /dynamic\(loadUniversalCommandCenter,\s*\{\s*ssr: false,?\s*\}\)/);
assert.match(styles, /@media \(max-width: 639px\)/);
assert.match(styles, /min-height: 100dvh/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(styles, /@media \(forced-colors: active\)/);
assert.match(route, /getServerSessionForProduct/);
assert.match(route, /accountHasCompletedOnboarding/);
assert.match(route, /private, no-store/);
assert.match(route, /enforceRateLimit/);

console.log("Universal Search checks passed", {
  ownerResults: owner.results.length,
  publicMatches: owner.totalOpportunityMatches,
  accountIsolation: true,
  warmAverageMs: Number(average.toFixed(2)),
});
