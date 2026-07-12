import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const resolver = read("data/organization-logos.ts");
const component = read("components/organization-logo.tsx");
const opportunityCard = read("components/opportunity-card.tsx");
const advisor = read("components/advisor-page.tsx");
const journey = read("components/student-journey-dashboard.tsx");
const tracker = read("components/my-opportunities-page.tsx");
const detail = read("app/opportunities/[id]/page.tsx");
const config = read("next.config.mjs");
const pkg = read("package.json");

for (const symbol of [
  "OrganizationIdentity",
  "ResolvedOrganizationLogo",
  "organizationLogoRegistry",
  "normalizeOrganizationName",
  "organizationIdentity",
  "resolveOrganizationLogo",
  "organizationLogoAudit",
]) {
  assert.ok(resolver.includes(symbol), `Organization logo resolver must expose ${symbol}.`);
}

for (const organization of [
  "Apple",
  "University of Chicago",
  "OpenAI",
  "ChatGPT",
  "GitHub",
  "Adobe",
  "Amazon",
  "Google",
  "Microsoft",
  "Meta",
  "Jane Street",
  "8VC",
  "AFCEA",
  "Notion",
]) {
  assert.ok(resolver.toLowerCase().includes(organization.toLowerCase()), `Logo registry must include ${organization}.`);
}

for (const asset of [
  "/logos/org/amazon.svg",
  "/logos/org/adobe.svg",
  "/logos/org/apple.svg",
  "/logos/org/openai.svg",
  "/logos/org/github.svg",
  "/logos/org/uchicago.svg",
  "/logos/org/google.svg",
  "/logos/org/microsoft.svg",
  "/logos/org/meta.svg",
  "/logos/org/jane-street.svg",
  "/logos/org/8vc.svg",
  "/logos/org/afcea.svg",
]) {
  assert.ok(resolver.includes(asset), `Known organization must use curated local asset: ${asset}.`);
}

for (const token of [
  "opportunity.organization",
  "opportunity.official_source",
  "trustedSourceLogo",
  "approvedLogoHosts",
  "domainLogoUrl",
  "categoryIcon",
  "generated-fallback",
]) {
  assert.ok(resolver.includes(token), `Resolver must preserve safe fallback behavior: ${token}.`);
}

assert.doesNotMatch(resolver, /opportunity\.title/, "Organization logos must not be inferred from arbitrary opportunity title text.");

for (const token of ["resolveOrganizationLogo", "alt=", "loading=\"lazy\"", "decoding=\"async\"", "onError", "setFailed(false)", "width=", "height=", "aria-label"]) {
  assert.ok(component.includes(token), `OrganizationLogo component must include ${token}.`);
}

assert.ok(config.includes("logo.clearbit.com"), "Next image configuration must permit the remote domain-provider host.");

for (const [path, source] of [
  ["components/opportunity-card.tsx", opportunityCard],
  ["components/advisor-page.tsx", advisor],
  ["components/student-journey-dashboard.tsx", journey],
  ["components/my-opportunities-page.tsx", tracker],
  ["app/opportunities/[id]/page.tsx", detail],
]) {
  assert.ok(source.includes("OrganizationLogo"), `${path} must render shared organization logos.`);
}

assert.ok(pkg.includes("check:logos"), "Package scripts must include the organization logo regression check.");

console.log("Organization logo checks passed.");
