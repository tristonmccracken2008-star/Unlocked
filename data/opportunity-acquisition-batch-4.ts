import type { Opportunity } from "./opportunities";
import type { OpportunityAcquisitionCandidate } from "./opportunity-acquisition";
import {
  acquisitionSource,
  buildAcquisitionRecord,
  type OpportunityAcquisitionRecordSpec,
} from "./opportunity-acquisition-batch";

const context = { batchId: "targeted-coverage-gaps-2026-08-wave-4", verifiedAt: "2026-08-20" };
const undergraduateYears = ["First year", "Second year", "Third year", "Fourth year"];
const policyMajors = [
  "Political Science", "Public Policy", "International Relations", "Economics", "History",
  "Sociology", "Communication", "Journalism", "Environmental Science", "Education",
];
const environmentalPolicyMajors = [
  "Political Science", "Public Policy", "International Relations", "Environmental Science",
  "Ecology", "Urban Studies", "Sociology", "Communication", "Journalism",
];
const financeMajors = ["Accounting", "Finance", "Taxation", "Economics"];
const supports = [
  "academic_level", "institution_type", "enrollment_status", "school_restriction",
  "external_student_eligibility", "class_year", "major", "citizenship", "residency",
  "gpa", "age", "financial_need", "invitation", "application_status", "deadline",
] as const;
const source = (url: string, fields: Parameters<typeof acquisitionSource>[1], note: string, cycle: string) => acquisitionSource(url, fields, note, context, cycle);
const record = (spec: OpportunityAcquisitionRecordSpec) => buildAcquisitionRecord(spec, context);

const acceptedRecords = [
  record({
    id: "scholarship--aina-foundation-2026", aliases: ["AINA Scholarship", "AI Native Accounting Scholarship"],
    title: "AINA Foundation Scholarship", type: "Scholarship", category: "Business Scholarships",
    description: "Two $5,000 scholarships for accounting, finance, taxation, and closely related undergraduates who submit a practical AI-enabled accounting or finance project.",
    organization: "AINA Foundation", majors: financeMajors, years: undergraduateYears,
    eligibility: "U.S.-based undergraduate students enrolled at an accredited U.S. college or university for the 2026-27 academic year in accounting, finance, taxation, or a closely related field. Applicants must submit a working AI use-case project, a short written explanation, and a structured video response. UnlockED conservatively limits recommendations to students with proven U.S. citizenship.",
    estimatedValue: 5000, valueNote: "$5,000 for education-related expenses, plus six months of mentorship and professional introductions.",
    deadline: "2026-09-15", deadlineType: "fixed", cycle: "2026-27", lifecycleState: "open",
    location: "United States", remote: true, paid: true,
    tags: ["Scholarship", "Accounting", "Finance", "Economics", "AI", "Project-Based"],
    source: "https://ainativeaccounting.org/aina-scholarship-program/",
    sourceReferences: [
      source("https://ainativeaccounting.org/aina-scholarship-program/", [...supports], "The official 2026-27 page confirms the September 15 deadline, two $5,000 awards, U.S. accredited-college enrollment, eligible fields, project requirement, video response, and application process.", "2026-27"),
    ],
    rules: {
      educationLevels: ["undergraduate", "community_college"],
      canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"], acceptsExternalStudents: true,
      classYears: undergraduateYears, majors: financeMajors, citizenshipStatuses: ["us_citizen"],
      transferEligibility: "general_undergraduate", availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: ["Ranking is narrower than the official U.S.-enrollment language so ambiguous citizenship cases remain fail-closed."],
    },
    reviewerNotes: "The provider is newer than long-established scholarship foundations. Its current official page clearly states the award, application, deadline, and eligibility, so the record is recommendation-safe but not assigned Very High prestige.",
    difficulty: "Competitive", prestige: "High",
    applicationRequirements: ["Applicant profile", "Working AI use-case project", "Project write-up of up to 500 words", "Three- to four-minute video response"],
    skillsGained: ["Applied AI", "Accounting Technology", "Financial Analysis", "Communication"],
    careerPaths: ["Accounting", "Finance", "Taxation", "Financial Technology"],
    expectedROI: "$5,000 plus mentorship for a focused, project-based application that can also produce portfolio evidence.",
    recommendedMajors: financeMajors, recommendedClassYears: undergraduateYears,
    estimatedApplicationTime: "1-2 weeks", recurrence: "annual", nextReviewAt: "2026-09-16",
  }),
  record({
    id: "career--white-house-ostp-policy-internship", aliases: ["OSTP Internship", "White House OSTP Policy Internship"],
    title: "White House OSTP Policy Internship", type: "Career", category: "Public Policy",
    description: "A spring internship supporting research, writing, outreach, communications, and national science and technology policy work in the White House Office of Science and Technology Policy.",
    organization: "White House Office of Science and Technology Policy", majors: policyMajors, years: undergraduateYears,
    eligibility: "U.S. citizens enrolled at least half-time in an accredited college or university during the internship term. Policy internships are open to students from all majors; applicants should demonstrate research, writing, organization, communication, and public-service interest.",
    estimatedValue: null, valueNote: "Unknown - the official program page does not publish compensation.",
    deadline: "2026-09-20", deadlineType: "fixed", cycle: "spring-2027", lifecycleState: "open",
    location: "Washington, DC", remote: null, paid: null,
    tags: ["Internship", "Public Policy", "Science Policy", "Government", "Writing", "First-Year Friendly"],
    source: "https://www.whitehouse.gov/ostp/internships/",
    sourceReferences: [
      source("https://www.whitehouse.gov/ostp/internships/", [...supports], "The official OSTP page confirms the Spring 2027 deadline, U.S.-citizen requirement, at-least-half-time enrollment, accredited-institution rule, all-major policy access, and application contacts.", "spring-2027"),
      source("https://www.whitehouse.gov/wp-content/uploads/2025/04/OSTP-Intern-Guidance-1.pdf", ["academic_level", "enrollment_status", "citizenship", "application_status", "deadline"], "The official guidance confirms the same citizenship and enrollment rules and documents required application materials.", "spring-2027"),
    ],
    rules: {
      educationLevels: ["undergraduate", "community_college"],
      canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"], acceptsExternalStudents: true,
      classYears: undergraduateYears, majors: policyMajors, citizenshipStatuses: ["us_citizen"],
      transferEligibility: "general_undergraduate", availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: ["Official eligibility explicitly includes students from all majors and accredited colleges or universities."],
    },
    reviewerNotes: "The policy record excludes the law-only internship path. The official 30-hour availability language is a preference, not a mandatory eligibility rule.",
    difficulty: "Highly Competitive", prestige: "Very High",
    applicationRequirements: ["Cover letter", "Resume", "Writing sample", "Transcript", "Three references", "Email application as one PDF"],
    skillsGained: ["Policy Research", "Writing", "Public Communication", "Stakeholder Outreach"],
    careerPaths: ["Public Policy", "Government", "Science Policy", "Communications"],
    expectedROI: "Direct federal policy experience and writing evidence in a nationally significant science and technology policy office.",
    recommendedMajors: policyMajors, recommendedClassYears: undergraduateYears,
    estimatedApplicationTime: "3-5 hours", duration: "Spring semester", recurrence: "annual", nextReviewAt: "2026-09-21",
  }),
  record({
    id: "career--white-house-ceq-internship", aliases: ["CEQ Internship", "White House Council on Environmental Quality Internship"],
    title: "White House CEQ Internship", type: "Career", category: "Public Policy",
    description: "An in-person spring internship providing research and writing support on environmental policy, permitting, federal sustainability, public lands, and water policy.",
    organization: "White House Council on Environmental Quality", majors: environmentalPolicyMajors, years: undergraduateYears,
    eligibility: "Current undergraduate students who are U.S. citizens and have a demonstrated interest in environmental policy or a relevant field. The internship requires at least 16 hours per week in Washington, D.C., and selection requires a background check and drug test.",
    estimatedValue: null, valueNote: "Unknown - the internship is unpaid, and the official page states that housing and relocation support are not provided.",
    deadline: "2026-09-20", deadlineType: "fixed", cycle: "spring-2027", lifecycleState: "open",
    location: "Washington, DC", remote: false, paid: false,
    tags: ["Internship", "Environmental Policy", "Public Policy", "Government", "Writing"],
    source: "https://www.whitehouse.gov/ceq/internships/",
    sourceReferences: [
      source("https://www.whitehouse.gov/ceq/internships/", [...supports], "The official CEQ page confirms current-undergraduate eligibility, U.S. citizenship, environmental-policy focus, unpaid in-person format, 16-hour minimum, and the September 20 Spring 2027 deadline.", "spring-2027"),
    ],
    rules: {
      educationLevels: ["undergraduate", "community_college"],
      canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"], acceptsExternalStudents: true,
      classYears: undergraduateYears, majors: environmentalPolicyMajors, citizenshipStatuses: ["us_citizen"],
      transferEligibility: "general_undergraduate", availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: ["The official page positively proves the current cycle and every eligibility field used for ranking."],
    },
    reviewerNotes: "The unpaid, in-person, and minimum weekly commitment constraints are surfaced rather than treated as hidden tradeoffs.",
    difficulty: "Highly Competitive", prestige: "Very High",
    applicationRequirements: ["Official online application", "Resume", "Policy-interest evidence", "Background check if selected", "Drug test if selected"],
    skillsGained: ["Environmental Policy Research", "Policy Writing", "Stakeholder Communication", "Project Management"],
    careerPaths: ["Environmental Policy", "Government", "Public Policy", "Sustainability"],
    expectedROI: "Substantive federal environmental-policy experience, with the material tradeoff that the placement is unpaid and in person.",
    recommendedMajors: environmentalPolicyMajors, recommendedClassYears: undergraduateYears,
    estimatedApplicationTime: "3-5 hours", duration: "Spring semester", recurrence: "annual", nextReviewAt: "2026-09-21",
  }),
] satisfies Opportunity[];

const acceptedById = new Map(acceptedRecords.map((item) => [item.id, item]));
const accepted = (id: string, groups: string[], gaps: string[], effort: "low" | "medium" | "high" = "low"): OpportunityAcquisitionCandidate => {
  const item = acceptedById.get(id);
  if (!item) throw new Error(`Missing targeted coverage record ${id}.`);
  return {
    id, title: item.title, organization: item.organization, type: item.type,
    targetStudentGroups: groups, coverageGaps: gaps,
    sourceUrls: item.metadata.sourceReferences?.map((entry) => entry.url) ?? [item.official_source_url],
    verificationEffort: effort, quality: item.prestige === "Very High" ? "very_high" : "high",
    lifecycleStability: item.metadata.deadlineType === "rolling" ? "high" : "medium",
    broadEligibility: item.majors.includes("Any Major"), status: "recommendation_safe",
    disposition: "accepted", dispositionReason: "Current official sources prove actionable lifecycle and deterministic structured eligibility.", record: item,
  };
};
const deferred = (id: string, title: string, organization: string, type: Opportunity["type"], groups: string[], gaps: string[], sourceUrl: string, disposition: OpportunityAcquisitionCandidate["disposition"], reason: string, reviewAt: string): OpportunityAcquisitionCandidate => ({
  id, title, organization, type, targetStudentGroups: groups, coverageGaps: gaps,
  sourceUrls: [sourceUrl], verificationEffort: "medium", quality: "high", lifecycleStability: "medium",
  broadEligibility: false, status: "rejected", disposition, dispositionReason: reason,
  sourceWatch: { sourceUrl, expectedReviewAt: reviewAt, reason: `Recheck the official source on ${reviewAt}.` },
});

export const opportunityAcquisitionCandidatesBatch4: OpportunityAcquisitionCandidate[] = [
  accepted("scholarship--aina-foundation-2026", ["accounting students", "finance students", "economics students"], ["scholarship", "economics"]),
  accepted("career--white-house-ostp-policy-internship", ["policy students", "science-policy students", "community-college students"], ["social sciences", "first year", "transfer"]),
  accepted("career--white-house-ceq-internship", ["environmental-policy students", "social-science students", "community-college students"], ["social sciences", "first year", "transfer"]),
  deferred("candidate--college-fed-challenge-2026", "College Fed Challenge", "Federal Reserve Board", "Career", ["economics students", "finance students"], ["economics", "competition"], "https://www.federalreserve.gov/aboutthefed/educational-tools/college-fed-challenge-overview.htm", "institution_membership_unproven", "The current cycle is open, but eligibility depends on a same-school team, one institutional entry, and faculty coordination that a student profile cannot prove.", "2027-04-15"),
  deferred("candidate--ayn-rand-essay-contest-2027", "Atlas Shrugged Essay Contest", "Ayn Rand Institute", "Career", ["humanities students", "international students"], ["humanities", "competition", "international"], "https://aynrand.org/students/essay-contests", "current_cycle_unavailable", "The official page confirms broad student eligibility but lists the next deadline as TBD and does not expose a verifiable open contest cycle.", "2026-10-15"),
  deferred("candidate--atlas-prize-2026", "Atlas Prize for Independent Thought", "Ayn Rand Institute", "Career", ["humanities students", "economics students"], ["humanities", "competition"], "https://www.atlasprize.org/", "eligibility_unclear", "The official launch proves the age-limited competition and prize, but the student profile cannot prove age and the official page does not expose a stable application deadline.", "2026-09-15"),
  deferred("candidate--maryland-2-plus-2-transfer-2026", "2+2 Transfer Scholarship", "Maryland Higher Education Commission", "Scholarship", ["community-college transfer students"], ["transfer", "scholarship"], "https://mhec.maryland.gov/preparing/pages/financialaid/programdescriptions/prog_2_plus_2.aspx", "eligibility_unclear", "The current cycle is open, but Maryland residency and an eligible in-state transfer destination are mandatory facts the current profile cannot prove.", "2027-06-01"),
  deferred("candidate--ritchie-jennings-2027", "Ritchie-Jennings Memorial Scholarship", "ACFE Foundation", "Scholarship", ["accounting students", "finance students", "transfer students"], ["scholarship", "economics", "transfer"], "https://www.acfe.com/about-the-acfe/acfe-foundation/scholarship", "current_cycle_unavailable", "The official provider says the next cycle opens September 1, 2026; it is not currently actionable on the August 20 verification date.", "2026-09-01"),
  deferred("candidate--nmah-spring-2027", "National Museum of American History Internships", "Smithsonian National Museum of American History", "Career", ["humanities students"], ["humanities", "internship"], "https://americanhistory.si.edu/about/careers/internship/program-details", "current_cycle_unavailable", "The Fall 2026 deadline has passed and the official page says Spring 2027 applications will not open until early October.", "2026-10-05"),
  deferred("candidate--udall-undergraduate-2027", "Udall Undergraduate Scholarship", "Udall Foundation", "Scholarship", ["environmental students", "Native and Indigenous students"], ["scholarship", "social sciences"], "https://www.udall.gov/OurPrograms/Scholarship/Apply.aspx", "institution_membership_unproven", "The next cycle does not open until October 15 and applications require an authorized institutional faculty representative and additional demographic proof.", "2026-10-15"),
  deferred("candidate--phi-kappa-phi-fellowship-2027", "Phi Kappa Phi Fellowship", "Honor Society of Phi Kappa Phi", "Career", ["humanities seniors", "graduate-school applicants"], ["humanities", "fellowship"], "https://www.phikappaphi.org/grants-awards/fellowship", "institution_membership_unproven", "The application opens December 15 and requires active Phi Kappa Phi membership plus selection as the local chapter nominee.", "2026-12-15"),
  deferred("candidate--fraser-student-essay-2027", "Student Essay Contest", "Fraser Institute", "Career", ["economics students", "humanities students"], ["economics", "humanities", "competition"], "https://www.fraserinstitute.org/education-programs/student-essay-contest", "current_cycle_unavailable", "The 2026 contest closed June 8 and the official page says the next contest will open in January 2027.", "2027-01-15"),
  deferred("candidate--gfoa-academic-scholarships-2027", "GFOA Academic Scholarships", "Government Finance Officers Association", "Scholarship", ["finance students", "public-policy students"], ["economics", "social sciences", "scholarship"], "https://www.gfoa.org/academic-scholarships", "current_cycle_unavailable", "The official page announces 2026 recipients but does not yet publish an open 2027 application cycle or current deadline.", "2026-11-15"),
];

export const opportunityAcquisitionBatch4 = { batchId: context.batchId, verifiedAt: context.verifiedAt, records: acceptedRecords } as const;
