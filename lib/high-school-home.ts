import "server-only";

import type { Opportunity } from "@/data/opportunities";
import { collegeApplicationPlanLabels, verifiedCollegeAdmissions } from "@/data/college-admissions";
import { normalizeHighSchoolAcademicStore } from "@/data/high-school-academics";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import { normalizeSatPracticeStore } from "@/data/sat-practice";
import { normalizeSatPreparation, recentSatDomains, satNextAction } from "@/data/sat-command-center";
import { normalizeWritingStore } from "@/data/writing";
import { normalizeFinancialAidStore } from "@/data/financial-aid";
import { getVerifiedCollegeAid } from "@/data/college-financial-aid";
import { writingPromptById } from "@/data/writing-prompts";
import type { AccountData } from "./account-types";
import { buildAdmissionsJourney } from "./admissions-journey";
import { getColleges } from "./colleges";

export type HighSchoolHomeItem = { id:string; label:string; title:string; detail:string; href:string; date?:string; provenance?:"Verified date"|"Your date" };
export type HighSchoolHomeSummary = {
  firstName:string; greeting:string; context:string; empty:boolean;
  next:HighSchoolHomeItem;
  comingUp:HighSchoolHomeItem[];
  continuing:HighSchoolHomeItem[];
  colleges?:{saved:number;planning:number;active:number;attention:Array<{name:string;detail:string;href:string}>};
  sat?:{nextTest?:string;latestBluebook?:number;focus?:string;mistakes:number};
  opportunities?:{active:number;next?:HighSchoolHomeItem};
  build?:{count:number;reason:string;href:string};
  financialAid?:{offers:number;estimates:number;formsToReview:number;href:string};
  decisionSeason?:{accepted:number;waitlisted:number;notAdmitted:number;pending:number;href:string};
};

const dayMs=86_400_000;
const today=(now:Date)=>now.toISOString().slice(0,10);
const daysUntil=(date:string,now:Date)=>Math.ceil((Date.parse(`${date}T12:00:00Z`)-Date.parse(`${today(now)}T12:00:00Z`))/dayMs);

export function buildHighSchoolHomeSummary(input:{data:AccountData;firstName:string;opportunities:Opportunity[];now?:Date}):HighSchoolHomeSummary {
  const {data,firstName,opportunities}=input, now=input.now??new Date(), date=today(now);
  const academics=normalizeHighSchoolAcademicStore(data.highSchoolAcademics);
  const satStore=normalizeSatPracticeStore(data.satPractice), satPrep=normalizeSatPreparation(satStore.preparation);
  const resume=normalizeResumeLabStore(data.resumeLab);
  const writing=normalizeWritingStore(data.writing);
  const financialAid=normalizeFinancialAidStore(data.financialAid);
  const records=data.savedColleges??[], colleges=getColleges(records.map(r=>r.collegeId));
  const admissions=buildAdmissionsJourney(records,data.collegeAdmissionsJourney?.tasks??[],now);
  const nextTest=academics.testing.plans.filter(p=>p.test==="sat"&&p.registrationStatus!=="completed"&&p.date>=date).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const activeOpportunities=opportunities.flatMap(op=>{const tracked=data.tracker?.[op.id];return tracked&&["Interested","Applying","Submitted","Interview","Accepted"].includes(tracked.status)?[{op,tracked}]:[]});
  const verifiedOpportunityDates=activeOpportunities.filter(({op})=>op.application_deadline&&op.application_deadline>=date&&op.metadata.verification?.deadlineVerified===true).map(({op})=>({id:`opportunity:${op.id}`,label:"Opportunity",title:op.title,detail:`${op.organization} · deadline`,date:op.application_deadline!,provenance:"Verified date" as const,href:`/opportunities/${op.id}`}));
  const verifiedCollegeDates=admissions.deadlines.map(d=>({id:`college:${d.id}`,label:"Application",title:d.college.name,detail:`${d.label} · ${d.cycle}`,date:d.date,provenance:"Verified date" as const,href:`/colleges/${d.college.slug}/application`}));
  const verifiedAidDates=colleges.flatMap(college=>(getVerifiedCollegeAid(college.id)?.deadlines??[]).filter(deadline=>deadline.date>=date).map(deadline=>({id:`college-aid:${college.id}:${deadline.id}`,label:"Cost & Aid",title:`${college.name} aid deadline`,detail:`${deadline.label} · ${deadline.cycle}`,date:deadline.date,provenance:"Verified date" as const,href:"/cost-aid#colleges"})));
  const testDates=academics.testing.plans.filter(p=>p.registrationStatus!=="completed"&&p.date>=date).map(p=>({id:`test:${p.test}:${p.date}`,label:p.test.toUpperCase(),title:`${p.test.toUpperCase()} test`,detail:`${p.registrationStatus} · date you added`,date:p.date,provenance:"Your date" as const,href:p.test==="sat"?"/academics/sat":"/academics"}));
  const journeyDates=admissions.openTasks.filter(t=>t.dueDate&&t.dueDate>=date).map(t=>({id:`task:${t.id}`,label:"Journey",title:t.title,detail:"Planning date you added",date:t.dueDate!,provenance:"Your date" as const,href:"/admissions"}));
  const bluebookDates=satPrep.bluebookDate&&satPrep.bluebookDate>=date?[{id:`bluebook:${satPrep.bluebookDate}`,label:"SAT",title:"Bluebook practice test",detail:"Practice date you added",date:satPrep.bluebookDate,provenance:"Your date" as const,href:"/academics/sat"}]:[];
  const writingDates=Object.values(writing.documents).filter(document=>document.status!=="final"&&document.planningDate&&document.planningDate>=date).map(document=>({id:`writing:${document.id}`,label:"Writing",title:document.title,detail:"Personal planning date",date:document.planningDate!,provenance:"Your date" as const,href:`/build/writing/${document.id}`}));
  const aidDates=Object.values(financialAid.collegeWorkflows).filter(item=>item.deadline&&item.deadline>=date).flatMap(item=>{const college=colleges.find(candidate=>candidate.id===item.collegeId);return college?[{id:`aid:${item.collegeId}`,label:"Cost & Aid",title:`${college.name} aid deadline`,detail:"Financial aid date you added",date:item.deadline!,provenance:"Your date" as const,href:"/cost-aid"}]:[]});
  const decisionRecords=records.filter(record=>record.application?.decision&&record.application.decision.outcome!=="decision_pending");
  const enrollmentDates=records.flatMap(record=>{const college=colleges.find(candidate=>candidate.id===record.collegeId);if(!college||record.application?.decision?.outcome!=="accepted")return[];const official=(verifiedCollegeAdmissions[college.id]?.deadlines??[]).filter(deadline=>deadline.plan==="enrollment"&&deadline.date>=date).map(deadline=>({id:`enrollment:${college.id}:${deadline.id}`,label:"Decision Season",title:`${college.name} enrollment response`,detail:`${deadline.label} · ${deadline.cycle}`,date:deadline.date,provenance:"Verified date" as const,href:"/admissions/decisions"}));const personal=Object.entries(record.application.enrollment??{}).flatMap(([key,value])=>key!=="expectedStart"&&value&&typeof value==="object"&&"deadline" in value&&value.deadline&&value.deadline>=date?[{id:`enrollment:${college.id}:${key}`,label:"Decision Season",title:`${college.name} ${key.replace(/([A-Z])/g," $1").toLowerCase()}`,detail:"Enrollment date you added",date:value.deadline,provenance:"Your date" as const,href:"/admissions/decisions"}]:[]);return[...official,...personal]});
  const comingUp=[...verifiedCollegeDates,...verifiedAidDates,...enrollmentDates,...verifiedOpportunityDates,...testDates,...journeyDates,...bluebookDates,...writingDates,...aidDates].sort((a,b)=>a.date.localeCompare(b.date)||Number(a.provenance==="Your date")-Number(b.provenance==="Your date")).slice(0,4);

  const applicationAttention=admissions.items.flatMap(({college,record})=>{const app=record.application;if(!app||["applied","decision_received","committed"].includes(app.status))return[];const missing=app.requirements.filter(r=>!["ready","submitted","not_required"].includes(r.status));const tasks=app.tasks.filter(t=>!t.completed);return [{college,record,missing,tasks}]});
  const acceptedDecisions=decisionRecords.filter(record=>record.application?.decision?.outcome==="accepted");
  const decisionSeasonAction=decisionRecords.length?{id:"decision-season",label:"Decision Season",title:acceptedDecisions.length>=2?"Compare your accepted colleges":"Review your admissions decisions",detail:`${acceptedDecisions.length} accepted · ${decisionRecords.filter(record=>record.application?.decision?.outcome==="waitlisted").length} waitlisted · ${records.filter(record=>!record.application?.decision||record.application.decision.outcome==="decision_pending").length} pending`,href:"/admissions/decisions"}:undefined;
  const deadlineSoon=[...verifiedCollegeDates,...verifiedAidDates,...verifiedOpportunityDates,...enrollmentDates].filter(item=>daysUntil(item.date,now)<=14).sort((a,b)=>a.date.localeCompare(b.date))[0]??decisionSeasonAction;
  const applicationNeed=applicationAttention.sort((a,b)=>(b.missing.length+b.tasks.length)-(a.missing.length+a.tasks.length))[0];
  const satAction=satNextAction(satStore,nextTest?.date,date);
  const satRelevant=Boolean(nextTest||satPrep.bluebook.length||satStore.sessions.length||satPrep.bluebookDate);
  const opportunitySoon=verifiedOpportunityDates.sort((a,b)=>a.date.localeCompare(b.date))[0];
  const journeyTask=admissions.openTasks[0];
  const writingNeed=Object.values(writing.documents).filter(document=>document.status==="drafting"||document.status==="revising").sort((a,b)=>(a.planningDate??"9999").localeCompare(b.planningDate??"9999")||b.updatedAt.localeCompare(a.updatedAt))[0];
  const writingAction=writingNeed?{id:`writing-next:${writingNeed.id}`,label:"Your next step",title:`Continue ${writingNeed.title}`,detail:`${writingNeed.content.trim()?writingNeed.content.trim().split(/\s+/).length:0}${writingPromptById.get(writingNeed.promptId)?.wordLimit?` / ${writingPromptById.get(writingNeed.promptId)!.wordLimit}`:""} words${writingNeed.planningDate?` · your planning date ${writingNeed.planningDate}`:""}`,href:`/build/writing/${writingNeed.id}`}:undefined;
  const aidFormsReviewed=Object.keys(financialAid.checklist).length;
  const aidAction=records.length&&aidFormsReviewed<6?{id:"cost-aid",label:"Your next step",title:"Prepare for FAFSA",detail:`${aidFormsReviewed} of 6 preparation items reviewed · see college-specific requirements`,href:"/cost-aid"}:undefined;
  const next:HighSchoolHomeItem = deadlineSoon ?? (applicationNeed?{id:`application:${applicationNeed.college.id}`,label:"Your next step",title:applicationNeed.college.name,detail:`${collegeApplicationPlanLabels[applicationNeed.record.application!.plan]} · ${applicationNeed.missing.length+applicationNeed.tasks.length} ${applicationNeed.missing.length+applicationNeed.tasks.length===1?'item needs':'items need'} attention`,href:`/colleges/${applicationNeed.college.slug}/application`}:undefined) ?? (writingNeed?.planningDate&&daysUntil(writingNeed.planningDate,now)<=14?writingAction:undefined) ?? aidAction ?? (nextTest&&daysUntil(nextTest.date,now)<=21?{id:`sat-test:${nextTest.date}`,label:"Your next step",title:"Prepare for your SAT",detail:`${nextTest.date} · ${satAction.reason}`,href:"/academics/sat"}:undefined) ?? opportunitySoon ?? (journeyTask?{id:`journey:${journeyTask.id}`,label:"Your next step",title:journeyTask.title,detail:journeyTask.dueDate?`Your planning date · ${journeyTask.dueDate}`:"An unfinished task in your Journey",href:"/admissions"}:undefined) ?? writingAction ?? (satRelevant?{id:"sat",label:"Your next step",title:satAction.title,detail:satAction.reason,href:"/academics/sat"}:undefined) ?? (activeOpportunities.length?{id:"opportunities",label:"Your next step",title:"Continue an opportunity",detail:`${activeOpportunities.length} active ${activeOpportunities.length===1?'pursuit':'pursuits'} in your Journey`,href:"/advisor"}:undefined) ?? (records.length?{id:"colleges",label:"Your next step",title:"Review your college list",detail:`You have ${records.length} saved ${records.length===1?'college':'colleges'}. Choose one question to answer next.`,href:"/colleges/saved"}:{id:"explore",label:"Your next step",title:"Start somewhere useful",detail:"Explore a college, find an opportunity, or set up your academics.",href:"/colleges"});

  const continuing:HighSchoolHomeItem[]=[];
  if(writingNeed)continuing.push({id:"continue-writing",label:"Writing",title:writingNeed.title,detail:`${writingNeed.content.trim()?writingNeed.content.trim().split(/\s+/).length:0}${writingPromptById.get(writingNeed.promptId)?.wordLimit?` / ${writingPromptById.get(writingNeed.promptId)!.wordLimit}`:""} words · ${writingNeed.status}`,href:`/build/writing/${writingNeed.id}`});
  const latestSat=[...satStore.sessions].filter(s=>s.status==="active"||s.attempts.length).sort((a,b)=>(b.completedAt??b.createdAt).localeCompare(a.completedAt??a.createdAt))[0];
  if(latestSat)continuing.push({id:"continue-sat",label:"SAT practice",title:latestSat.status==="active"?"Continue your practice set":"Return to SAT practice",detail:latestSat.status==="active"?`${Math.max(0,latestSat.questionIds.length-latestSat.attempts.length)} questions remain`:`${satStore.sessions.flatMap(s=>s.attempts).filter(a=>!a.correct&&!a.reviewedAt).length} mistakes waiting for review`,href:"/academics/sat"});
  const latestCollege=records.filter(r=>r.application&&!["decision_received","committed"].includes(r.application.status)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  if(latestCollege){const college=colleges.find(c=>c.id===latestCollege.collegeId);if(college)continuing.push({id:"continue-college",label:"Application",title:college.name,detail:`Last updated ${latestCollege.updatedAt.slice(0,10)}`,href:`/colleges/${college.slug}/application`});}
  const latestExperience=Object.values(resume.experiences).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  if(latestExperience)continuing.push({id:"continue-build",label:"Experience bank",title:latestExperience.title||latestExperience.organization||"Continue your experience",detail:latestExperience.bullets.length?`${latestExperience.bullets.length} accomplishment ${latestExperience.bullets.length===1?'statement':'statements'}`:"No accomplishment statements recorded yet",href:`/build/experiences/${latestExperience.id}`});

  const latestBluebook=[...satPrep.bluebook].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const focus=recentSatDomains(satStore).filter(d=>d.recent>=4).sort((a,b)=>b.recent-a.recent||b.last!.localeCompare(a.last!))[0]?.label;
  const grade=academics.gradeLevel;
  const context=grade?`${grade}th grade · ${nextTest?`Your next ${nextTest.test.toUpperCase()} is ${nextTest.date}.`:applicationAttention.length?"Your active applications need a clear next step.":"Your plans and recent work are connected here."}`:"Your plans, deadlines, and recent work are connected here.";
  const hour=Number(new Intl.DateTimeFormat("en-US",{hour:"numeric",hourCycle:"h23",timeZone:data.preferences?.notifications?.timezone||"America/New_York"}).format(now));
  return {
    firstName,greeting:hour<12?"Good morning":hour<18?"Good afternoon":"Good evening",context,
    empty:!records.length&&!activeOpportunities.length&&!satRelevant&&!admissions.openTasks.length&&!Object.keys(resume.experiences).length&&!Object.keys(academics.courses).length&&!Object.keys(writing.documents).length&&!Object.keys(writing.ideas).length,
    next,comingUp,continuing:continuing.slice(0,3),
    colleges:records.length?{saved:records.length,planning:records.filter(r=>r.interestState==="planning_to_apply").length,active:applicationAttention.length,attention:applicationAttention.slice(0,3).map(({college,missing,tasks})=>({name:college.name,detail:`${missing.length+tasks.length} ${missing.length+tasks.length===1?'item':'items'} need attention`,href:`/colleges/${college.slug}/application`}))}:undefined,
    sat:satRelevant?{nextTest:nextTest?.date,latestBluebook:latestBluebook?.total,focus,mistakes:satStore.sessions.flatMap(s=>s.attempts).filter(a=>!a.correct&&!a.reviewedAt).length}:undefined,
    opportunities:activeOpportunities.length?{active:activeOpportunities.length,next:opportunitySoon}:undefined,
    build:latestExperience&&latestExperience.bullets.length===0?{count:Object.keys(resume.experiences).length,reason:"Your most recent experience has no accomplishment statements yet.",href:`/build/experiences/${latestExperience.id}`}:undefined,
    financialAid:records.length?{offers:Object.keys(financialAid.offers).length,estimates:Object.keys(financialAid.netPriceEstimates).length,formsToReview:Math.max(0,6-aidFormsReviewed),href:"/cost-aid"}:undefined,
    decisionSeason:decisionRecords.length?{accepted:acceptedDecisions.length,waitlisted:decisionRecords.filter(record=>record.application?.decision?.outcome==="waitlisted").length,notAdmitted:decisionRecords.filter(record=>record.application?.decision?.outcome==="not_admitted").length,pending:records.filter(record=>!record.application?.decision||record.application.decision.outcome==="decision_pending").length,href:"/admissions/decisions"}:undefined,
  };
}
