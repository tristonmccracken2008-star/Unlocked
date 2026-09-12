import type { Metadata } from "next";
import { DecisionSeason, type DecisionSeasonCollege } from "@/components/decision-season";
import { verifiedCollegeAdmissions } from "@/data/college-admissions";
import { verifiedDecisionGuidance } from "@/data/decision-season";
import { normalizeFinancialAidStore, offerMath } from "@/data/financial-aid";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { collegeSizeLabel, getColleges } from "@/lib/colleges";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata:Metadata={title:"Decision Season",description:"Record admissions decisions, compare accepted colleges, and prepare for enrollment.",robots:{index:false,follow:false}};

export default async function DecisionSeasonPage(){
  const session=await requireHighSchoolStage();
  const records=(session.data.savedColleges??[]).filter((record)=>record.application&&["applied","decision_received","committed"].includes(record.application.status));
  const colleges=getColleges(records.map((record)=>record.collegeId));
  const financialAid=normalizeFinancialAidStore(session.data.financialAid);
  const items:DecisionSeasonCollege[]=records.flatMap((record)=>{
    const college=colleges.find((candidate)=>candidate.id===record.collegeId);if(!college)return[];
    const offer=financialAid.offers[college.id];
    const enrollmentDeadline=(verifiedCollegeAdmissions[college.id]?.deadlines??[]).find((deadline)=>deadline.plan==="enrollment");
    return [{college:{id:college.id,slug:college.slug,name:college.name,city:college.city,state:college.state,ownership:college.ownership,setting:college.setting,size:collegeSizeLabel(college),undergraduateEnrollment:college.undergraduateEnrollment,publishedTotalCost:college.publishedTotalCost,averageNetPrice:college.averageNetPrice,programs:college.programs.slice(0,8).map((program)=>program.label)},record,offer:offer?{academicYear:offer.academicYear,renewableGiftAid:offer.renewableGiftAid,conditions:offer.conditions,...offerMath(offer)}:undefined,enrollmentDeadline,guidance:verifiedDecisionGuidance[college.id]??[]}];
  });
  return <DecisionSeason initialItems={items}/>;
}
