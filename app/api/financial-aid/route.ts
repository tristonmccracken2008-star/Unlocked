import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { aidChecklistStatuses, waiverStatuses, type AidOffer } from "@/data/financial-aid";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { updateFinancialAid, type FinancialAidMutation } from "@/lib/financial-aid-service";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const clean = (value: unknown, max = 500) => typeof value === "string" ? value.replace(/\s+/g," ").trim().slice(0,max) : "";
const id = (value: unknown) => { const result = clean(value, 100); return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(result) ? result : ""; };
const integer = (value: unknown, max = 1_000_000) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(0, Math.round(Number(value)))) : -1;
const date = (value: unknown) => { const result = clean(value,10); return /^20\d{2}-\d{2}-\d{2}$/.test(result) ? result : ""; };

function parse(value: unknown): FinancialAidMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid Cost & Aid request.",400,"invalid_request");
  const body=value as Record<string,unknown>, expectedVersion=integer(body.expectedVersion,100_000);
  if (expectedVersion<0) throw new SecurityError("Invalid workspace state.",400,"invalid_request");
  if(body.action==="set_checklist") { const itemId=id(body.itemId); if(!itemId||!aidChecklistStatuses.includes(body.status as never)) throw new SecurityError("Choose a valid checklist status.",400,"invalid_status"); return {action:"set_checklist",expectedVersion,itemId,status:body.status as typeof aidChecklistStatuses[number]}; }
  if(body.action==="save_npc") { const collegeId=id(body.collegeId), calculatedAt=date(body.calculatedAt), amount=integer(body.amount); if(!collegeId||!calculatedAt||amount<0) throw new SecurityError("Enter a valid estimate and calculation date.",400,"invalid_estimate"); return {action:"save_npc",expectedVersion,collegeId,amount,calculatedAt,academicYear:clean(body.academicYear,24)||undefined,privateNote:clean(body.privateNote,1000)||undefined}; }
  if(body.action==="save_offer") {
    const collegeId=id(body.collegeId), academicYear=clean(body.academicYear,24); if(!collegeId||!academicYear) throw new SecurityError("Choose a college and academic year.",400,"invalid_offer");
    const fields=["costOfAttendance","grants","scholarships","workStudy","subsidizedLoans","unsubsidizedLoans","parentLoans","otherFinancing"] as const;
    const amounts=Object.fromEntries(fields.map(key=>[key,integer(body[key])])) as Record<typeof fields[number],number>; if(Object.values(amounts).some(n=>n<0)) throw new SecurityError("Offer amounts must be whole-dollar values.",400,"invalid_offer");
    const renewableGiftAid=["yes","no","mixed","unknown"].includes(String(body.renewableGiftAid)) ? body.renewableGiftAid as AidOffer["renewableGiftAid"] : "unknown";
    return {action:"save_offer",expectedVersion,offer:{collegeId,academicYear,...amounts,renewableGiftAid,conditions:clean(body.conditions,1000)||undefined}};
  }
  if(body.action==="set_workflow") { const collegeId=id(body.collegeId), field=clean(body.field,20) as "fafsa"|"cssProfile"|"idoc"|"waiver"|"aidReview", allowed=[...aidChecklistStatuses,...waiverStatuses,"not_started","preparing","submitted","resolved"]; if(!collegeId||!["fafsa","cssProfile","idoc","waiver","aidReview"].includes(field)||!allowed.includes(body.value as never)) throw new SecurityError("Choose a valid workflow status.",400,"invalid_status"); return {action:"set_workflow",expectedVersion,collegeId,field,value:String(body.value),deadline:date(body.deadline)||undefined}; }
  throw new SecurityError("Unknown Cost & Aid action.",400,"invalid_request");
}

export async function POST(request:Request){
  try { assertSameOrigin(request); const session=await getSession((await cookies()).get(sessionCookieName)?.value); if(!session)return NextResponse.json({error:"Your session ended. Sign in again."},{status:401,headers}); if(session.data.educationalStage!=="high_school")return NextResponse.json({error:"Cost & Aid is available in High School UnlockED."},{status:403,headers}); await enforceRateLimit(request,"financial-aid",120,60,session.user.id); const result=await updateFinancialAid(session.user.id,parse(await readBoundedJson(request,32*1024))); return NextResponse.json({ok:true,store:result.store},{headers}); }
  catch(error){ if(error instanceof Error&&error.name==="FinancialAidConflictError")return NextResponse.json({error:error.message,code:"stale_financial_aid"},{status:409,headers}); return securityErrorResponse(error,"Your Cost & Aid workspace could not be saved."); }
}
