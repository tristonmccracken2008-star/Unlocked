import crypto from "node:crypto";
import { verifiedCollegeAdmissions, type ApplicationMethod, type ApplicationRecommender, type BragSheetState, type CollegeAdmissionsJourney, type CollegeAdmissionsTask, type CollegeApplicationPlan, type CollegeConsiderationState, type CollegeDecisionOutcome, type CollegeInterestState, type CollegeListRecord, type CollegeRequirementStatus, type CollegeVisitType, type CommonAppSection, type CounselorReadinessStatus, type EnrollmentItem, type InterviewStatus, type PortalChecklistKey, type SchoolDocumentRecord, type SchoolProcessRecord, type TestSubmissionStatus } from "@/data/college-admissions";
import { mutateCollegeAdmissions } from "./auth-store";
import { getCollege } from "./colleges";

export type CollegeAdmissionsMutation =
  | { action: "update_college"; collegeId: string; interestState?: CollegeInterestState; favorite?: boolean; plan?: CollegeApplicationPlan; notes?: string; priorities?: string[] }
  | { action: "add_task"; collegeId?: string; title: string; dueDate?: string }
  | { action: "set_task"; collegeId?: string; taskId: string; completed: boolean }
  | { action:"set_common_app"; section:CommonAppSection; status:CounselorReadinessStatus }
  | { action:"save_recommender"; recommender:Omit<ApplicationRecommender,"createdAt"|"updatedAt"|"version"> }
  | { action:"delete_recommender"; recommenderId:string }
  | { action:"save_school_document"; document:Omit<SchoolDocumentRecord,"createdAt"|"updatedAt"|"version"> }
  | { action:"delete_school_document"; documentId:string }
  | { action:"save_school_process"; process:Omit<SchoolProcessRecord,"createdAt"|"updatedAt"|"version"> }
  | { action:"delete_school_process"; processId:string }
  | { action:"save_brag_sheet"; bragSheet:Omit<BragSheetState,"updatedAt"|"version"> }
  | { action:"save_application_support"; collegeId:string; studentTargetDate?:string; applicationMethod?:ApplicationMethod; testingStatus?:TestSubmissionStatus; portal?:{url?:string;emailHint?:string;activated:boolean;lastChecked?:string;checklist:Partial<Record<PortalChecklistKey,CollegeRequirementStatus>>;missingItemNote?:string}; interview?:{status:InterviewStatus;date?:string;interviewer?:string;format?:string;notes?:string;whyCollege?:string;academicInterests?:string;activities?:string;questions?:string} }
  | { action: "add_requirement"; collegeId: string; title: string }
  | { action: "set_requirement"; collegeId: string; requirementId: string; status: CollegeRequirementStatus }
  | { action: "mark_applied"; collegeId: string; submittedAt: string; notes?: string }
  | { action: "record_decision"; collegeId: string; outcome: CollegeDecisionOutcome; receivedAt: string; entryTerm?: string; program?:string; honorsResult?:string; scholarshipNotification?:string; aidOfferStatus?:"not_received"|"received"|"incomplete"|"under_review"; privateNote?:string }
  | { action:"set_consideration"; collegeId:string; status:CollegeConsiderationState }
  | { action:"record_visit"; collegeId:string; visitType:CollegeVisitType; date?:string; event?:string; privateNotes?:string }
  | { action:"save_reflection"; collegeId:string; mattersMost?:string; concerns?:string; excitement?:string; questions?:string; regretChoosing?:string; regretDeclining?:string }
  | { action:"save_enrollment_item"; collegeId:string; item:"response"|"enrollmentDeposit"|"housingDeposit"|"finalTranscript"; status:EnrollmentItem["status"]; amount?:number; deadline?:string; sourceUrl?:string; expectedStart?:string }
  | { action: "commit"; collegeId: string; expectedStart?:string };

const now = () => new Date().toISOString();
function application(record: CollegeListRecord) {
  const timestamp = now();
  return record.application ?? { plan: "unknown" as const, status: "planning" as const, requirements: [], tasks: [], version: 0, updatedAt: timestamp };
}
function task(title: string, collegeId?: string, dueDate?: string): CollegeAdmissionsTask { const timestamp = now(); return { id: `admission-task:${crypto.randomUUID()}`, collegeId, title, dueDate, completed: false, createdAt: timestamp, updatedAt: timestamp }; }

export async function updateCollegeAdmissions(userId: string, mutation: CollegeAdmissionsMutation) {
  return await mutateCollegeAdmissions(userId, (records, journey) => {
    if ("collegeId" in mutation && mutation.collegeId && !getCollege(mutation.collegeId)) throw new Error("College not found.");
    if (mutation.action === "add_task" && !mutation.collegeId) return { records, journey: { ...journey, tasks: [...journey.tasks, task(mutation.title, undefined, mutation.dueDate)].slice(-300) } };
    if (mutation.action === "set_task" && !mutation.collegeId) return { records, journey: { ...journey, tasks: journey.tasks.map((item) => item.id === mutation.taskId ? { ...item, completed: mutation.completed, updatedAt: now() } : item) } };
    const counselor = journey.counselor ?? { commonApp:{}, recommenders:[], schoolDocuments:[], schoolProcesses:[], bragSheet:{selectedExperienceIds:[],selectedAccomplishmentIds:[],tailoredNotes:{},version:0}, version:0 };
    if (mutation.action === "set_common_app") return { records, journey:{...journey,counselor:{...counselor,commonApp:{...counselor.commonApp,[mutation.section]:mutation.status},version:counselor.version+1,updatedAt:now()}}};
    if (mutation.action === "save_recommender") { const timestamp=now(); const existing=counselor.recommenders.find((item)=>item.id===mutation.recommender.id); const saved={...mutation.recommender,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp,version:(existing?.version??-1)+1}; return {records,journey:{...journey,counselor:{...counselor,recommenders:[...counselor.recommenders.filter((item)=>item.id!==saved.id),saved].slice(-100),version:counselor.version+1,updatedAt:timestamp}}}; }
    if (mutation.action === "delete_recommender") return {records,journey:{...journey,counselor:{...counselor,recommenders:counselor.recommenders.filter((item)=>item.id!==mutation.recommenderId),version:counselor.version+1,updatedAt:now()}}};
    if (mutation.action === "save_school_document") { const timestamp=now(); const existing=counselor.schoolDocuments.find((item)=>item.id===mutation.document.id); const saved={...mutation.document,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp,version:(existing?.version??-1)+1}; return {records,journey:{...journey,counselor:{...counselor,schoolDocuments:[...counselor.schoolDocuments.filter((item)=>item.id!==saved.id),saved].slice(-200),version:counselor.version+1,updatedAt:timestamp}}}; }
    if (mutation.action === "delete_school_document") return {records,journey:{...journey,counselor:{...counselor,schoolDocuments:counselor.schoolDocuments.filter((item)=>item.id!==mutation.documentId),version:counselor.version+1,updatedAt:now()}}};
    if (mutation.action === "save_school_process") { const timestamp=now(); const existing=counselor.schoolProcesses.find((item)=>item.id===mutation.process.id); const saved={...mutation.process,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp,version:(existing?.version??-1)+1}; return {records,journey:{...journey,counselor:{...counselor,schoolProcesses:[...counselor.schoolProcesses.filter((item)=>item.id!==saved.id),saved].slice(-100),version:counselor.version+1,updatedAt:timestamp}}}; }
    if (mutation.action === "delete_school_process") return {records,journey:{...journey,counselor:{...counselor,schoolProcesses:counselor.schoolProcesses.filter((item)=>item.id!==mutation.processId),version:counselor.version+1,updatedAt:now()}}};
    if (mutation.action === "save_brag_sheet") { const timestamp=now(); return {records,journey:{...journey,counselor:{...counselor,bragSheet:{...mutation.bragSheet,updatedAt:timestamp,version:counselor.bragSheet.version+1},version:counselor.version+1,updatedAt:timestamp}}}; }
    const collegeId = mutation.collegeId!;
    const index = records.findIndex((item) => item.collegeId === collegeId);
    if (index < 0) throw new Error("Save this college before planning an application.");
    const current = records[index];
    let next = current;
    const timestamp = now();
    if (mutation.action === "update_college") {
      const verified = verifiedCollegeAdmissions[collegeId];
      if (mutation.plan && mutation.plan !== "unknown" && verified && !verified.validPlans.includes(mutation.plan)) throw new Error("That application plan is not listed for the verified cycle.");
      const app = application(current);
      const requirements = mutation.plan !== undefined ? [...app.requirements] : app.requirements;
      if (mutation.plan !== undefined) for (const requirement of verified?.requirements ?? []) if (!requirements.some((item) => item.id === requirement.id)) requirements.push({ ...requirement, status: "not_started", provenance: "official_verified", cycle: verified!.cycle, verifiedAt: verified!.verifiedAt, createdAt: timestamp, updatedAt: timestamp });
      const nextApplication = mutation.plan !== undefined ? { ...app, plan: mutation.plan, requirements, status: app.status === "planning" ? "preparing" as const : app.status, version: app.version + 1, updatedAt: timestamp } : current.application;
      next = { ...current, interestState: mutation.interestState ?? current.interestState, favorite: mutation.favorite ?? current.favorite, notes: mutation.notes ?? current.notes, priorities: mutation.priorities?.filter((item,index,items) => item.length<=60&&items.indexOf(item)===index).slice(0, 12) ?? current.priorities, application: nextApplication, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "add_task") {
      const app = application(current); next = { ...current, application: { ...app, tasks: [...app.tasks, task(mutation.title, collegeId, mutation.dueDate)].slice(-200), status: "preparing", version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "set_task") {
      const app = application(current); next = { ...current, application: { ...app, tasks: app.tasks.map((item) => item.id === mutation.taskId ? { ...item, completed: mutation.completed, updatedAt: timestamp } : item), version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "save_application_support") {
      const app=application(current); next={...current,application:{...app,studentTargetDate:mutation.studentTargetDate,applicationMethod:mutation.applicationMethod,testingStatus:mutation.testingStatus,portal:mutation.portal,interview:mutation.interview,version:app.version+1,updatedAt:timestamp},version:current.version+1,updatedAt:timestamp};
    } else if (mutation.action === "add_requirement") {
      const app = application(current); next = { ...current, application: { ...app, requirements: [...app.requirements, { id: `college-requirement:${crypto.randomUUID()}`, type: "other", title: mutation.title, status: "needs_verification", provenance: "student_added", createdAt: timestamp, updatedAt: timestamp }], version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "set_requirement") {
      const app = application(current); next = { ...current, application: { ...app, requirements: app.requirements.map((item) => item.id === mutation.requirementId ? { ...item, status: mutation.status, updatedAt: timestamp } : item), version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "mark_applied") {
      const app = application(current); next = { ...current, interestState: "applied", application: { ...app, status: "applied", submittedAt: mutation.submittedAt, applicationNotes: mutation.notes, version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "record_decision") {
      const app = application(current); const decision = { id:`admission-decision:${crypto.randomUUID()}`, outcome:mutation.outcome, receivedAt:mutation.receivedAt, entryTerm:mutation.entryTerm, program:mutation.program, honorsResult:mutation.honorsResult, scholarshipNotification:mutation.scholarshipNotification, aidOfferStatus:mutation.aidOfferStatus, privateNote:mutation.privateNote, recordedAt:timestamp };
      next = { ...current, interestState: mutation.outcome === "decision_pending" ? "applied" : "decision_received", application: { ...app, status: mutation.outcome === "decision_pending" ? "applied" : "decision_received", decision, decisionHistory:[...(app.decisionHistory??[]),decision].slice(-30), considerationStatus:mutation.outcome==="accepted"?(app.considerationStatus??"still_considering"):app.considerationStatus, version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if(mutation.action === "set_consideration") {
      const app=application(current); if(app.decision?.outcome!=="accepted")throw new Error("Record an acceptance before changing consideration status."); next={...current,application:{...app,considerationStatus:mutation.status,version:app.version+1,updatedAt:timestamp},version:current.version+1,updatedAt:timestamp};
    } else if(mutation.action === "record_visit") {
      const app=application(current); const visit={id:`college-visit:${crypto.randomUUID()}`,type:mutation.visitType,date:mutation.date,event:mutation.event,privateNotes:mutation.privateNotes,createdAt:timestamp,updatedAt:timestamp}; next={...current,application:{...app,visits:[...(app.visits??[]),visit].slice(-30),version:app.version+1,updatedAt:timestamp},version:current.version+1,updatedAt:timestamp};
    } else if(mutation.action === "save_reflection") {
      const app=application(current); next={...current,application:{...app,reflection:{mattersMost:mutation.mattersMost,concerns:mutation.concerns,excitement:mutation.excitement,questions:mutation.questions,regretChoosing:mutation.regretChoosing,regretDeclining:mutation.regretDeclining,updatedAt:timestamp},version:app.version+1,updatedAt:timestamp},version:current.version+1,updatedAt:timestamp};
    } else if(mutation.action === "save_enrollment_item") {
      const app=application(current); const item={status:mutation.status,amount:mutation.amount,deadline:mutation.deadline,sourceUrl:mutation.sourceUrl,updatedAt:timestamp}; next={...current,application:{...app,enrollment:{...app.enrollment,expectedStart:mutation.expectedStart??app.enrollment?.expectedStart,[mutation.item]:item},version:app.version+1,updatedAt:timestamp},version:current.version+1,updatedAt:timestamp};
    } else if (mutation.action === "commit") {
      if (current.application?.decision?.outcome !== "accepted") throw new Error("Record an acceptance before choosing where you are going.");
      records = records.map((item) => item.collegeId!==collegeId&&item.application?.decision?.outcome==="accepted" ? { ...item, application: { ...item.application, status: "decision_received", considerationStatus:"no_longer_considering", committedAt: undefined, updatedAt: timestamp } } : item);
      const app = application(current); next = { ...current, application: { ...app, status: "committed", considerationStatus:"enrolling", enrollment:{...app.enrollment,expectedStart:mutation.expectedStart??app.enrollment?.expectedStart}, committedAt: timestamp, version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    }
    records[index] = next;
    return { records, journey };
  });
}
