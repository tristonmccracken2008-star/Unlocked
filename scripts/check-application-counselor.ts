import assert from "node:assert/strict";
import {buildCounselorModel,emptyCounselorState} from "../lib/application-counselor";
import type {CollegeListRecord} from "../data/college-admissions";

const now="2026-09-12T12:00:00.000Z";
const record:CollegeListRecord={collegeId:"144050",savedAt:now,updatedAt:now,version:1,interestState:"planning_to_apply",favorite:true,notes:"",priorities:[],application:{plan:"early_action",status:"preparing",requirements:[{id:"teacher-rec",type:"recommendation",title:"Teacher recommendation",status:"not_started",provenance:"official_verified",sourceUrl:"https://collegeadmissions.uchicago.edu/apply/application/",cycle:"2026–27",verifiedAt:"2026-09-08",createdAt:now,updatedAt:now}],tasks:[],enrollment:{finalTranscript:{status:"planned",updatedAt:now}},version:1,updatedAt:now}};
const counselor=emptyCounselorState();counselor.recommenders.push({id:"rec:1",name:"Ms. Johnson",role:"teacher",collegeIds:[record.collegeId],status:"plan_to_ask",deadline:"2026-11-01",createdAt:now,updatedAt:now,version:0});
const model=buildCounselorModel([record],counselor,[],new Date("2026-09-12T12:00:00Z"));
assert.equal(model.colleges.length,1);
assert.equal(model.colleges[0].usesCommonApp,true);
assert.equal(model.nextAction.title,"Ask Ms. Johnson for a recommendation");
assert.equal(model.upcoming.some((item)=>item.title.includes("Ms. Johnson")),true);
assert.equal(record.application?.enrollment?.finalTranscript?.status,"planned","Final transcript stays on the canonical college enrollment record.");
assert.equal("percentage" in model,false,"The model must not invent readiness scores.");
console.log("Application Counselor checks passed.");
