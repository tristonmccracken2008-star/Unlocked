import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profiles = JSON.parse(readFileSync("data/advisor-test-profiles.json", "utf8"));
const snapshots = JSON.parse(readFileSync("data/advisor-review-snapshots.json", "utf8"));
const knowledge = readFileSync("lib/advisor/knowledge.ts", "utf8");

const requiredProfiles = [
  "incoming-math-cs-quant",
  "first-year-cs-no-projects",
  "sophomore-cs-projects-no-internship",
  "junior-cs-interviews",
  "premed-first-year-no-clinical",
  "premed-junior-research-weak-service",
  "finance-investment-banking",
  "marketing-analytics",
  "psychology-clinical",
  "engineering-no-design-portfolio",
  "undecided-first-year",
  "time-constrained-cs",
];

const genericPatterns = [
  /^build a project\.?$/i,
  /^gain experience\.?$/i,
  /^improve your resume\.?$/i,
  /^network more\.?$/i,
  /^learn coding\.?$/i,
  /^do research\.?$/i,
  /\bgeneric\b/i,
  /\blorem ipsum\b/i,
];

const professionalOverreach = [
  { profileId: "psychology-clinical", banned: /\bmedical school\b|\bphysician\b|\bpre-med\b/i },
  { profileId: "undecided-first-year", banned: /\bquantitative trading\b|\bsoftware engineering\b|\bmedical school\b/i },
];

assert.equal(profiles.length, 12, "Advisor quality fixtures must include exactly 12 student profiles.");
assert.deepEqual(profiles.map((profile) => profile.id).sort(), [...requiredProfiles].sort(), "Advisor quality fixtures must cover every required profile.");
assert.deepEqual(snapshots.map((snapshot) => snapshot.profileId).sort(), [...requiredProfiles].sort(), "Advisor review snapshots must cover every required profile.");

for (const profile of profiles) {
  assert.ok(profile.rawProfile.studentId, `${profile.id} is missing a student id.`);
  assert.ok(profile.rawProfile.major || profile.rawProfile.majors?.length, `${profile.id} is missing major evidence.`);
  assert.ok(profile.rawProfile.careerGoal || profile.rawProfile.careerGoals?.length, `${profile.id} is missing career-goal evidence.`);
  assert.ok(Number(profile.rawProfile.hoursPerWeek) >= 0, `${profile.id} is missing weekly availability.`);
  for (const record of profile.completedFeedback ?? []) {
    assert.ok(record.actionId, `${profile.id} has completed feedback without an action id.`);
    assert.match(record.feedbackType, /^(already-completed|completed)$/);
  }
}

for (const snapshot of snapshots) {
  const proseFields = [
    "primaryRecommendation",
    "whyRecommended",
    "whyBeforeAlternatives",
    "evidenceProduced",
    "confidenceExplanation",
    "opportunityRecommendationType",
  ];
  for (const field of proseFields) {
    assert.ok(String(snapshot[field] ?? "").trim().length >= 24, `${snapshot.profileId} has an underspecified ${field}.`);
    for (const pattern of genericPatterns) assert.ok(!pattern.test(String(snapshot[field])), `${snapshot.profileId} has generic ${field}: ${snapshot[field]}`);
  }
  assert.ok(String(snapshot.estimatedEffort ?? "").trim().length >= 8, `${snapshot.profileId} has an underspecified estimatedEffort.`);
  assert.ok(snapshot.prerequisites?.length, `${snapshot.profileId} has no prerequisites.`);
  assert.ok(snapshot.whatItUnlocks?.length, `${snapshot.profileId} has no unlock chain.`);
  assert.ok(snapshot.recommendationChain?.length, `${snapshot.profileId} has no recommendation chain.`);
  assert.ok(snapshot.alternatives?.length >= 3, `${snapshot.profileId} needs at least three real alternatives.`);
  assert.equal(new Set(snapshot.alternatives).size, snapshot.alternatives.length, `${snapshot.profileId} alternatives must be distinct.`);
  if (snapshot.profileId === "time-constrained-cs") {
    assert.match(snapshot.estimatedEffort, /1-2|two hours|2 hours/i, "Time-constrained profile must not receive an oversized recommendation.");
  }
  for (const rule of professionalOverreach.filter((item) => item.profileId === snapshot.profileId)) {
    assert.ok(!rule.banned.test(JSON.stringify(snapshot)), `${snapshot.profileId} contains professional-pathway overreach.`);
  }
}

const requiredKnowledgeSignals = [
  "probability",
  "statistics",
  "programming",
  "data_structures",
  "algorithms",
  "team_project",
  "quant_project",
  "finished_projects",
  "relevant_experience",
  "resume_ready",
  "interview_prep",
  "clinical_exposure",
  "service_experience",
  "research_or_inquiry",
  "application_timeline_ready",
  "career_fit_explored",
  "reflection_quality",
];

for (const signal of requiredKnowledgeSignals) {
  assert.match(knowledge, new RegExp(`\\b${signal}:\\s*coaching\\(`), `Missing curated coaching knowledge for ${signal}.`);
}

for (const field of ["prerequisites", "estimatedTime", "evidenceProduced", "firstStep", "completionChecklist", "supportingKnowledgeSourceIds"]) {
  assert.match(knowledge, new RegExp(`\\b${field}\\b`), `Recommendation coaching must include ${field}.`);
}

assert.match(knowledge, /supportingKnowledgeSourceIds:\s*\[/, "Recommendations must carry supporting knowledge source ids.");
assert.match(knowledge, /timeCommitment:/, "Alternatives must include time commitment.");
assert.match(knowledge, /unlocks:/, "Alternatives must include unlocks.");

console.log("Advisor recommendation quality checks passed.");
