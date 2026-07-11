import { NextResponse } from "next/server";
import { listPublishedOpportunities } from "@/lib/content-store";

export const dynamic="force-dynamic";
export async function GET(request:Request){try{const opportunities=await listPublishedOpportunities();const ids=new URL(request.url).searchParams.get("ids")?.split(",").map((item)=>item.trim()).filter(Boolean);const result=ids?.length?opportunities.filter((item)=>ids.includes(item.id)):opportunities;return NextResponse.json({opportunities:result},{headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=300"}})}catch(error){console.error("[UnlockED content] public catalog failed",error);return NextResponse.json({error:"Opportunity catalog unavailable"},{status:503})}}
