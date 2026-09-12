import type { Metadata } from "next";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { getColleges } from "@/lib/colleges";
import { normalizeFinancialAidStore } from "@/data/financial-aid";
import { verifiedCollegeAid } from "@/data/college-financial-aid";
import { CostAidWorkspace } from "@/components/cost-aid-workspace";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata:Metadata={title:"Cost & Aid",description:"Understand college costs, prepare aid forms, and compare financial aid offers.",robots:{index:false,follow:false}};

export default async function CostAidPage(){
  const session=await requireHighSchoolStage();
  const colleges=getColleges((session.data.savedColleges??[]).map(item=>item.collegeId));
  return <CostAidWorkspace initialStore={normalizeFinancialAidStore(session.data.financialAid)} colleges={colleges.map(college=>{const requirements=verifiedCollegeAid[college.id];return {id:college.id,slug:college.slug,name:college.name,state:college.state,ownership:college.ownership,publishedTotalCost:college.publishedTotalCost,averageNetPrice:college.averageNetPrice,priceCalculatorUrl:requirements?.netPriceCalculator.url??college.priceCalculatorUrl,requirements};})}/>;
}
