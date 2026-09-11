import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.AUTH_SECRET ||= "writing-test-secret-with-more-than-thirty-two-bytes";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
Reflect.set(process.env, "NODE_ENV", "test");

const { normalizeWritingStore } = await import("../data/writing");
const { writingPrompts } = await import("../data/writing-prompts");
const { updateWriting } = await import("../lib/writing-service");
const { reviewWriting, cuttingSuggestions } = await import("../lib/writing-review");
const { publicAccountData } = await import("../lib/public-account");
const { readAccountData, updateEducationalStage, upsertUser } = await import("../lib/auth-store");

const user = await upsertUser({ googleSub: "writing-owner", email: "writer@example.test", name: "Avery Writer" });
await updateEducationalStage(user.id, "high_school");
const prompt = writingPrompts.find((item) => item.id === "common-app-2026-choice")!;
assert.ok(prompt);

const created = await updateWriting(user.id, { action: "create_document", expectedVersion: 0, idempotencyKey: "writing:test:document", promptId: prompt.id });
const document = Object.values(created.store.documents)[0]!;
assert.equal(document.promptId, prompt.id);
assert.equal(Object.values(created.store.assignments)[0]?.documentId, document.id, "Prompt assignments must point to one canonical document.");

const firstDraft = await updateWriting(user.id, {
  action: "save_document",
  expectedVersion: 1,
  documentId: document.id,
  expectedDocumentVersion: 0,
  title: document.title,
  content: "I taught tennis this summer. This taught me the importance of leadership.",
  status: "drafting",
  planningDate: "2026-10-20",
});
assert.equal(firstDraft.store.documents[document.id]?.versions.length, 0);
const revised = await updateWriting(user.id, {
  action: "save_document",
  expectedVersion: 2,
  documentId: document.id,
  expectedDocumentVersion: 1,
  title: document.title,
  content: "At the far court, Maya gripped the racket with both hands and asked me to show the serve again.",
  status: "revising",
  planningDate: "2026-10-20",
});
assert.equal(revised.store.documents[document.id]?.versions.length, 1, "Changing revision stage must automatically preserve the prior draft.");
assert.match(revised.store.documents[document.id]!.versions[0]!.content, /taught tennis/);

const ideaResult = await updateWriting(user.id, { action: "create_idea", expectedVersion: 3, idempotencyKey: "writing:test:idea", title: "The far court", category: "A memory", notes: "Maya asked to try the serve one more time." });
const idea = Object.values(ideaResult.store.ideas)[0]!;
const attached = await updateWriting(user.id, { action: "attach_idea", expectedVersion: 4, documentId: document.id, expectedDocumentVersion: 2, ideaId: idea.id });
assert.deepEqual(attached.store.documents[document.id]?.ideaIds, [idea.id]);

await assert.rejects(
  updateWriting(user.id, { action: "save_document", expectedVersion: 4, documentId: document.id, expectedDocumentVersion: 2, title: document.title, content: "Stale overwrite", status: "drafting" }),
  /changed elsewhere/i,
  "A stale autosave must never overwrite newer writing.",
);

const stored = await readAccountData(user.id);
assert.equal(publicAccountData(stored).writing, undefined, "Private writing must not appear in general client session data.");
assert.equal(stored.writing?.documents[document.id]?.content, revised.store.documents[document.id]?.content);

const review = reviewWriting("Ever since I was young, this taught me the importance of leadership. Leadership shaped my leadership journey and leadership growth.", prompt);
assert.ok(review.some((item) => item.kind === "voice"), "Voice review should flag generic phrasing without claiming AI authorship.");
assert.ok(review.some((item) => item.kind === "specificity"), "Review should ask for concrete detail.");
assert.ok(review.every((item) => !/score|admission|ivy/i.test(item.message)), "Review must not score or predict admissions impact.");
assert.ok(cuttingSuggestions("In order to move forward, I personally decided to begin.").length >= 2);

const bounded = normalizeWritingStore({
  documents: Object.fromEntries(Array.from({ length: 220 }, (_, index) => {
    const id = "writing-document:load-" + index;
    return [id, { ...document, id, promptId: prompt.id }];
  })),
  ideas: {},
  assignments: {},
  feedback: {},
  version: 1,
});
assert.equal(Object.keys(bounded.documents).length, 200, "Writing normalization must keep account data bounded.");

const route = readFileSync("app/api/writing/route.ts", "utf8");
const authStore = readFileSync("lib/auth-store.ts", "utf8");
for (const token of ["assertSameOrigin(request)", "enforceRateLimit", "readBoundedJson", "expectedVersion", "getSession"]) assert.match(route, new RegExp(token.replace(/[()]/g, "\\$&")));
assert.match(authStore, /withSecurityLock\("writing"/);
assert.doesNotMatch(route, /STRIPE_SECRET|KV_REST_API_TOKEN|console\.log\(.*body/i);

console.log("Writing workspace checks passed.");
