import assert from "node:assert/strict";
import { emptySatPracticeStore, normalizeSatPracticeStore, satPerformance, satQuestionBank, satTaxonomy, validateSatQuestion, validatedSatQuestions } from "../data/sat-practice";
import { normalizeSatPreparation, satNextAction, validSectionScore } from "../data/sat-command-center";
import { satResources, satTestConfiguration } from "../data/sat-resources";

assert.equal(Object.keys(satTaxonomy.reading_writing.domains).length,4);
assert.equal(Object.keys(satTaxonomy.math.domains).length,4);
assert.ok(validatedSatQuestions.length >= 8,"The launch bank must prove every current domain.");
assert.deepEqual(satQuestionBank.flatMap((question)=>validateSatQuestion(question)),[],"Every authored launch question must pass structural validation.");
assert.ok(satQuestionBank.every((question)=>question.source.type==="unlocked_authored"&&question.source.label.includes("UnlockED")),"Original content must never be labeled official.");
assert.ok(satQuestionBank.some((question)=>question.format==="student_produced_response"));
assert.ok(satQuestionBank.some((question)=>question.passage));
for(const [section,value] of Object.entries(satTaxonomy)) for(const domain of Object.keys(value.domains)) assert.ok(satQuestionBank.some((question)=>question.section===section&&question.domain===domain),`Missing launch coverage for ${domain}`);

const now="2026-09-10T12:00:00.000Z";
const store=normalizeSatPracticeStore({privacy:"public",version:2,sessions:[{id:"session",mode:"quick",timed:false,questionIds:["math-linear-rental"],attempts:[{questionId:"math-linear-rental",questionVersion:1,answer:"A",correct:false,markedForReview:true,attemptedAt:now}],status:"completed",createdAt:now,completedAt:now}]});
assert.equal(store.privacy,"private");
assert.equal(satPerformance(store).mistakes.length,1);
assert.equal(satPerformance(store).marked.length,1);
assert.deepEqual(emptySatPracticeStore().sessions,[]);
assert.deepEqual(normalizeSatPracticeStore({sessions:[{id:"broken",mode:"quick",questionIds:["not-real"],attempts:[],status:"active",createdAt:"bad"}]}).sessions,[]);
assert.equal(satNextAction(emptySatPracticeStore()).kind,"bluebook","A new student should get an official diagnostic next step.");
assert.ok(validSectionScore(800) && !validSectionScore(805));
assert.equal(normalizeSatPreparation({studyTime:"extreme",bluebook:[]}).studyTime,"regular");
assert.equal(satTestConfiguration.readingWriting.questions,54);
assert.equal(satTestConfiguration.math.questions,44);
assert.ok(satResources.some(resource=>resource.id==="bluebook"&&resource.provenance==="College Board"));
assert.ok(satResources.every(resource=>resource.lastVerified&&resource.evidenceUrl&&resource.url));

console.log("Digital SAT Practice taxonomy, content, privacy, history, and validation checks passed.");
