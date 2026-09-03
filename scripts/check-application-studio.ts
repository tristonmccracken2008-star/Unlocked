import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

process.env.AUTH_SECRET ||= "application-studio-test-secret-with-more-than-thirty-two-bytes";
Reflect.set(process.env, "NODE_ENV", "test");

const { decomposePrompt, relevantAnswerStories, responseCounts, reviewWrittenResponse } = await import("../lib/application-studio");
const { normalizeAnswerBank, normalizeApplicationWorkspaces } = await import("../lib/application-workspace");
const { publicAccountData } = await import("../lib/public-account");
const { defaultBillingRecord } = await import("../lib/billing");

const now = "2026-09-03T12:00:00.000Z";
const response = (draft: string, wordLimit = 500) => ({ id: "prompt:challenge", prompt: "Tell us about a challenge you faced, how you responded, and what you learned.", source: "student" as const, required: true, wordLimit, draft, status: draft ? "draft" as const : "not_started" as const, revisions: [], createdAt: now, updatedAt: now, version: 0 });

assert.deepEqual(responseCounts("one two\nthree"), { words: 3, characters: 13 });
assert.deepEqual(decomposePrompt(response("").prompt).map((item) => item.label), ["Challenge", "Your response", "Outcome", "What you learned"]);
const missingResponse = reviewWrittenResponse(response("The challenge was an incomplete dataset. I learned to ask better questions."));
assert.ok(missingResponse.components.some((item) => item.label === "Your response" && item.state !== "addressed"), "A challenge response that omits the user's response must be flagged conservatively.");

const unsupported = reviewWrittenResponse(response("I led 20 people through the project and used Kubernetes."), undefined, []);
assert.ok(unsupported.findings.some((item) => item.category === "evidence" && /20 people/i.test(item.detail)), "Unsupported numeric, authority, and technology claims must be flagged.");

const overLimit = reviewWrittenResponse(response(Array.from({ length: 537 }, () => "word").join(" "), 500));
assert.ok(overLimit.findings.some((item) => item.id === "limit:words" && /37 words over/i.test(item.title)), "Verified limits must report exact overage without truncation.");

const story = { id: "story:leadership", title: "Tennis camp instruction", category: "leadership", experienceIds: [], situation: "Tennis camp", action: "Taught new players", result: "Players completed drills", learning: "Adapted explanations", createdAt: now, updatedAt: now, version: 0 };
assert.equal(relevantAnswerStories("Tell us about a time you showed leadership.", [story])[0]?.story.id, story.id, "Relevant stories must be surfaced without copying them automatically.");

const boundedStories = normalizeAnswerBank({ records: Object.fromEntries(Array.from({ length: 520 }, (_, index) => [`story:${index}`, { ...story, id: `story:${index}`, title: `Story ${index}` }])), version: 1 });
assert.equal(Object.keys(boundedStories.records).length, 500);
const workspace = normalizeApplicationWorkspaces({ app: { opportunityId: "app", tasks: {}, writtenResponses: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`prompt:${index}`, { ...response("Draft"), id: `prompt:${index}` }])), recommenders: {}, submissionSnapshots: [], createdAt: now, updatedAt: now, version: 0 } });
assert.equal(Object.keys(workspace.app!.writtenResponses ?? {}).length, 40);
const privateProjection = publicAccountData({ profile: null, onboardingComplete: true, billing: defaultBillingRecord(), activity: null, savedOpportunities: [], tracker: {}, preferences: null, journeyProgress: {}, applicationWorkspaces: workspace, answerBank: boundedStories, advisor: null, referrals: null, updatedAt: now });
assert.equal(privateProjection.answerBank, undefined);
assert.equal(privateProjection.applicationWorkspaces?.app?.writtenResponses, undefined, "Drafts must be absent from the general session payload.");

const largeResponses = Array.from({ length: 1_000 }, (_, index) => response(`Challenge ${index}. I responded by testing the data. The result changed. I learned from the work.`));
const samples: number[] = [];
for (let run = 0; run < 12; run += 1) { const started = performance.now(); for (const item of largeResponses) reviewWrittenResponse(item, undefined, [story]); if (run >= 2) samples.push(performance.now() - started); }
const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
assert.ok(averageMs < 150, `1,000 application prompts must review under 150ms average; received ${averageMs.toFixed(2)}ms.`);

console.log("Application Studio checks passed", { promptDecomposition: true, unsupportedClaims: true, exactLimits: true, answerReuse: true, bounded: true, thousandPromptAverageMs: Number(averageMs.toFixed(2)) });
