import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { opportunities } from "../data/opportunities";
import {
  applicationSectionTitle,
  conciseOpportunityDescription,
  eligibilityScopeFacts,
  opportunityEligibilityCriteria,
  opportunityOfficialActionLabel,
  opportunityDetailKind,
  primaryOpportunityFacts,
  specificRequirements,
} from "../lib/opportunity-detail";

function opportunity(id: string) {
  const item = opportunities.find((candidate) => candidate.id === id);
  assert.ok(item, `Missing opportunity fixture ${id}.`);
  return item;
}

const fixtures = {
  benefit: opportunity("benefit--github-student-developer-pack"),
  scholarship: opportunity("scholarship--goldwater-scholarship"),
  internship: opportunity("career--google-student-internships"),
  research: opportunity("research--nsf-reu-sites"),
  competition: opportunity("career--icpc"),
  generatedResource: opportunity("v1-expanded-resource--university-of-chicago--certifications"),
};

assert.equal(opportunityDetailKind(fixtures.benefit), "benefit");
assert.equal(opportunityDetailKind(fixtures.scholarship), "scholarship");
assert.equal(opportunityDetailKind(fixtures.internship), "internship");
assert.equal(opportunityDetailKind(fixtures.research), "research");
assert.equal(opportunityDetailKind(fixtures.competition), "competition");

assert.deepEqual(primaryOpportunityFacts(fixtures.benefit).map((fact) => fact.label), ["Value", "Access", "Deadline"]);
assert.deepEqual(primaryOpportunityFacts(fixtures.scholarship).map((fact) => fact.label), ["Award", "Deadline", "Application", "Renewal"]);
assert.deepEqual(primaryOpportunityFacts(fixtures.internship).map((fact) => fact.label), ["Location", "Format", "Compensation", "Deadline"]);
assert.deepEqual(primaryOpportunityFacts(fixtures.research).map((fact) => fact.label), ["Research focus", "Term", "Location", "Funding", "Deadline"]);
assert.deepEqual(primaryOpportunityFacts(fixtures.competition).map((fact) => fact.label), ["Deadline", "Format", "Difficulty"]);
assert.equal(applicationSectionTitle(fixtures.benefit), "How to claim it");
assert.equal(applicationSectionTitle(fixtures.scholarship), "How to apply");
assert.equal(opportunityOfficialActionLabel(fixtures.benefit, true), "Claim student benefit");
assert.equal(opportunityOfficialActionLabel(fixtures.scholarship, true), "View scholarship");
assert.equal(opportunityOfficialActionLabel(fixtures.internship, true), "Apply on Google");
assert.equal(opportunityOfficialActionLabel(fixtures.internship, false), "View official source");
const broadMajorSummary = eligibilityScopeFacts(fixtures.scholarship, []).find((fact) => fact.label === "Majors")?.value ?? "";
assert.match(broadMajorSummary, /^\d+ listed majors · Full list in details$/, "Broad eligibility must stay scannable above the fold.");
assert.ok(broadMajorSummary.length < 60, "Broad major eligibility must not render as a wall of text.");

for (const item of Object.values(fixtures)) {
  const description = conciseOpportunityDescription(item);
  assert.ok(description.length <= 220, `${item.id} should have a decision-focused summary.`);
  assert.doesNotMatch(description, /This matters because|should review the official|confirm current requirements/i, `${item.id} retained generated catalog boilerplate.`);
}
assert.deepEqual(specificRequirements(fixtures.generatedResource), [], "Generic directory instructions must not masquerade as application requirements.");
assert.deepEqual(specificRequirements(fixtures.scholarship), ["Institutional nomination", "Research-career commitment", "Academic and research materials"]);
const sparseInternship = {
  ...fixtures.internship,
  paid: null,
  remote: null,
  metadata: { ...fixtures.internship.metadata, compensation: undefined, workMode: undefined, internshipDuration: undefined },
};
assert.deepEqual(primaryOpportunityFacts(sparseInternship).map((fact) => fact.label), ["Location", "Deadline"], "Unsupported facts must be omitted rather than displayed as empty template fields.");
const criteria = opportunityEligibilityCriteria({
  ...fixtures.scholarship,
  metadata: { ...fixtures.scholarship.metadata, eligibilityRules: { minimumGpa: 3, citizenship: "us_citizen", educationLevels: ["undergraduate"] } },
}, []);
assert.deepEqual(criteria.slice(-3), [
  { label: "Education level", value: "undergraduate" },
  { label: "Citizenship", value: "us citizen" },
  { label: "Minimum GPA", value: "3+" },
]);

const page = readFileSync("app/opportunities/[id]/page.tsx", "utf8");
for (const token of ["data-opportunity-kind", "Who qualifies", "Official source", "About this opportunity", "More details", "officialActionLabel", "Checked against the provider"]) {
  assert.ok(page.includes(token), `Opportunity details must retain ${token}.`);
}
for (const removed of ["whyThisMatters", "Frequently asked questions", "What is documented—and what is not", "Explore related listings"]) {
  assert.ok(!page.includes(removed), `Opportunity details must remove report-style content: ${removed}.`);
}
assert.match(page, /<details[^>]*data-learn-more/, "Lower-priority detail must use progressive disclosure.");
assert.ok(page.indexOf("Who qualifies") < page.indexOf("About this opportunity"), "Eligibility must remain visible before disclosure.");
assert.ok(page.indexOf("OpportunityActivityActions") < page.indexOf("About this opportunity"), "Official and Journey actions must remain visible before disclosure.");
assert.match(page, /conciseDetail \? <section[\s\S]*How to claim it|conciseDetail \? <section[\s\S]*applicationSectionTitle/, "Simple benefits must use the compact access path.");
assert.equal((page.match(/item\.description/g) ?? []).length, 0, "Raw generated descriptions must not be repeated in the page JSX.");

console.log("Opportunity detail clarity checks passed", {
  kinds: Object.keys(fixtures).length - 1,
  benefitFacts: primaryOpportunityFacts(fixtures.benefit).length,
  complexFacts: primaryOpportunityFacts(fixtures.scholarship).length,
});
