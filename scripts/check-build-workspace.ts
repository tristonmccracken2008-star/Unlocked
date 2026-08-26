import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
Reflect.set(process.env, "NODE_ENV", "test");

const { buildBuildWorkspaceModel } = await import("../lib/build-workspace");
const { defaultBillingRecord } = await import("../lib/billing");
const { opportunities } = await import("../data/opportunities");

const now = "2026-08-26T12:00:00.000Z";
const opportunity =
  opportunities.find((item) =>
    item.metadata.applicationRequirements?.some((requirement) =>
      /resume/i.test(requirement),
    ),
  ) ?? opportunities[0]!;
const tracker = {
  [opportunity.id]: {
    id: opportunity.id,
    status: "Applying" as const,
    savedAt: now,
    updatedAt: now,
    version: 1,
    history: [],
  },
};
const experience = {
  id: "experience:project",
  source: "manual" as const,
  kind: "project" as const,
  organization: "Student Team",
  title: "Project Lead",
  current: false,
  skills: ["TypeScript"],
  facts: [
    {
      id: "fact:action",
      kind: "action" as const,
      text: "Built a scheduling tool",
      confirmed: true,
    },
  ],
  bullets: [
    {
      id: "bullet:project",
      text: "Built a scheduling tool.",
      factIds: ["fact:action"],
      confirmedClaims: [],
      createdAt: now,
      updatedAt: now,
      version: 0,
    },
  ],
  createdAt: now,
  updatedAt: now,
  version: 0,
};
const resume = {
  id: "resume:master",
  materialId: "material:resume",
  title: "Master resume",
  kind: "master" as const,
  target: { type: "general" as const },
  contact: { email: "avery@example.test" },
  sections: [
    {
      id: "section:education",
      kind: "education" as const,
      title: "Education",
      visible: true,
      entries: [],
    },
    {
      id: "section:projects",
      kind: "projects" as const,
      title: "Projects",
      visible: true,
      entries: [
        { experienceId: experience.id, bulletIds: [experience.bullets[0]!.id] },
      ],
    },
  ],
  skills: ["TypeScript"],
  template: "classic" as const,
  createdAt: now,
  updatedAt: now,
  version: 0,
};
const account = {
  profile: {
    firstName: "Avery",
    lastName: "Student",
    schoolSlug: "university-of-chicago",
    schoolName: "University of Chicago",
    major: "Computer Science",
    graduationYear: "2028",
    year: "Junior",
    careerGoal: "Software Engineering",
    interests: "Software",
    onboardingCompletedAt: now,
  },
  onboardingComplete: true,
  firstLaunchComplete: true,
  billing: defaultBillingRecord(),
  activity: {
    viewed: [],
    saved: [opportunity.id],
    claimed: [],
    tracked: tracker,
  },
  savedOpportunities: [],
  tracker,
  preferences: null,
  journeyProgress: {},
  applicationWorkspaces: {},
  advisor: null,
  referrals: null,
  updatedAt: now,
  accomplishments: {
    "accomplishment:research": {
      id: "accomplishment:research",
      source: "manual" as const,
      snapshot: {
        title: "Research Assistant",
        organization: "Campus Lab",
        capturedAt: now,
      },
      kind: "research" as const,
      outcome: "completed" as const,
      outcomeDate: now.slice(0, 10),
      hidden: false,
      createdAt: now,
      updatedAt: now,
      version: 0,
    },
  },
  resumeLab: {
    experiences: { [experience.id]: experience },
    resumes: { [resume.id]: resume },
    version: 1,
    updatedAt: now,
  },
  applicationMaterials: {
    records: {
      [resume.materialId]: {
        id: resume.materialId,
        type: "resume" as const,
        title: resume.title,
        status: "ready" as const,
        contexts: ["general" as const],
        preferred: true,
        createdAt: now,
        updatedAt: now,
        version: 0,
      },
    },
    associations: {},
    version: 1,
    updatedAt: now,
  },
};

const model = buildBuildWorkspaceModel({
  user: { email: "avery@example.test", name: "Avery Student" },
  account,
  opportunities: [opportunity],
});
assert.equal(
  model.mainResume?.id,
  resume.id,
  "Build must select the canonical master resume as the main resume.",
);
assert.equal(
  model.experienceUsage[experience.id],
  1,
  "Experience usage must count references instead of copies.",
);
assert.equal(
  model.resumeLab.sourceAccomplishments.length,
  1,
  "Unreviewed accomplishments must remain an explicit inbox.",
);
assert.equal(
  model.nextAction.kind,
  "review",
  "A factual accomplishment awaiting review should be the next Build action.",
);
assert.equal(
  model.materials.records.filter((item) => item.type === "resume").length,
  1,
  "Resume Lab and Materials must share one resume material.",
);
assert.equal(
  model.resumeLab.profile.school,
  "University of Chicago",
  "Build must reuse profile education.",
);
assert.equal(
  account.billing.tier,
  "free",
  "Core Build projections must remain available on Free.",
);

const newUser = buildBuildWorkspaceModel({
  user: { email: "new@example.test", name: "New Student" },
  account: {
    ...account,
    accomplishments: {},
    resumeLab: undefined,
    applicationMaterials: undefined,
  },
  opportunities: [opportunity],
});
assert.equal(newUser.nextAction.kind, "experience");
assert.match(newUser.nextAction.href, /view=experience/);

const samples: number[] = [];
for (let run = 0; run < 40; run += 1) {
  const started = performance.now();
  buildBuildWorkspaceModel({
    user: { email: "avery@example.test", name: "Avery Student" },
    account,
    opportunities: [opportunity],
  });
  if (run >= 5) samples.push(performance.now() - started);
}
const averageMs =
  samples.reduce((sum, value) => sum + value, 0) / samples.length;
assert.ok(
  averageMs < 20,
  `Build projection must remain under 20ms average; received ${averageMs.toFixed(2)}ms.`,
);

const page = readFileSync("app/build/page.tsx", "utf8");
const header = readFileSync("components/header.tsx", "utf8");
const resumePage = readFileSync("app/resume-lab/page.tsx", "utf8");
assert.match(page, /requireCompletedOnboarding/);
assert.match(header, /\["Build", "\/build"\]/);
assert.match(
  resumePage,
  /startsWith\("\/applications\/"\)/,
  "Application return paths must be allowlisted.",
);
assert.doesNotMatch(page, /KV_REST_API_TOKEN|STRIPE_SECRET|console\.log/);
assert.equal(
  process.env.KV_REST_API_URL,
  undefined,
  "Build checks must not use production storage.",
);

console.log("Build workspace checks passed", {
  canonicalReferences: true,
  accomplishmentInbox: true,
  profilePrefill: true,
  freeCore: true,
  applicationReturnAllowlist: true,
  averageProjectionMs: Number(averageMs.toFixed(2)),
});
