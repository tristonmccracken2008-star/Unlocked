import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collegeDecisionOutcomes } from "../data/college-admissions";
import { verifiedDecisionGuidance } from "../data/decision-season";

for(const outcome of ["accepted","waitlisted","deferred","not_admitted","withdrawn","decision_pending","student_withdrawn_before_decision"])assert.ok(collegeDecisionOutcomes.includes(outcome as never));
for(const guidance of Object.values(verifiedDecisionGuidance).flat()){
  assert.match(guidance.sourceUrl,/^https:\/\//);
  assert.match(guidance.contactUrl,/^https:\/\//);
  assert.match(guidance.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
}
const component=readFileSync("components/decision-season.tsx","utf8");
for(const phrase of ["Compare without a winner","no current institution-specific policy verified","I’m going here","does not contact any college","Transition to Undergraduate UnlockED"])assert.match(component,new RegExp(phrase.replace(/[’]/g,"[’']"),"i"));
assert.doesNotMatch(component,/fit score|decision score|financial value score|acceptance-rate school/i);
const route=readFileSync("app/api/college-admissions/route.ts","utf8");
for(const token of ["assertSameOrigin(request)","enforceRateLimit","getSession","readBoundedJson"])assert.ok(route.includes(token));
const publicAccount=readFileSync("lib/public-account.ts","utf8");
assert.match(publicAccount,/application: undefined/);
const page=readFileSync("app/admissions/decisions/page.tsx","utf8");
assert.match(page,/\["applied","decision_received","committed"\]/,"Decision Season must select only relevant application records.");
console.log("Decision Season checks passed: states, source gates, privacy, security, and active-cycle loading.");
