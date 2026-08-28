import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { opportunities, type Opportunity } from "../data/opportunities";
import {
  organizationCategoryIcon,
  organizationInitials,
  resolveOrganizationLogo,
  resolveOrganizationMark,
} from "../data/organization-logos";

const resolved = opportunities.map((opportunity) => ({ opportunity, logo: resolveOrganizationLogo(opportunity) }));
assert.equal(resolved.length, opportunities.length, "Every catalog opportunity must enter the organization-branding pipeline.");
assert.equal(resolved.filter(({ logo }) => !logo.alt || (!logo.initials && !logo.categoryIcon)).length, 0, "Every opportunity must retain a non-empty fallback even when its image fails.");
assert.equal(resolved.filter(({ logo }) => logo.kind === "category").length, 0, "Catalog records with organizations must resolve to a logo or branded monogram before category fallback.");

for (const name of ["Google", "GitHub", "Microsoft", "OpenAI", "Apple", "Adobe"]) {
  const opportunity = opportunities.find((item) => item.organization === name);
  assert.ok(opportunity, `${name} must exist in the catalog fixture.`);
  const logo = resolveOrganizationLogo(opportunity!);
  assert.equal(logo.kind, "image", `${name} must resolve to an official image.`);
  assert.equal(logo.source, "curated", `${name} must use a local curated asset rather than a network fallback.`);
}

const aliasedDomain = resolveOrganizationMark({ organization: "Microsoft Education", officialSource: "https://learn.microsoft.com/education", type: "Benefit", category: "Software" });
assert.equal(aliasedDomain.kind, "image", "Known organization domains must normalize unlisted display-name variants.");
assert.equal(aliasedDomain.source, "curated", "Known domains must prefer the local curated asset.");

const monogram = resolveOrganizationMark({ organization: "Stanford", type: "Research", category: "Academic Program" });
assert.equal(monogram.kind, "initials");
assert.equal(monogram.initials, "S", "Single-word organizations must use a deliberate one-letter monogram.");
assert.equal(organizationInitials("University of California"), "UC", "Connector words must not weaken organization monograms.");

const category = resolveOrganizationMark({ organization: "", type: "Career", category: "Competition" });
assert.equal(category.kind, "category", "Missing organization identity must fall back to a semantic category icon.");
assert.equal(category.categoryIcon, "competition");
assert.equal(organizationCategoryIcon("Scholarship", "Financial Aid"), "scholarship");
assert.equal(organizationCategoryIcon("AI", "Software"), "software");

const cached = resolveOrganizationLogo(opportunities[0]);
assert.equal(resolveOrganizationLogo(opportunities[0]), cached, "Repeated resolver calls must reuse the cached immutable result.");

const component = readFileSync("components/organization-logo.tsx", "utf8");
const styles = readFileSync("components/organization-logo.module.css", "utf8");
assert.match(component, /onError=\{\(\) => setFailed\(true\)\}/, "Broken image requests must reveal the existing monogram or category fallback.");
assert.match(component, /loading=\{eager \? "eager" : "lazy"\}/, "Organization images must remain lazy by default.");
assert.match(styles, /object-fit:\s*contain/, "Official logos must preserve their aspect ratio.");
assert.match(styles, /\.sm \{ width: 44px; height: 44px;/, "Shared marks must preserve a stable accessible footprint.");
assert.match(styles, /prefers-reduced-motion/, "Logo transitions must respect reduced-motion preferences.");

for (const [path, token] of [
  ["components/opportunity-card.tsx", "OrganizationLogo"],
  ["components/advisor-page.tsx", "OrganizationLogo"],
  ["components/opportunity-detail-experience.tsx", "OrganizationLogo"],
  ["components/journey-command-center.tsx", "OrganizationMark"],
  ["components/journey-timeline.tsx", "OrganizationLogo"],
  ["components/journey-timeline-control.tsx", "ResolvedOrganizationMark"],
  ["components/notification-center.tsx", "OrganizationMark"],
] as const) {
  assert.ok(readFileSync(path, "utf8").includes(token), `${path} must use the canonical organization-branding system.`);
}

const commandCenter = readFileSync("components/journey-command-center.tsx", "utf8");
assert.doesNotMatch(commandCenter, />\?<\/span>/, "Journey must not retain generic question-mark placeholders.");

console.log("Premium organization branding checks passed", {
  opportunities: resolved.length,
  imageCandidates: resolved.filter(({ logo }) => logo.kind === "image").length,
  monograms: resolved.filter(({ logo }) => logo.kind === "initials").length,
});
