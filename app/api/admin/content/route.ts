import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createOpportunity, validateOpportunityInput } from "@/lib/content-validation";
import { listManagedRecords, readContentAuditLog, saveManagedOpportunity } from "@/lib/content-store";

export const dynamic="force-dynamic";
const slug=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);
export async function GET(){const session=await getAdminSession();if(!session)return NextResponse.json({error:"Administrator access required"},{status:403});try{return NextResponse.json({records:await listManagedRecords(),auditLog:await readContentAuditLog()},{headers:{"Cache-Control":"no-store"}})}catch(error){console.error("[UnlockED CMS] list failed",error);return NextResponse.json({error:"Content database unavailable"},{status:503})}}
export async function POST(request:Request){const session=await getAdminSession();if(!session)return NextResponse.json({error:"Administrator access required"},{status:403});try{const result=validateOpportunityInput(await request.json());if(!result.data)return NextResponse.json({errors:result.errors},{status:400});const base=`${result.data.type.toLowerCase()}--${slug(result.data.title)}`;const existing=await listManagedRecords();let id=base,index=2;while(existing.some((item)=>item.opportunity.id===id))id=`${base}-${index++}`;const opportunity=createOpportunity(id,result.data);const record=await saveManagedOpportunity(opportunity,session.user.email,Object.keys(result.data),true);return NextResponse.json({record},{status:201})}catch(error){console.error("[UnlockED CMS] create failed",error);return NextResponse.json({error:error instanceof Error?error.message:"Unable to create opportunity"},{status:503})}}
