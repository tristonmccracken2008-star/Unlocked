// Disposable local preview. It never connects to the real account database.
import http from "node:http";
import next from "next";
import { opportunities } from "../data/opportunities";

const values = new Map<string, unknown>();
const kv = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const args = JSON.parse(Buffer.concat(chunks).toString()) as unknown[];
  const [op, key, value] = args;
  let result: unknown = null;
  if (op === "GET") result = values.get(String(key)) ?? null;
  if (op === "SET" && (!args.includes("NX") || !values.has(String(key)))) {
    values.set(String(key), value);
    result = "OK";
  }
  if (op === "DEL") result = Number(values.delete(String(key)));
  if (op === "EVAL") {
    if (String(key).includes("INCR")) result = 1;
    else {
      values.delete(String(args[3]));
      result = 1;
    }
  }
  if (["SMEMBERS", "LRANGE", "ZREVRANGE", "ZRANGEBYSCORE"].includes(String(op)))
    result = [];
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ result }));
});
await new Promise<void>((resolve) => kv.listen(4398, "127.0.0.1", resolve));
process.env.AUTH_SECRET = "local-product-preview-fixture-only-secret";
process.env.KV_REST_API_URL = "http://127.0.0.1:4398";
process.env.KV_REST_API_TOKEN = "local-preview";
process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:4398";
process.env.UPSTASH_REDIS_REST_TOKEN = "local-preview";
process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:4399";
const {
  upsertUser,
  mergeAccountData,
  createSession,
  updateAccountBilling,
  updateEducationalStage,
  updateSavedCollege,
  mutateHighSchoolAcademics,
} = await import("../lib/auth-store");
const { updateCollegeAdmissions } =
  await import("../lib/college-admissions-service");
const { updateHighSchoolActivities } =
  await import("../lib/high-school-activities-service");
const { normalizeResumeLabStore } = await import("../data/resume-lab");
const { readAccountData } = await import("../lib/auth-store");
const user = await upsertUser({
  googleSub: "local-preview",
  email: "preview@example.test",
  name: "Avery Chen",
});
await updateEducationalStage(user.id, "undergraduate");
const now = new Date().toISOString();
const selected = opportunities
  .filter((o) => o.type === "Research" || o.type === "Career")
  .slice(0, 6);
const tracker = Object.fromEntries(
  selected.map((o, i) => [
    o.id,
    {
      id: o.id,
      status: i < 3 ? ("Applying" as const) : ("Saved" as const),
      savedAt: now,
      updatedAt: now,
      version: 0,
      history: [],
    },
  ]),
);
await mergeAccountData(user.id, {
  profile: {
    firstName: "Avery",
    lastName: "Chen",
    schoolSlug: "university-of-chicago",
    schoolName: "University of Chicago",
    major: "Mathematics",
    secondaryMajor: "Computer Science",
    graduationYear: "2030",
    year: "First year",
    careerGoal: "Quantitative research",
    interests: "Statistics, research",
    onboardingCompletedAt: now,
  },
  onboardingComplete: true,
  firstLaunchComplete: true,
  tracker,
  activity: {
    viewed: [],
    saved: selected.map((o) => o.id),
    claimed: [],
    tracked: tracker,
  },
  accomplishments: {
    "manual:project": {
      id: "manual:project",
      source: "manual",
      snapshot: {
        title: "Campus energy research",
        organization: "Student research group",
        capturedAt: now,
      },
      kind: "project",
      outcome: "completed",
      outcomeDate: "2026-08-20",
      skills: ["Python", "Data analysis"],
      description:
        "Analyzed campus energy use and presented findings to a student research group.",
      hidden: false,
      createdAt: now,
      updatedAt: now,
      version: 0,
    },
  },
});
await updateAccountBilling(user.id, { tier: "pro", status: "active" });
const session = await createSession(user);
const newUser = await upsertUser({
  googleSub: "local-stage-preview",
  email: "stage-preview@example.test",
  name: "Jordan Lee",
});
const newUserSession = await createSession(newUser);
const highSchoolUser = await upsertUser({
  googleSub: "local-high-school-preview",
  email: "high-school-preview@example.test",
  name: "Jordan Lee",
});
await mergeAccountData(highSchoolUser.id, {
  profile: {
    firstName: "Jordan",
    lastName: "Lee",
    schoolSlug: "lincoln-high-school",
    schoolName: "Lincoln High School",
    major: "Undecided",
    graduationYear: "2028",
    year: "Junior",
    careerGoal: "Explore colleges",
    interests: "Computer science, economics",
    onboardingCompletedAt: now,
  },
  onboardingComplete: true,
  firstLaunchComplete: true,
  tracker: {
    "high-school--congressional-app-challenge-2026": {
      id: "high-school--congressional-app-challenge-2026",
      status: "Applying",
      savedAt: now,
      updatedAt: now,
      version: 0,
      history: [],
    },
    "high-school--girls-who-code-pathways-2026-27": {
      id: "high-school--girls-who-code-pathways-2026-27",
      status: "Saved",
      savedAt: now,
      updatedAt: now,
      version: 0,
      history: [],
    },
  },
});
await updateEducationalStage(highSchoolUser.id, "high_school");
await mutateHighSchoolAcademics(highSchoolUser.id, {
  expectedVersion: 0,
  mutate: () => ({
    privacy: "private",
    school: { name: "Lincoln High School", source: "student_reported", updatedAt: now },
    graduationYear: "2028",
    gradeLevel: 11,
    gpaStatus: "reported",
    gpas: {
      unweighted: { id: "unweighted", value: 3.82, scale: 4, source: "student_reported", updatedAt: now },
      weighted: { id: "weighted", value: 4.31, scale: 5, source: "school_reported", updatedAt: now },
    },
    classRank: { kind: "school_does_not_rank", source: "student_reported", updatedAt: now },
    courses: Object.fromEntries([
      ["ap-calculus", "AP Calculus BC", "Math", "ap", "A-"],
      ["ap-english", "AP English Language", "English", "ap", "B+"],
      ["physics", "Physics Honors", "Science", "honors", "A"],
      ["spanish", "Spanish III", "World Language", "standard", "A-"],
    ].map(([id, name, subject, level, grade]) => [id, { id, name, subject, gradeLevel: 11, level: level as "ap" | "honors" | "standard", gradeSystem: "letter", grade, inProgress: false, source: "student_reported", createdAt: now, updatedAt: now, version: 0 }])),
    testing: {
      sat: { officialAttempts: [
        { id: "sat-march", testDate: "2026-03-14", total: 1370, readingWriting: 680, math: 690, source: "student_reported", createdAt: now, updatedAt: now, version: 0 },
        { id: "sat-may", testDate: "2026-05-02", total: 1420, readingWriting: 700, math: 720, source: "official_score_report", createdAt: now, updatedAt: now, version: 0 },
      ], practiceAttempts: [], goal: 1500 },
      act: { officialAttempts: [], practiceAttempts: [] },
      plans: [{ test: "sat", date: "2026-10-03", registrationStatus: "registered", preparationDate: "2026-09-18", createdAt: now, updatedAt: now }],
    },
    version: 0,
    updatedAt: now,
  }),
});
for (const activity of [
  {
    key: "newspaper",
    title: "Lincoln Ledger",
    organization: "Lincoln High School",
    role: "Managing Editor",
    category: "Creative work",
    skills: ["Editing", "Interviewing"],
    fact: "Interviewed students and edited weekly campus stories",
    grades: ["10th", "11th"],
  },
  {
    key: "family-care",
    title: "Family caregiving",
    organization: "Home",
    role: "Caregiver",
    category: "Family responsibility",
    skills: ["Organization", "Communication"],
    fact: "Prepared meals and helped a younger sibling with homework",
    grades: ["9th", "10th", "11th"],
  },
  {
    key: "ml-project",
    title: "Transit access mapping project",
    organization: "Independent",
    role: "Project lead",
    category: "Independent project",
    skills: ["Python", "Data analysis"],
    fact: "Mapped public transit access using open city data",
    grades: ["11th"],
  },
]) {
  const activityStore = normalizeResumeLabStore(
    (await readAccountData(highSchoolUser.id)).resumeLab,
  );
  await updateHighSchoolActivities(highSchoolUser.id, {
    action: "save_experience",
    expectedVersion: activityStore.version,
    idempotencyKey: activity.key,
    title: activity.title,
    organization: activity.organization,
    role: activity.role,
    category: activity.category,
    current: true,
    skills: activity.skills,
    facts: [
      { kind: "action", text: activity.fact, confirmed: true, source: "user" },
    ],
    highSchool: {
      category: activity.category,
      grades: activity.grades,
      participationTiming: ["School year"],
      privateNotes: "",
      collaborators: "",
      links: [],
      roleHistory: [
        {
          id: "",
          title: activity.role,
          grades: activity.grades,
          createdAt: "",
        },
      ],
    },
  });
}
await updateSavedCollege(highSchoolUser.id, "144050", true);
await updateSavedCollege(highSchoolUser.id, "170976", true);
await updateSavedCollege(highSchoolUser.id, "147767", true);
await updateCollegeAdmissions(highSchoolUser.id, {
  action: "update_college",
  collegeId: "144050",
  interestState: "planning_to_apply",
  favorite: true,
  plan: "early_action",
  priorities: ["Academic programs", "Research"],
  notes: "Compare the Core and computer science options after the fall visit.",
});
await updateCollegeAdmissions(highSchoolUser.id, {
  action: "add_task",
  collegeId: "144050",
  title: "Draft the UChicago supplement outline",
  dueDate: "2026-09-28",
});
await updateCollegeAdmissions(highSchoolUser.id, {
  action: "update_college",
  collegeId: "170976",
  interestState: "considering",
  priorities: ["Cost", "Student life"],
});
await updateCollegeAdmissions(highSchoolUser.id, {
  action: "update_college",
  collegeId: "147767",
  interestState: "planning_to_apply",
  plan: "regular_decision",
  priorities: ["Location", "Career opportunities"],
});
await updateCollegeAdmissions(highSchoolUser.id, {
  action: "add_task",
  title: "Ask counselor about recommendation timing",
  dueDate: "2026-09-20",
});
await updateAccountBilling(highSchoolUser.id, {
  tier: "pro",
  status: "active",
});
const highSchoolSession = await createSession(highSchoolUser);
const app = next({
  dev: true,
  dir: process.cwd(),
  hostname: "127.0.0.1",
  port: 4399,
});
await app.prepare();
http
  .createServer((req, res) => {
    if (req.url === "/__preview") {
      res.writeHead(302, {
        "Set-Cookie": `unlocked_session=${session.token}; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/opportunities",
      });
      res.end();
      return;
    }
    if (req.url === "/__preview-onboarding") {
      res.writeHead(302, {
        "Set-Cookie": `unlocked_session=${newUserSession.token}; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/onboarding",
      });
      res.end();
      return;
    }
    if (req.url === "/__preview-colleges") {
      res.writeHead(302, {
        "Set-Cookie": `unlocked_session=${highSchoolSession.token}; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/colleges",
      });
      res.end();
      return;
    }
    if (req.url === "/__preview-college-list") {
      res.writeHead(302, {
        "Set-Cookie": `unlocked_session=${highSchoolSession.token}; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/colleges/saved",
      });
      res.end();
      return;
    }
    if (req.url === "/__preview-admissions") {
      res.writeHead(302, {
        "Set-Cookie": `unlocked_session=${highSchoolSession.token}; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/admissions",
      });
      res.end();
      return;
    }
    if (req.url === "/__preview-application") {
      res.writeHead(302, {
        "Set-Cookie": `unlocked_session=${highSchoolSession.token}; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/colleges/university-of-chicago/application",
      });
      res.end();
      return;
    }
    if (req.url === "/__preview-build") {
      res.writeHead(302, {
        "Set-Cookie": `unlocked_session=${highSchoolSession.token}; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/build",
      });
      res.end();
      return;
    }
    if (req.url === "/__preview-application-activities") {
      res.writeHead(302, {
        "Set-Cookie": `unlocked_session=${highSchoolSession.token}; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/build/application-activities",
      });
      res.end();
      return;
    }
    if (req.url === "/__preview-academics") {
      res.writeHead(302, {
        "Set-Cookie": `unlocked_session=${highSchoolSession.token}; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/academics",
      });
      res.end();
      return;
    }
    void app.getRequestHandler()(req, res);
  })
  .listen(4399, "127.0.0.1", () =>
    console.log(
      "Local sample account preview: http://127.0.0.1:4399/__preview",
    ),
  );
