import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

process.env.AUTH_SECRET ||= "resume-lab-test-secret-with-more-than-thirty-two-bytes";
delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
Reflect.set(process.env, "NODE_ENV", "test");

const { normalizeResumeLabStore } = await import("../data/resume-lab");
const { draftBulletFromFacts, bulletAlternatives, extractClaims, factDiscoveryQuestions, resumeStudioState, unsupportedClaims, auditResume, analyzeResumeAlignment } = await import("../lib/resume-intelligence");
const { updateResumeLab } = await import("../lib/resume-lab-service");
const { mergeAccountData, readAccountData, upsertUser } = await import("../lib/auth-store");
const { publicAccountData } = await import("../lib/public-account");
const { opportunities } = await import("../data/opportunities");

assert.equal(process.env.KV_REST_API_URL, undefined, "Resume Lab checks must never use production storage.");
const facts = [{ id: "fact:action", kind: "action" as const, text: "Built a scheduling tool", confirmed: true }, { id: "fact:outcome", kind: "outcome" as const, text: "Used by 24 students", confirmed: true }];
assert.deepEqual(draftBulletFromFacts(facts), { text: "Built a scheduling tool; Used by 24 students.", factIds: ["fact:action", "fact:outcome"] });
assert.ok(bulletAlternatives(facts).length >= 2, "Confirmed facts should produce labeled wording alternatives without changing the evidence.");
assert.ok(factDiscoveryQuestions("research").some((question) => /samples|records|papers/i.test(question)), "Fact discovery should adapt to experience type.");
assert.equal(draftBulletFromFacts([{ ...facts[0], confirmed: false }]), null, "Unconfirmed facts must never generate resume text.");
assert.deepEqual(extractClaims("Supported 20 students and improved attendance by 8%."), ["20 students", "8%"]);
const unsupported = unsupportedClaims({ id: "bullet:1", text: "Built a tool used by 24 students and improved speed by 50%.", factIds: facts.map((item) => item.id), confirmedClaims: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 0 }, facts);
assert.deepEqual(unsupported, ["50%"], "Only claims present in confirmed evidence may pass automatically.");

const user = await upsertUser({ googleSub: "resume-lab-owner", email: "owner@example.test", name: "Avery Student" });
const now = new Date().toISOString();
const opportunity = opportunities.find((item) => item.metadata.skillsGained?.length) ?? opportunities[0]!;
await mergeAccountData(user.id, { profile: { firstName: "Avery", lastName: "Student", schoolSlug: "university-of-chicago", schoolName: "University of Chicago", major: "Computer Science", graduationYear: "2028", year: "Junior", careerGoal: "Software Engineering", interests: "Software", onboardingCompletedAt: now }, onboardingComplete: true, firstLaunchComplete: true, tracker: { [opportunity.id]: { id: opportunity.id, status: "Applying", savedAt: now, updatedAt: now, version: 1, history: [] } }, accomplishments: { "manual:research": { id: "manual:research", source: "manual", snapshot: { title: "Research Assistant", organization: "Campus Lab", capturedAt: now }, kind: "research", outcome: "completed", outcomeDate: now.slice(0, 10), roleTitle: "Research Assistant", description: "Analyzed survey results.", skills: ["Data analysis"], hidden: false, createdAt: now, updatedAt: now, version: 0 } } });

const master = await updateResumeLab(user, { action: "create_resume", expectedVersion: 0, idempotencyKey: "resume:test:master", title: "Master resume", kind: "master", target: { type: "general" } });
assert.equal(master.model.resumes.length, 1); assert.equal(master.model.resumes[0].status, "draft");
const duplicateCreate = await updateResumeLab(user, { action: "create_resume", expectedVersion: 0, idempotencyKey: "resume:test:master", title: "Master resume", kind: "master", target: { type: "general" } });
assert.equal(duplicateCreate.duplicate, true, "Resume creation must be idempotent.");
const experience = await updateResumeLab(user, { action: "save_experience", expectedVersion: 1, idempotencyKey: "resume:test:experience", kind: "project", organization: "Student Team", title: "Project Lead", current: false, skills: ["TypeScript"], facts, bullets: [{ factIds: facts.map((item) => item.id) }] });
assert.equal(experience.model.experiences[0].bullets[0].text, "Built a scheduling tool; Used by 24 students.");
const imported = await updateResumeLab(user, { action: "import_accomplishment", expectedVersion: 2, idempotencyKey: "resume:test:accomplishment", accomplishmentId: "manual:research" });
assert.equal(imported.model.experiences.length, 2); assert.equal(imported.model.experiences.find((item) => item.source === "accomplishment")?.resolved.organization, "Campus Lab");
const resume = imported.model.resumes[0]; const project = imported.model.experiences.find((item) => item.source === "manual")!;
const sections = resume.sections.map((section) => section.kind === "projects" ? { ...section, entries: [{ experienceId: project.id, bulletIds: project.bullets.map((item) => item.id) }] } : section);
const saved = await updateResumeLab(user, { action: "save_resume", expectedVersion: 3, resumeId: resume.id, expectedRecordVersion: resume.version, title: resume.title, contact: { email: "owner@example.test" }, skills: ["TypeScript"], sections, template: "classic", materialStatus: "ready" });
assert.equal(saved.model.resumes[0].status, "ready"); assert.equal(saved.model.resumes[0].audit.issues.some((item) => item.id.startsWith("claim:")), false);
const stored = await readAccountData(user.id); assert.equal(Object.values(stored.applicationMaterials?.records ?? {}).filter((item) => item.type === "resume").length, 1, "Each Resume Lab version must have one canonical Material record.");
assert.equal(publicAccountData(stored).resumeLab, undefined, "Resume Lab drafts must not appear in general client session data.");

const targeted = await updateResumeLab(user, { action: "duplicate_resume", expectedVersion: 4, idempotencyKey: "resume:test:targeted", resumeId: resume.id, title: `${opportunity.organization} resume`, target: { type: "opportunity", id: opportunity.id, label: opportunity.title } });
assert.equal(targeted.model.resumes.length, 2); assert.equal(targeted.model.resumes.find((item) => item.kind === "targeted")?.target.id, opportunity.id);
assert.match(targeted.model.resumes.find((item) => item.kind === "targeted")!.alignment.note, /does not predict selection/i);
assert.equal(stored.billing.tier, "free", "Core Resume Lab data must remain available on Free.");

const normalized = normalizeResumeLabStore({ experiences: Object.fromEntries(Array.from({ length: 520 }, (_, index) => [`experience:${index}`, { ...project, id: `experience:${index}` }])), resumes: {}, version: 1 });
assert.equal(Object.keys(normalized.experiences).length, 500, "Experience normalization must remain bounded.");
const malformed = normalizeResumeLabStore({ experiences: { bad: { id: "other", source: "manual" } }, resumes: {}, version: -5 });
assert.equal(Object.keys(malformed.experiences).length, 0); assert.equal(malformed.version, 0);

const route = readFileSync("app/api/resume-lab/route.ts", "utf8"); const authStore = readFileSync("lib/auth-store.ts", "utf8"); const printPage = readFileSync("app/resume-lab/print/[resumeId]/page.tsx", "utf8");
for (const token of ["assertSameOrigin(request)", "enforceRateLimit", "readBoundedJson", "expectedVersion", "getSession"]) assert.match(route, new RegExp(token.replace(/[()]/g, "\\$&")));
assert.match(authStore, /withSecurityLock\("resume-lab"/); assert.match(printPage, /requireCompletedOnboarding/);
assert.doesNotMatch(route, /STRIPE_SECRET|KV_REST_API_TOKEN|console\.log\(.*body/i);

const audit = auditResume(saved.model.resumes[0], Object.fromEntries(saved.model.experiences.map((item) => [item.id, item]))); assert.equal(audit.issues.some((item) => item.title === "No resume bullets yet"), false);
assert.equal(audit.layout.estimatedPages >= 1, true); assert.equal(Object.keys(audit.counts).length, 6, "Review findings must remain categorical rather than collapsing into a fake score.");
const studio = resumeStudioState(saved.model.resumes[0], Object.fromEntries(saved.model.experiences.map((item) => [item.id, item])), audit); assert.ok(studio.nextAction.label); assert.equal(studio.factsCount, 2);
const alignment = analyzeResumeAlignment(saved.model.resumes[0], Object.fromEntries(saved.model.experiences.map((item) => [item.id, item])), opportunity); assert.equal(typeof alignment.note, "string");
const loadExperiences = Object.fromEntries(Array.from({ length: 300 }, (_, index) => { const experienceId = `experience:load-${index}`; const bulletList = Array.from({ length: 4 }, (__, bulletIndex) => ({ id: `bullet:load-${index}-${bulletIndex}`, text: `Built project ${index} for ${bulletIndex + 5} students.`, factIds: [`fact:load-${index}`], confirmedClaims: [], createdAt: now, updatedAt: now, version: 0 })); return [experienceId, { ...project, id: experienceId, facts: [{ id: `fact:load-${index}`, kind: "action" as const, text: `Built project ${index} for ${5} students`, confirmed: true }], bullets: bulletList }]; }));
const loadResume = { ...saved.model.resumes[0], sections: [{ id: "section:load", kind: "experience" as const, title: "Experience", visible: true, entries: Object.values(loadExperiences).map((item) => ({ experienceId: item.id, bulletIds: item.bullets.map((bullet) => bullet.id) })) }] };
const samples: number[] = []; for (let run = 0; run < 25; run += 1) { const started = performance.now(); auditResume(loadResume, loadExperiences); if (run >= 5) samples.push(performance.now() - started); }
const auditAverageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length; assert.ok(auditAverageMs < 50, `1,200 evidence-backed bullets must audit under 50ms average; received ${auditAverageMs.toFixed(2)}ms.`);
console.log("Resume Lab checks passed", { evidenceLocked: true, unsupportedClaimsDetected: true, idempotent: true, materialsIntegrated: true, privateByDefault: true, accountStoreIsolated: true, bounded: true, largeAuditAverageMs: Number(auditAverageMs.toFixed(2)) });
