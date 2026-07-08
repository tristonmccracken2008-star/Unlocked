import { NextResponse } from "next/server";
import { listPublishedOpportunities } from "@/lib/content-store";

export const dynamic="force-dynamic";
export async function GET(){try{return NextResponse.json({opportunities:await listPublishedOpportunities()},{headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=300"}})}catch(error){console.error("[UnlockED content] public catalog failed",error);return NextResponse.json({error:"Opportunity catalog unavailable"},{status:503})}}
