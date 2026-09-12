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
  "decision_pending",
  "accepted",
  "waitlisted",
  "deferred",
  "not_admitted",
  "withdrawn",
  "student_withdrawn_before_decision",
] as const;
export type CollegeDecisionOutcome = (typeof collegeDecisionOutcomes)[number];
export const collegeDecisionLabels: Record<CollegeDecisionOutcome, string> = {
  decision_pending: "Decision Pending",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  deferred: "Deferred",
  not_admitted: "Not Admitted",
  withdrawn: "Withdrawn",
  student_withdrawn_before_decision: "Student Withdrew Before Decision",
};

export const collegeConsiderationStates = ["still_considering", "top_choice", "no_longer_considering", "enrolling"] as const;
export type CollegeConsiderationState = (typeof collegeConsiderationStates)[number];
export const collegeConsiderationLabels: Record<CollegeConsiderationState, string> = { still_considering:"Still considering", top_choice:"Top choice", no_longer_considering:"No longer considering", enrolling:"Enrolling" };
export const collegeVisitTypes = ["not_visiting", "planning_visit", "visited", "virtual_visit", "admitted_student_event"] as const;
export type CollegeVisitType = (typeof collegeVisitTypes)[number];
export const collegeVisitLabels: Record<CollegeVisitType,string> = { not_visiting:"Not visiting", planning_visit:"Planning visit", visited:"Visited", virtual_visit:"Virtual visit", admitted_student_event:"Admitted-student event" };

export const collegePriorityOptions = [
  "Affordability",
  "Math/CS strength",
  "Research opportunities",
  "City environment",
  "Campus community",
  "Academic programs",
  "Distance from home",
  "Internship access",
  "Study abroad",
  "Housing",
  "Class size",
  "Student support",
  "Career outcomes",
] as const;

export type AdmissionDecision = {
  id: string; outcome: CollegeDecisionOutcome; receivedAt: string; entryTerm?: string;
  program?: string; honorsResult?: string; scholarshipNotification?: string;
  aidOfferStatus?: "not_received" | "received" | "incomplete" | "under_review";
  privateNote?: string; recordedAt: string;
};
export type CollegeVisit = { id:string; type:CollegeVisitType; date?:string; event?:string; privateNotes?:string; createdAt:string; updatedAt:string };
export type EnrollmentItem = { status:"not_started"|"planned"|"complete"|"waiver_requested"|"not_applicable"; amount?:number; deadline?:string; sourceUrl?:string; updatedAt:string };
export type DecisionReflection = { mattersMost?:string; concerns?:string; excitement?:string; questions?:string; regretChoosing?:string; regretDeclining?:string; updatedAt:string };
export const applicationMethods=["common_app","coalition_scoir","institutional","questbridge","other"] as const;
export type ApplicationMethod=(typeof applicationMethods)[number];
export const testSubmissionStatuses=["planning_sat","planning_act","self_reported","official_ordered","official_sent","not_submitting","not_required","unknown"] as const;
export type TestSubmissionStatus=(typeof testSubmissionStatuses)[number];
export const portalChecklistKeys=["application","transcript","recommendation","test_scores","financial_aid"] as const;
export type PortalChecklistKey=(typeof portalChecklistKeys)[number];
export const interviewStatuses=["not_offered","offered","optional","required","scheduled","completed","not_available"] as const;
export type InterviewStatus=(typeof interviewStatuses)[number];

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
  studentTargetDate?:string;
  applicationMethod?:ApplicationMethod;
  testingStatus?:TestSubmissionStatus;
  portal?:{ url?:string; emailHint?:string; activated:boolean; lastChecked?:string; checklist:Partial<Record<PortalChecklistKey,CollegeRequirementStatus>>; missingItemNote?:string };
  interview?:{ status:InterviewStatus; date?:string; interviewer?:string; format?:string; notes?:string; whyCollege?:string; academicInterests?:string; activities?:string; questions?:string };
  decision?: {
    outcome: CollegeDecisionOutcome; receivedAt: string; entryTerm?: string; id?:string;
    program?:string; honorsResult?:string; scholarshipNotification?:string;
    aidOfferStatus?:"not_received"|"received"|"incomplete"|"under_review"; privateNote?:string; recordedAt?:string;
  };
  decisionHistory?: AdmissionDecision[];
  considerationStatus?: CollegeConsiderationState;
  visits?: CollegeVisit[];
  reflection?: DecisionReflection;
  enrollment?: { expectedStart?:string; response?:EnrollmentItem; enrollmentDeposit?:EnrollmentItem; housingDeposit?:EnrollmentItem; finalTranscript?:EnrollmentItem };
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
  counselor?: ApplicationCounselorState;
  updatedAt?: string;
};

export const counselorReadinessStatuses = ["not_started", "working", "ready", "needs_review"] as const;
export type CounselorReadinessStatus = (typeof counselorReadinessStatuses)[number];
export const counselorReadinessLabels: Record<CounselorReadinessStatus, string> = {
  not_started: "Not started", working: "Working on it", ready: "Ready", needs_review: "Needs review",
};
export const commonAppSections = ["profile", "family", "education", "testing", "activities", "honors", "writing", "courses_grades", "recommenders", "college_questions"] as const;
export type CommonAppSection = (typeof commonAppSections)[number];
export const commonAppSectionLabels: Record<CommonAppSection, string> = {
  profile:"Profile", family:"Family", education:"Education", testing:"Testing", activities:"Activities", honors:"Honors", writing:"Writing", courses_grades:"Courses & grades", recommenders:"Recommenders", college_questions:"College-specific questions",
};
export const recommenderRoles = ["teacher", "counselor", "other"] as const;
export type RecommenderRole = (typeof recommenderRoles)[number];
export const recommenderStatuses = ["considering", "plan_to_ask", "asked", "accepted", "submitted", "declined", "no_response", "no_longer_needed"] as const;
export type RecommenderStatus = (typeof recommenderStatuses)[number];
export const recommenderStatusLabels: Record<RecommenderStatus,string> = { considering:"Considering", plan_to_ask:"Plan to ask", asked:"Asked", accepted:"Accepted", submitted:"Submitted", declined:"Declined", no_response:"No response", no_longer_needed:"No longer needed" };
export type ApplicationRecommender = { id:string; name:string; role:RecommenderRole; subject?:string; organization?:string; email?:string; relationship?:string; collegeIds:string[]; requestedAt?:string; deadline?:string; followUpAt?:string; status:RecommenderStatus; privateNotes?:string; tailoredNotes?:string; createdAt:string; updatedAt:string; version:number };
export const schoolDocumentTypes = ["initial_transcript", "midyear_report", "school_report", "counselor_recommendation", "optional_report", "school_profile", "other"] as const;
export type SchoolDocumentType = (typeof schoolDocumentTypes)[number];
export const schoolDocumentStatuses = ["need_to_request", "requested", "school_processing", "sent", "received_confirmed", "not_required", "unknown"] as const;
export type SchoolDocumentStatus = (typeof schoolDocumentStatuses)[number];
export const applicationResponsibilities = ["student", "teacher", "counselor", "school", "parent_family", "testing_agency", "other"] as const;
export type ApplicationResponsibility = (typeof applicationResponsibilities)[number];
export type SchoolDocumentRecord = { id:string; type:SchoolDocumentType; title:string; collegeIds:string[]; responsible:ApplicationResponsibility; status:SchoolDocumentStatus; deadline?:string; sourceUrl?:string; provenance:"student_added"|"official_verified"; notes?:string; createdAt:string; updatedAt:string; version:number };
export type SchoolProcessRecord = { id:string; title:string; system?:string; status:CounselorReadinessStatus; internalDeadline?:string; notes?:string; createdAt:string; updatedAt:string; version:number };
export type BragSheetState = { aboutMe?:string; academicInterests?:string; futureGoals?:string; growth?:string; recommenderFocus?:string; selectedExperienceIds:string[]; selectedAccomplishmentIds:string[]; tailoredNotes:Record<string,string>; updatedAt?:string; version:number };
export type ApplicationCounselorState = { commonApp:Partial<Record<CommonAppSection,CounselorReadinessStatus>>; recommenders:ApplicationRecommender[]; schoolDocuments:SchoolDocumentRecord[]; schoolProcesses:SchoolProcessRecord[]; bragSheet:BragSheetState; updatedAt?:string; version:number };

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

export type VerifiedCollegeTestingPolicy = {
  collegeId: string;
  cycle: string;
  status: "required" | "test_optional" | "test_free";
  label: string;
  sourceUrl: string;
  verifiedAt: string;
};

export const verifiedCollegeTestingPolicies: Record<string, VerifiedCollegeTestingPolicy> = {
  "166683": {
    collegeId: "166683",
    cycle: "2026–27",
    status: "required",
    label: "SAT or ACT required",
    sourceUrl: "https://mitadmissions.org/apply/firstyear/tests-scores/",
    verifiedAt: "2026-09-10",
  },
  "170976": {
    collegeId: "170976",
    cycle: "2027 entry",
    status: "test_optional",
    label: "Test optional",
    sourceUrl: "https://admissions.umich.edu/apply/first-year-applicants/requirements-deadlines/application-changes",
    verifiedAt: "2026-09-10",
  },
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
