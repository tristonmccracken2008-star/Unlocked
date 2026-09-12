import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { collegeApplicationPlans, collegeConsiderationStates, collegeDecisionOutcomes, collegeInterestStates, collegeRequirementStatuses, collegeVisitTypes } from "@/data/college-admissions";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { updateCollegeAdmissions, type CollegeAdmissionsMutation } from "@/lib/college-admissions-service";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const date = (value: unknown) => { if (value === undefined || value === null || value === "") return undefined; const result = clean(value, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T12:00:00Z`))) throw new SecurityError("Choose a valid date.", 400, "invalid_date"); return result; };
const amount = (value:unknown) => { if(value===undefined||value===null||value==="")return undefined; const result=Number(value); if(!Number.isFinite(result)||result<0||result>1_000_000)throw new SecurityError("Choose a valid amount.",400,"invalid_amount"); return Math.round(result); };
const httpsUrl=(value:unknown)=>{const result=clean(value,500);if(!result)return undefined;try{const parsed=new URL(result);if(parsed.protocol!=="https:")throw new Error();return parsed.toString();}catch{throw new SecurityError("Use a valid secure source link.",400,"invalid_url");}};
function parse(body: Record<string, unknown>): CollegeAdmissionsMutation {
  const collegeId = clean(body.collegeId, 20) || undefined;
  if (body.action === "update_college" && collegeId) {
    const interestState = body.interestState === undefined ? undefined : collegeInterestStates.includes(body.interestState as never) ? body.interestState as typeof collegeInterestStates[number] : undefined;
    const plan = body.plan === undefined ? undefined : collegeApplicationPlans.includes(body.plan as never) ? body.plan as typeof collegeApplicationPlans[number] : undefined;
    return { action: "update_college", collegeId, interestState, plan, favorite: typeof body.favorite === "boolean" ? body.favorite : undefined, notes: body.notes === undefined ? undefined : clean(body.notes, 4_000), priorities: Array.isArray(body.priorities) ? body.priorities.map((item) => clean(item, 60)).filter(Boolean) : undefined };
  }
  if (body.action === "add_task") { const title = clean(body.title, 160); if (!title) throw new SecurityError("Add a task title.", 400, "invalid_task"); return { action: "add_task", collegeId, title, dueDate: date(body.dueDate) }; }
  if (body.action === "set_task") return { action: "set_task", collegeId, taskId: clean(body.taskId, 100), completed: body.completed === true };
  if (body.action === "add_requirement" && collegeId) { const title = clean(body.title, 160); if (!title) throw new SecurityError("Add a requirement title.", 400, "invalid_requirement"); return { action: "add_requirement", collegeId, title }; }
  if (body.action === "set_requirement" && collegeId && collegeRequirementStatuses.includes(body.status as never)) return { action: "set_requirement", collegeId, requirementId: clean(body.requirementId, 100), status: body.status as typeof collegeRequirementStatuses[number] };
  if (body.action === "mark_applied" && collegeId) { const submittedAt = date(body.submittedAt); if (!submittedAt) throw new SecurityError("Add the submission date.", 400, "invalid_date"); return { action: "mark_applied", collegeId, submittedAt, notes: clean(body.notes, 2_000) || undefined }; }
  if (body.action === "record_decision" && collegeId && collegeDecisionOutcomes.includes(body.outcome as never)) { const receivedAt = date(body.receivedAt); if (!receivedAt) throw new SecurityError("Add the decision date.", 400, "invalid_date"); const aidOfferStatus=["not_received","received","incomplete","under_review"].includes(String(body.aidOfferStatus))?body.aidOfferStatus as "not_received"|"received"|"incomplete"|"under_review":undefined; return { action: "record_decision", collegeId, outcome: body.outcome as typeof collegeDecisionOutcomes[number], receivedAt, entryTerm: clean(body.entryTerm, 80) || undefined, program:clean(body.program,160)||undefined,honorsResult:clean(body.honorsResult,160)||undefined,scholarshipNotification:clean(body.scholarshipNotification,500)||undefined,aidOfferStatus,privateNote:clean(body.privateNote,4000)||undefined }; }
  if(body.action==="set_consideration"&&collegeId&&collegeConsiderationStates.includes(body.status as never))return{action:"set_consideration",collegeId,status:body.status as typeof collegeConsiderationStates[number]};
  if(body.action==="record_visit"&&collegeId&&collegeVisitTypes.includes(body.visitType as never))return{action:"record_visit",collegeId,visitType:body.visitType as typeof collegeVisitTypes[number],date:date(body.date),event:clean(body.event,160)||undefined,privateNotes:clean(body.privateNotes,4000)||undefined};
  if(body.action==="save_reflection"&&collegeId)return{action:"save_reflection",collegeId,mattersMost:clean(body.mattersMost,2000)||undefined,concerns:clean(body.concerns,2000)||undefined,excitement:clean(body.excitement,2000)||undefined,questions:clean(body.questions,2000)||undefined,regretChoosing:clean(body.regretChoosing,2000)||undefined,regretDeclining:clean(body.regretDeclining,2000)||undefined};
  if(body.action==="save_enrollment_item"&&collegeId&&["response","enrollmentDeposit","housingDeposit","finalTranscript"].includes(String(body.item))&&["not_started","planned","complete","waiver_requested","not_applicable"].includes(String(body.status)))return{action:"save_enrollment_item",collegeId,item:body.item as "response"|"enrollmentDeposit"|"housingDeposit"|"finalTranscript",status:body.status as "not_started"|"planned"|"complete"|"waiver_requested"|"not_applicable",amount:amount(body.amount),deadline:date(body.deadline),sourceUrl:httpsUrl(body.sourceUrl),expectedStart:clean(body.expectedStart,80)||undefined};
  if (body.action === "commit" && collegeId) return { action: "commit", collegeId, expectedStart:clean(body.expectedStart,80)||undefined };
  throw new SecurityError("Invalid admissions update.", 400, "invalid_request");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies(); const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (session.data.educationalStage !== "high_school") return NextResponse.json({ error: "Admissions Journey is available in High School UnlockED." }, { status: 403 });
    await enforceRateLimit(request, "college-admissions", 100, 60, session.user.id);
    const mutation = parse(await readBoundedJson<Record<string, unknown>>(request, 12_000));
    const data = await updateCollegeAdmissions(session.user.id, mutation);
    return NextResponse.json({ ok: true, savedColleges: data.savedColleges, journey: data.collegeAdmissionsJourney }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return securityErrorResponse(error, error instanceof Error ? error.message : "Admissions workspace could not be updated."); }
}
