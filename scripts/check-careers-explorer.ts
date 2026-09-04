import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { careers, careerCategories, careerGrades } from "../data/careers";
import { searchCareers } from "../lib/careers";
import { relatedOpportunities } from "../lib/career-opportunities";
import { opportunities } from "../data/opportunities";
import { classifyCatalogRecord } from "../data/catalog-reliability";

assert.ok(careers.length >= 100, `Expected at least 100 careers; received ${careers.length}.`);
assert.equal(new Set(careers.map((career) => career.id)).size, careers.length, "Career IDs must be unique.");
assert.equal(new Set(careers.map((career) => career.slug)).size, careers.length, "Career slugs must be unique.");
assert.ok(careerCategories.length >= 15, "The catalog must span broad career categories.");
for (const career of careers) {
  assert.ok(career.description.length > 30 && career.responsibilities.length >= 3 && career.relatedCareerIds.length >= 2, `${career.name} must be a complete profile.`);
  assert.ok(career.hours.minimum > 0 && career.hours.maximum >= career.hours.minimum, `${career.name} needs a credible hours range.`);
  assert.ok(career.majors.length >= 2 && Object.values(career.skills).every((values) => values.length >= 2), `${career.name} needs preparation and skills.`);
  assert.equal(Object.keys(career.intensity).length, 7, `${career.name} needs all qualitative intensity attributes.`);
  assert.ok(career.surprises.length >= 2 && career.tryBeforeCommitting.length >= 3 && career.careerBranches.length >= 2, `${career.name} needs research depth and branching.`);
  assert.ok(Object.values(career.collegePlan).every((items) => items.length), `${career.name} needs a complete college exploration plan.`);
  assert.ok(career.ai.today.length >= 3 && career.ai.workflowChange.length > 30 && career.ai.risk.length > 20 && career.ai.upside.length > 20, `${career.name} needs differentiated AI analysis.`);
  assert.ok(career.outlook.drivers.length >= 3 && career.outlook.risks.length >= 3, `${career.name} needs outlook drivers and risks.`);
  assert.equal(Object.keys(career.grades).length, 8, `${career.name} must expose all eight grades.`);
  for (const grade of Object.values(career.grades)) {
    assert.ok(careerGrades.includes(grade.grade) && grade.explanation.length > 20 && grade.factors.length >= 2, `${career.name} has an incomplete grade.`);
  }
  assert.ok(career.sources.length >= 4 && career.sources.every((source) => source.url.startsWith("https://") && source.supports.length), `${career.name} needs attributable sources.`);
  assert.match(career.ai.currentEffect, /tasks|work/i, `${career.name} AI language must be task-aware.`);
}

assert.deepEqual(["Quantitative Trader", "Quantitative Researcher", "Quant Developer"].every((name) => searchCareers({ query: "quant" }).some((career) => career.name === name)), true, "Quant search must find the three canonical quant careers.");
assert.deepEqual(["AI Engineer", "AI Research Scientist", "Machine Learning Engineer"].every((name) => searchCareers({ query: "AI" }).some((career) => career.name === name)), true, "AI search must find the canonical AI careers.");
assert.ok(searchCareers({ query: "mathematics" }).length >= 5, "Major and skill search must work.");
assert.ok(searchCareers({ query: "biology without med school" }).length >= 3, "Intent-like search must ignore connective phrasing and surface biology paths.");
assert.ok(searchCareers({ query: "help people" }).every((career) => career.intensity.people === "High"), "Human-service intent must use structured people-interaction tags.");
assert.ok(searchCareers({ query: "high paying finance" })[0]?.salary.median, "High-paying intent must return salary-ranked finance careers.");
const salarySorted = searchCareers({ sort: "salary" });
assert.ok((salarySorted[0].salary.median ?? 0) >= (salarySorted.at(-1)?.salary.median ?? 0), "Salary sort must be descending.");
assert.ok(searchCareers({ salary: "150k" }).every((career) => (career.salary.median ?? 0) >= 150000), "Salary filters must be exact.");
assert.ok(searchCareers({ hours: "45" }).every((career) => career.hours.maximum <= 45), "Hours filters must be exact.");

const sample = careers.find((career) => career.name === "Software Engineer") ?? careers[0];
const related = relatedOpportunities(sample, opportunities, 6);
assert.ok(related.every((item) => classifyCatalogRecord(item).recommendationSafe), "Career pages must never surface unsafe opportunities.");
const manuallyDeepened = ["Quantitative Trader","Software Engineer","Registered Nurse","Investment Banker","Teacher","Lawyer","Data Scientist","Electrician","Graphic Designer","Research Scientist","Management Consultant","Journalist"];
for (const name of manuallyDeepened) {
  const career = careers.find((item) => item.name === name);
  assert.ok(career && !career.typicalWeek.startsWith("A typical week mixes") && !career.surprises[0].startsWith("Job titles can hide"), `${name} needs career-specific work and surprise analysis.`);
}
for (const name of ["Quantitative Trader","Investment Banker","Sales Representative","Account Executive"]) {
  const career = careers.find((item) => item.name === name)!;
  assert.equal(career.salary.entryRange, undefined, `${name} must not fabricate an early-career range from its occupational median.`);
  assert.match(career.salary.structure, /bonus|commission/i, `${name} must explain variable compensation.`);
}

const start = performance.now();
for (let run = 0; run < 1000; run += 1) searchCareers({ query: run % 2 ? "engineering" : "research", sort: run % 3 ? "outlook" : "salary" });
assert.ok(performance.now() - start < 1000, "One thousand in-memory career searches must complete in under one second.");

for (const file of ["components/career-explorer.tsx", "components/career-detail.tsx", "components/header.tsx", "lib/universal-search.ts"]) {
  const source = readFileSync(file, "utf8");
  assert.ok(source.includes("career") || source.includes("Career"), `${file} must retain Careers integration.`);
}
console.log(`Careers Explorer checks passed: ${careers.length} careers across ${careerCategories.length} categories; ${related.length} safe related opportunities.`);
