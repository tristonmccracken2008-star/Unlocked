import type {Metadata} from "next";
import {requireHighSchoolStage} from "@/lib/onboarding";
import {normalizeResumeLabStore} from "@/data/resume-lab";
import {normalizeAccomplishmentStore} from "@/data/accomplishments";
import {normalizeWritingStore} from "@/data/writing";
import {buildCounselorModel,emptyCounselorState} from "@/lib/application-counselor";
import {ApplicationCounselor} from "@/components/application-counselor";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Application Counselor",robots:{index:false,follow:false}};
export default async function ApplicationCounselorPage(){const session=await requireHighSchoolStage();const resume=normalizeResumeLabStore(session.data.resumeLab);const accomplishments=normalizeAccomplishmentStore(session.data.accomplishments);const counselor=session.data.collegeAdmissionsJourney?.counselor??emptyCounselorState();const writing=Object.values(normalizeWritingStore(session.data.writing).documents).map(({id,collegeId,title,status})=>({id,collegeId,title,status}));return <ApplicationCounselor initialCounselor={counselor} initialRecords={session.data.savedColleges??[]} model={buildCounselorModel(session.data.savedColleges??[],counselor,writing)} experiences={Object.values(resume.experiences).map((item)=>({id:item.id,title:item.title||item.organization||"Untitled experience",organization:item.organization,facts:item.facts.filter((fact)=>fact.confirmed).map((fact)=>fact.text)}))} accomplishments={Object.values(accomplishments).filter((item)=>!item.hidden).map((item)=>({id:item.id,title:item.snapshot.title,organization:item.snapshot.organization,outcome:item.outcome,description:item.description}))}/>}
