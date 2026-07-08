import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { validateOpportunityInput } from "@/lib/content-validation";
import { deleteManagedOpportunity, getManagedRecord, saveManagedOpportunity, setManagedArchive } from "@/lib/content-store";
import type { Opportunity } from "@/data/opportunities";

export const dynamic="force-dynamic";
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getAdminSession();if(!session)return NextResponse.json({error:"Administrator access required"},{status:403});
  try{
    const id=(await params).id;const current=await getManagedRecord(id);if(!current||current.deleted)return NextResponse.json({error:"Opportunity not found"},{status:404});
    const result=validateOpportunityInput(await request.json());if(!result.data)return NextResponse.json({errors:result.errors},{status:400});const input=result.data;
    const next:Opportunity={...current.opportunity,title:input.title,organization:input.organization,type:input.type,category:input.category,description:input.description,eligibility:input.eligibility,school_scope:input.school_scope,schools:input.schools,tags:input.tags,estimated_value:input.estimated_value,estimated_value_note:input.estimated_value===null?"Unknown — no verified dollar value is documented by the official source.":"Value entered by an authorized UnlockED reviewer.",application_deadline:input.deadline,deadline:input.deadline,official_source:input.official_source_url,official_source_url:input.official_source_url,verification_status:input.verification_status,last_verified:input.last_verified,metadata:{...current.opportunity.metadata,deadlineType:input.deadline?"fixed":"not_announced",claimUrl:input.official_source_url}};
    const previous={title:current.opportunity.title,organization:current.opportunity.organization,type:current.opportunity.type,category:current.opportunity.category,description:current.opportunity.description,eligibility:current.opportunity.eligibility,school_scope:current.opportunity.school_scope,schools:current.opportunity.schools,tags:current.opportunity.tags,estimated_value:current.opportunity.estimated_value,deadline:current.opportunity.deadline,official_source_url:current.opportunity.official_source_url,verification_status:current.opportunity.verification_status,last_verified:current.opportunity.last_verified};
    const changed=(Object.keys(input) as (keyof typeof input)[]).filter((field)=>JSON.stringify(previous[field as keyof typeof previous])!==JSON.stringify(input[field]));
    return NextResponse.json({record:await saveManagedOpportunity(next,session.user.email,changed)});
  }catch(error){console.error("[UnlockED CMS] update failed",error);return NextResponse.json({error:error instanceof Error?error.message:"Unable to update opportunity"},{status:503})}
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const session=await getAdminSession();if(!session)return NextResponse.json({error:"Administrator access required"},{status:403});try{const body=await request.json() as {archived?:boolean};if(typeof body.archived!=="boolean")return NextResponse.json({error:"Archive state is required"},{status:400});return NextResponse.json({record:await setManagedArchive((await params).id,body.archived,session.user.email)})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to archive opportunity"},{status:503})}}
export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){const session=await getAdminSession();if(!session)return NextResponse.json({error:"Administrator access required"},{status:403});try{await deleteManagedOpportunity((await params).id,session.user.email);return NextResponse.json({ok:true})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to delete opportunity"},{status:503})}}
