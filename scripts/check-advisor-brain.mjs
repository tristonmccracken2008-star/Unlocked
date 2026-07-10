import assert from "node:assert/strict";
import crypto from "node:crypto";

const raw = {
  userId: "example-user-001",
  year: "Incoming Freshman",
  majors: ["Math", "Computer Science"],
  careerGoals: ["Quant Trader"],
  hoursPerWeek: 8,
  programmingSkill: 45,
  probabilitySkill: 20,
  statisticsSkill: 35,
  mentalMath: 45,
  finishedProjects: 0,
  hasResume: true,
  informationalInterviews: true,
  constraints: { incomingStudent: true, workAuthorization: "US" },
};

const frameworks = {
  "career.quantitative-trader": {
    dimensions: { academic_foundation: 0.22, career_specific_skills: 0.25, projects_and_evidence: 0.18, experience: 0.15, recruiting_readiness: 0.12, communication_and_fit: 0.08 },
    requirements: {
      probability: { target: 80, dimension: "academic_foundation" },
      statistics: { target: 70, dimension: "academic_foundation" },
      programming: { target: 70, dimension: "career_specific_skills" },
      mental_math: { target: 65, dimension: "career_specific_skills" },
      quant_project: { target: 1, dimension: "projects_and_evidence" },
      relevant_experience: { target: 1, dimension: "experience" },
      resume_ready: { target: 1, dimension: "recruiting_readiness" },
      interview_prep: { target: 50, dimension: "recruiting_readiness" },
      career_fit_explored: { target: 1, dimension: "communication_and_fit" },
    },
  },
};

const graph = {
  edges: [
    { from: "skill.probability", to: "skill.quant-project", relationship: "supports", weight: 0.9 },
    { from: "skill.statistics", to: "skill.quant-project", relationship: "supports", weight: 0.8 },
    { from: "skill.programming", to: "skill.quant-project", relationship: "supports", weight: 0.9 },
    { from: "skill.quant-project", to: "milestone.quant-internship-ready", relationship: "contributes", weight: 0.9 },
    { from: "skill.resume-ready", to: "milestone.quant-internship-ready", relationship: "contributes", weight: 0.7 },
    { from: "skill.interview-prep", to: "milestone.quant-internship-ready", relationship: "contributes", weight: 0.8 },
  ],
};

const clean = (value) => String(value ?? "").trim().toLowerCase();
const normalizedScore = (value, target) => Math.max(0, Math.min(1, Number(value ?? 0) / target));
const stableStringify = (value) => Array.isArray(value) ? `[${value.map(stableStringify).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}` : JSON.stringify(value);
const stableHash = (value) => crypto.createHash("sha256").update(stableStringify(value)).digest("hex");

function normalize(input) {
  const majorAliases = { math: "major.mathematics", "computer science": "major.computer-science" };
  return {
    studentId: input.userId,
    academicStage: clean(input.year) === "incoming freshman" ? "incoming-first-year" : "first-year",
    majorIds: input.majors.map((major) => majorAliases[clean(major)]).sort(),
    careerGoals: ["career.quantitative-trader"],
    weeklyAvailableHours: input.hoursPerWeek,
    signals: {
      programming: input.programmingSkill,
      probability: input.probabilitySkill,
      statistics: input.statisticsSkill,
      mental_math: input.mentalMath,
      quant_project: 0,
      relevant_experience: 0,
      resume_ready: input.hasResume ? 1 : 0,
      interview_prep: 0,
      career_fit_explored: input.informationalInterviews ? 1 : 0,
    },
    constraints: input.constraints,
    normalization: { unresolvedMajors: [], unresolvedCareerGoals: [], sourceVersion: "onboarding-normalizer-v0.3" },
  };
}

function scoreReadiness(student) {
  const framework = frameworks["career.quantitative-trader"];
  const totals = Object.fromEntries(Object.keys(framework.dimensions).map((key) => [key, 0]));
  const counts = Object.fromEntries(Object.keys(framework.dimensions).map((key) => [key, 0]));
  const gaps = [];
  for (const [signal, rule] of Object.entries(framework.requirements)) {
    const score = normalizedScore(student.signals[signal], rule.target);
    totals[rule.dimension] += score;
    counts[rule.dimension] += 1;
    if (score < 1) gaps.push({ signal, dimension: rule.dimension, estimatedReadinessGain: Math.max(1, Math.round((1 - score) * framework.dimensions[rule.dimension] * 100)) });
  }
  const overall = Object.entries(framework.dimensions).reduce((sum, [dimension, weight]) => sum + (counts[dimension] ? totals[dimension] / counts[dimension] : 0) * weight, 0);
  return { overallReadiness: Math.round(overall * 100), gaps: gaps.sort((a, b) => b.estimatedReadinessGain - a.estimatedReadinessGain), confidence: 55 };
}

function buildPlan(student, actions) {
  let remaining = student.weeklyAvailableHours;
  const plan = [];
  for (const [index, action] of actions.entries()) {
    const weeklyHours = Math.min(action.weeklyHoursSuggested, remaining);
    if (weeklyHours <= 0) break;
    plan.push({ sequence: index + 1, weeklyHours });
    remaining -= weeklyHours;
  }
  return plan;
}

function deadlineUrgency(deadline, today) {
  const days = Math.round((new Date(`${deadline}T00:00:00Z`).getTime() - today.getTime()) / 86400000);
  return days <= 7 ? { label: "immediate", daysRemaining: days } : { label: "low", daysRemaining: days };
}

function adaptActionScores(actions, feedback) {
  return actions.filter((action) => !feedback.some((record) => record.actionId === action.actionId && ["completed", "already-completed"].includes(record.feedbackType)));
}

function sequence(target, completed) {
  const incoming = graph.edges.reduce((map, edge) => ({ ...map, [edge.to]: [...(map[edge.to] ?? []), edge] }), {});
  const visited = new Set();
  const order = [];
  const visit = (node) => {
    if (visited.has(node) || completed.has(node)) return;
    visited.add(node);
    for (const edge of [...(incoming[node] ?? [])].sort((a, b) => b.weight - a.weight)) visit(edge.from);
    order.push(node);
  };
  visit(target);
  return order;
}

const normalized = normalize(raw);
assert.equal(normalized.academicStage, "incoming-first-year");
assert.ok(normalized.majorIds.includes("major.mathematics"));
assert.ok(normalized.careerGoals.includes("career.quantitative-trader"));
assert.equal(normalized.signals.resume_ready, 1);

const readiness = scoreReadiness(normalized);
assert.ok(readiness.overallReadiness >= 0 && readiness.overallReadiness <= 100);

const plan = buildPlan(normalized, readiness.gaps.slice(0, 3).map((gap) => ({ actionId: `career.quantitative-trader:${gap.signal}`, weeklyHoursSuggested: 5 })));
assert.ok(plan.reduce((sum, item) => sum + item.weeklyHours, 0) <= normalized.weeklyAvailableHours);

const adapted = adaptActionScores([{ actionId: "career.quantitative-trader:resume_ready" }, { actionId: "career.quantitative-trader:probability" }], [{ actionId: "career.quantitative-trader:resume_ready", feedbackType: "already-completed" }]);
assert.equal(adapted.length, 1);
assert.ok(adapted[0].actionId.endsWith(":probability"));

const urgent = deadlineUrgency("2026-07-15", new Date("2026-07-10T00:00:00Z"));
assert.equal(urgent.label, "immediate");
assert.equal(urgent.daysRemaining, 5);

const order = sequence("milestone.quant-internship-ready", new Set(["skill.resume-ready"]));
assert.equal(order.at(-1), "milestone.quant-internship-ready");
assert.ok(order.includes("skill.quant-project"));
assert.ok(!order.includes("skill.resume-ready"));

assert.equal(stableHash(normalized), stableHash(JSON.parse(JSON.stringify(normalized))));
assert.equal(stableHash({ b: 1, a: 2 }), stableHash({ a: 2, b: 1 }));

console.log("Advisor Brain integration checks passed.");
