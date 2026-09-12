export type VerifiedDecisionGuidance = {
  collegeId:string; outcome:"waitlisted"|"deferred"; cycle:string; verifiedAt:string;
  summary:string; optIn:"required"|"not_required"|"not_verified"; responseDeadline?:string;
  additionalMaterials:"permitted"|"significant_updates_only"|"not_accepted"|"not_verified";
  loci:"permitted"|"not_recommended"|"not_accepted"|"not_verified"; midyearGrades:"required"|"requested"|"not_verified";
  financialAidNote?:string; contactUrl:string; sourceUrl:string;
};

export const verifiedDecisionGuidance:Record<string,VerifiedDecisionGuidance[]>={
  "166027":[{collegeId:"166027",outcome:"deferred",cycle:"Current published policy",verifiedAt:"2026-09-12",summary:"Harvard says deferred applicants usually already have the essential information on file. Updates should be limited to significant developments, and the Midyear School Report is expected by February 1.",optIn:"not_verified",additionalMaterials:"significant_updates_only",loci:"not_recommended",midyearGrades:"required",contactUrl:"https://college.harvard.edu/contact-us",sourceUrl:"https://college.harvard.edu/resources/faq/i-was-deferred-what-can-i-do-improve-my-chances-admission"}],
};

export const visitQuestions=[
  "How easy is it for first-years to join research?", "How difficult is it to enroll in required classes?",
  "What happens if I change majors?", "How does housing work after first year?",
  "What support exists for low-income students?", "What do students actually do on weekends?",
  "How accessible are professors?", "How does recruiting work for internships?",
];
export const currentStudentQuestions=[
  "What surprised you after arriving?", "What do students complain about?", "How difficult is getting classes?",
  "How easy is switching majors?", "What is campus like on weekends?",
  "How helpful has financial aid been when circumstances changed?", "Would you choose the school again?",
];
