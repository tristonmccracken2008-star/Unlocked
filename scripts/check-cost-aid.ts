import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.AUTH_SECRET ||= "cost-aid-test-secret-with-more-than-thirty-two-bytes";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
Reflect.set(process.env,"NODE_ENV","test");

const { normalizeFinancialAidStore, offerMath } = await import("../data/financial-aid");
const { updateFinancialAid } = await import("../lib/financial-aid-service");
const { publicAccountData } = await import("../lib/public-account");
const { readAccountData, updateEducationalStage, upsertUser } = await import("../lib/auth-store");

const normalized=normalizeFinancialAidStore({checklist:{schools:"ready"},netPriceEstimates:{"144050":{collegeId:"144050",amount:8420,calculatedAt:"2026-09-18",privateNote:"estimate",updatedAt:"bad",version:0}},offers:{},collegeWorkflows:{},version:0});
assert.equal(normalized.netPriceEstimates["144050"].amount,8420);
assert.equal(Object.keys(normalizeFinancialAidStore({...normalized,netPriceEstimates:Object.fromEntries(Array.from({length:140},(_,i)=>[String(i),{...normalized.netPriceEstimates["144050"],collegeId:String(i)}]))}).netPriceEstimates).length,100,"Private records must stay bounded.");

const arithmetic=offerMath({collegeId:"a",academicYear:"2026–27",costOfAttendance:92000,grants:60000,scholarships:22000,workStudy:2500,subsidizedLoans:0,unsubsidizedLoans:0,parentLoans:0,otherFinancing:0,renewableGiftAid:"unknown",updatedAt:"",version:0});
assert.deepEqual(arithmetic,{giftAid:82000,netBeforeBorrowing:10000,studentBorrowing:0,parentBorrowing:0,workStudy:2500,remainingCost:7500});
const loans=offerMath({collegeId:"b",academicYear:"2026–27",costOfAttendance:78000,grants:52000,scholarships:5000,workStudy:0,subsidizedLoans:3500,unsubsidizedLoans:2000,parentLoans:12000,otherFinancing:0,renewableGiftAid:"no",updatedAt:"",version:0});
assert.equal(loans.giftAid,57000,"Loans must never count as gift aid.");
assert.equal(loans.netBeforeBorrowing,21000);
assert.equal(loans.studentBorrowing,5500);

const user=await upsertUser({googleSub:"cost-aid-owner",email:"aid@example.test",name:"Avery Student"});
await updateEducationalStage(user.id,"high_school");
const first=await updateFinancialAid(user.id,{action:"save_npc",expectedVersion:0,collegeId:"144050",amount:8420,calculatedAt:"2026-09-18",academicYear:"2026–27",privateNote:"Family discussion"});
assert.equal(first.store.version,1);
await assert.rejects(updateFinancialAid(user.id,{action:"set_checklist",expectedVersion:0,itemId:"schools",status:"ready"}),/changed elsewhere/i);
const stored=await readAccountData(user.id);
assert.equal(publicAccountData(stored).financialAid,undefined,"Financial records must not enter the general client session.");

const route=readFileSync("app/api/financial-aid/route.ts","utf8"), page=readFileSync("components/cost-aid-workspace.tsx","utf8");
for(const token of ["assertSameOrigin(request)","enforceRateLimit","readBoundedJson","expectedVersion","getSession"])assert.match(route,new RegExp(token.replace(/[()]/g,"\\$&")));
for(const phrase of ["Loans are not discounts","Who’s My FAFSA Parent?","Approval is never automatic","tax returns"])assert.match(page,new RegExp(phrase.replace(/[?]/g,"\\?")));
assert.doesNotMatch(page,/affordability score|aid probability|free money/i);
console.log("Cost & Aid checks passed.");
