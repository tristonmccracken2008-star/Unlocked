export type VerifiedCollegeAid = {
  collegeId: string; aidYear: string; fafsa: "required" | "recommended";
  cssProfile: "required" | "not_required" | "not_verified"; idoc: "required" | "may_be_requested" | "not_verified";
  summary: string; sourceUrl: string; verifiedAt: string; deadline?: { label:string; date:string; sourceUrl:string };
};

export const verifiedCollegeAid: Record<string, VerifiedCollegeAid> = {
  "147767": { collegeId:"147767", aidYear:"2026–27", fafsa:"required", cssProfile:"required", idoc:"required", summary:"Northwestern lists FAFSA, CSS Profile, and tax materials through IDOC for domestic first-year aid applicants.", sourceUrl:"https://undergradaid.northwestern.edu/apply-for-aid/", verifiedAt:"2026-09-12" },
  "214777": { collegeId:"214777", aidYear:"2026–27", fafsa:"required", cssProfile:"not_required", idoc:"not_verified", summary:"Penn State says FAFSA is the only action required for most financial aid; some scholarships use separate applications.", sourceUrl:"https://www.psu.edu/costs-aid/apply-for-aid", verifiedAt:"2026-09-12" },
  "144050": { collegeId:"144050", aidYear:"2026–27", fafsa:"required", cssProfile:"not_verified", idoc:"not_verified", summary:"UChicago’s current aid guidance uses FAFSA and its own Financial Aid Worksheet. Confirm the applicant-specific checklist with UChicago.", sourceUrl:"https://financialaid.uchicago.edu/undergraduate/how-aid-works/", verifiedAt:"2026-09-12" },
};
