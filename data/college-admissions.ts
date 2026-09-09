export const collegeInterestStates = [
  "exploring",
  "considering",
  "planning_to_apply",
  "applied",
  "decision_received",
] as const;
export type CollegeInterestState = (typeof collegeInterestStates)[number];
export const collegeInterestLabels: Record<CollegeInterestState, string> = {
  exploring: "Exploring",
  considering: "Considering",
  planning_to_apply: "Planning to Apply",
  applied: "Applied",
  decision_received: "Decision Received",
};

export const collegeApplicationPlans = [
  "unknown",
  "early_decision",
  "early_action",
  "restrictive_early_action",
  "early_decision_ii",
  "regular_decision",
  "rolling",
  "other",
] as const;
export type CollegeApplicationPlan = (typeof collegeApplicationPlans)[number];
export const collegeApplicationPlanLabels: Record<
  CollegeApplicationPlan,
  string
> = {
  unknown: "Not selected",
  early_decision: "Early Decision",
  early_action: "Early Action",
  restrictive_early_action: "Restrictive Early Action",
  early_decision_ii: "Early Decision II",
  regular_decision: "Regular Decision",
  rolling: "Rolling Admission",
  other: "Other",
};

export const collegeRequirementStatuses = [
  "not_started",
  "in_progress",
  "ready",
  "submitted",
  "not_required",
  "needs_verification",
] as const;
export type CollegeRequirementStatus =
  (typeof collegeRequirementStatuses)[number];
export const collegeRequirementStatusLabels: Record<
  CollegeRequirementStatus,
  string
> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready",
  submitted: "Submitted",
  not_required: "Not required",
  needs_verification: "Needs verification",
};

export const collegeDecisionOutcomes = [
  "accepted",
  "waitlisted",
  "deferred",
  "not_admitted",
  "withdrawn",
] as const;
export type CollegeDecisionOutcome = (typeof collegeDecisionOutcomes)[number];
export const collegeDecisionLabels: Record<CollegeDecisionOutcome, string> = {
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  deferred: "Deferred",
  not_admitted: "Not Admitted",
  withdrawn: "Withdrawn",
};

export const collegePriorityOptions = [
  "Cost",
  "Location",
  "Academic programs",
  "Size",
  "Campus setting",
  "Research",
  "Career opportunities",
  "Distance from home",
  "Student life",
] as const;

export type CollegeAdmissionsTask = {
  id: string;
  collegeId?: string;
  requirementId?: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};
export type CollegeRequirement = {
  id: string;
  type: string;
  title: string;
  status: CollegeRequirementStatus;
  provenance: "official_verified" | "student_added" | "unknown";
  sourceUrl?: string;
  cycle?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};
export type CollegeApplicationRecord = {
  plan: CollegeApplicationPlan;
  status:
    | "planning"
    | "preparing"
    | "ready_to_submit"
    | "applied"
    | "decision_received"
    | "committed";
  requirements: CollegeRequirement[];
  tasks: CollegeAdmissionsTask[];
  submittedAt?: string;
  applicationNotes?: string;
  decision?: {
    outcome: CollegeDecisionOutcome;
    receivedAt: string;
    entryTerm?: string;
  };
  committedAt?: string;
  version: number;
  updatedAt: string;
};
export type CollegeListRecord = {
  collegeId: string;
  savedAt: string;
  updatedAt: string;
  version: number;
  interestState: CollegeInterestState;
  favorite: boolean;
  notes: string;
  priorities: string[];
  application?: CollegeApplicationRecord;
};
export type CollegeAdmissionsJourney = {
  tasks: CollegeAdmissionsTask[];
  updatedAt?: string;
};

export type VerifiedCollegeDeadline = {
  id: string;
  plan: CollegeApplicationPlan | "financial_aid" | "enrollment";
  label: string;
  date: string;
  cycle: string;
  sourceUrl: string;
  verifiedAt: string;
  provenance: "official_verified";
};
export type VerifiedCollegeAdmissions = {
  collegeId: string;
  cycle: string;
  applicationPlatforms?: Array<
    "common_app" | "coalition" | "questbridge" | "institutional"
  >;
  validPlans: CollegeApplicationPlan[];
  applicationUrl: string;
  sourceUrl: string;
  verifiedAt: string;
  deadlines: VerifiedCollegeDeadline[];
  requirements: Array<{
    id: string;
    type: string;
    title: string;
    sourceUrl: string;
  }>;
};

const verifiedAt = "2026-09-08";
export const verifiedCollegeAdmissions: Record<
  string,
  VerifiedCollegeAdmissions
> = {
  "144050": {
    collegeId: "144050",
    cycle: "2026–27",
    applicationPlatforms: ["common_app", "coalition", "questbridge"],
    validPlans: [
      "early_decision",
      "early_action",
      "early_decision_ii",
      "regular_decision",
    ],
    applicationUrl: "https://collegeadmissions.uchicago.edu/apply/application/",
    sourceUrl: "https://collegeadmissions.uchicago.edu/apply/application/",
    verifiedAt,
    deadlines: [
      {
        id: "uchicago-ed1",
        plan: "early_decision",
        label: "Early Decision I application",
        date: "2026-11-02",
        cycle: "2026–27",
        sourceUrl: "https://collegeadmissions.uchicago.edu/apply/application/",
        verifiedAt,
        provenance: "official_verified",
      },
      {
        id: "uchicago-ea",
        plan: "early_action",
        label: "Early Action application",
        date: "2026-11-02",
        cycle: "2026–27",
        sourceUrl: "https://collegeadmissions.uchicago.edu/apply/application/",
        verifiedAt,
        provenance: "official_verified",
      },
      {
        id: "uchicago-ed2",
        plan: "early_decision_ii",
        label: "Early Decision II application",
        date: "2027-01-04",
        cycle: "2026–27",
        sourceUrl: "https://collegeadmissions.uchicago.edu/apply/application/",
        verifiedAt,
        provenance: "official_verified",
      },
      {
        id: "uchicago-rd",
        plan: "regular_decision",
        label: "Regular Decision application",
        date: "2027-01-04",
        cycle: "2026–27",
        sourceUrl: "https://collegeadmissions.uchicago.edu/apply/application/",
        verifiedAt,
        provenance: "official_verified",
      },
    ],
    requirements: [
      {
        id: "application",
        type: "application_platform",
        title: "Application form",
        sourceUrl:
          "https://collegeadmissions.uchicago.edu/apply/application/required-materials/",
      },
      {
        id: "school-report",
        type: "school_report",
        title: "Secondary School Report and transcript",
        sourceUrl:
          "https://collegeadmissions.uchicago.edu/apply/application/required-materials/",
      },
    ],
  },
  "170976": {
    collegeId: "170976",
    cycle: "2026–27",
    applicationPlatforms: ["common_app"],
    validPlans: ["early_decision", "early_action", "regular_decision"],
    applicationUrl:
      "https://admissions.umich.edu/apply/first-year-applicants/requirements-deadlines",
    sourceUrl:
      "https://admissions.umich.edu/apply/first-year-applicants/requirements-deadlines",
    verifiedAt,
    deadlines: [
      {
        id: "umich-ed",
        plan: "early_decision",
        label: "Early Decision application",
        date: "2026-11-01",
        cycle: "2026–27",
        sourceUrl:
          "https://admissions.umich.edu/apply/first-year-applicants/requirements-deadlines",
        verifiedAt,
        provenance: "official_verified",
      },
      {
        id: "umich-ea",
        plan: "early_action",
        label: "Early Action application",
        date: "2026-11-01",
        cycle: "2026–27",
        sourceUrl:
          "https://admissions.umich.edu/apply/first-year-applicants/requirements-deadlines",
        verifiedAt,
        provenance: "official_verified",
      },
      {
        id: "umich-rd",
        plan: "regular_decision",
        label: "Regular Decision application",
        date: "2027-02-01",
        cycle: "2026–27",
        sourceUrl:
          "https://admissions.umich.edu/apply/first-year-applicants/requirements-deadlines",
        verifiedAt,
        provenance: "official_verified",
      },
      {
        id: "umich-aid",
        plan: "financial_aid",
        label: "Financial aid deadline",
        date: "2027-03-01",
        cycle: "2026–27",
        sourceUrl: "https://admissions.umich.edu/costs-aid/financial-aid",
        verifiedAt,
        provenance: "official_verified",
      },
      {
        id: "umich-enroll",
        plan: "enrollment",
        label: "Enrollment deposit deadline",
        date: "2027-05-01",
        cycle: "2026–27",
        sourceUrl:
          "https://admissions.umich.edu/apply/first-year-applicants/first-year-application-plans",
        verifiedAt,
        provenance: "official_verified",
      },
    ],
    requirements: [
      "Completed Common Application",
      "High school transcript",
      "School Report or counselor recommendation",
      "One teacher evaluation",
      "Application fee or fee waiver",
    ].map((title, index) => ({
      id: `umich-${index}`,
      type: "other",
      title,
      sourceUrl:
        "https://admissions.umich.edu/apply/first-year-applicants/requirements-deadlines",
    })),
  },
  "147767": {
    collegeId: "147767",
    cycle: "2026–27",
    applicationPlatforms: ["common_app", "coalition"],
    validPlans: ["early_decision", "regular_decision"],
    applicationUrl:
      "https://admissions.northwestern.edu/apply/application-deadlines.html",
    sourceUrl:
      "https://admissions.northwestern.edu/apply/application-deadlines.html",
    verifiedAt,
    deadlines: [
      {
        id: "northwestern-ed",
        plan: "early_decision",
        label: "Early Decision application",
        date: "2026-11-01",
        cycle: "2026–27",
        sourceUrl:
          "https://admissions.northwestern.edu/apply/application-deadlines.html",
        verifiedAt,
        provenance: "official_verified",
      },
      {
        id: "northwestern-rd",
        plan: "regular_decision",
        label: "Regular Decision application",
        date: "2027-01-04",
        cycle: "2026–27",
        sourceUrl:
          "https://admissions.northwestern.edu/apply/application-deadlines.html",
        verifiedAt,
        provenance: "official_verified",
      },
      {
        id: "northwestern-aid-ed",
        plan: "financial_aid",
        label: "Early Decision financial aid",
        date: "2026-12-01",
        cycle: "2026–27",
        sourceUrl:
          "https://admissions.northwestern.edu/apply/application-deadlines.html",
        verifiedAt,
        provenance: "official_verified",
      },
    ],
    requirements: [],
  },
};

export function verifiedAdmissionsFor(collegeId: string) {
  return verifiedCollegeAdmissions[collegeId] ?? null;
}
