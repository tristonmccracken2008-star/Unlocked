import type { Opportunity } from "./opportunities";
import type { OpportunityAcquisitionCandidate } from "./opportunity-acquisition";
import {
  acquisitionSource,
  buildAcquisitionRecord,
  type OpportunityAcquisitionRecordSpec,
} from "./opportunity-acquisition-batch";

const context = { batchId: "catalog-breakthrough-2026-08-research-wave", verifiedAt: "2026-08-20" };
const allYears = ["First year", "Second year", "Third year", "Fourth year"];
const socialAndQuantitativeMajors = ["Political Science", "Economics", "Education", "Business", "Criminal Justice", "Mathematics", "Statistics", "Data Science", "Psychology", "Sociology"];
const manufacturingMajors = ["Engineering", "Materials Science", "Mechanical Engineering", "Electrical Engineering", "Chemical Engineering", "Chemistry", "Physics", "Industrial Engineering"];
const supports = [
  "academic_level", "institution_type", "enrollment_status", "school_restriction",
  "external_student_eligibility", "class_year", "major", "citizenship", "residency",
  "gpa", "age", "financial_need", "invitation", "application_status", "deadline",
] as const;
const source = (url: string, note: string, cycle: string) => acquisitionSource(url, [...supports], note, context, cycle);
const record = (spec: OpportunityAcquisitionRecordSpec) => buildAcquisitionRecord(spec, context);

const acceptedRecords = [
  record({
    id: "career--nsf-elean-nanomanufacturing-2026",
    aliases: ["ELEAN", "Experiential Learning Explorations in Advanced Nanomanufacturing"],
    title: "ELEAN Nanomanufacturing Traineeship",
    type: "Career",
    category: "Technical Training",
    description: "A paid, hands-on nanomanufacturing traineeship with cleanroom training, professional development, and work at Brookhaven National Laboratory.",
    organization: "Stony Brook University and Brookhaven National Laboratory",
    majors: manufacturingMajors,
    years: allYears,
    eligibility: "People age 18 or older who legally reside in the United States. The three-month Explorer track does not require a STEM major; selection prioritizes basic mathematics preparation.",
    estimatedValue: null,
    valueNote: "Unknown - the official NSF ETAP posting confirms paid traineeships but does not publish the wage or stipend.",
    deadline: null,
    deadlineType: "rolling",
    cycle: "rolling-2026-28",
    lifecycleState: "rolling",
    location: "Long Island, NY",
    remote: false,
    paid: true,
    tags: ["Paid", "Nanomanufacturing", "Semiconductors", "Cleanroom", "Career Training", "Any Major"],
    source: "https://etap.nsf.gov/api/edge/awards/public/8287/opportunities/11369",
    sourceReferences: [source("https://etap.nsf.gov/api/edge/awards/public/8287/opportunities/11369", "The official NSF ETAP record confirms rolling applications, paid Explorer and Developer tracks, age, U.S. residence, degree, and technical-preparation rules; September 1, 2028 is the listed program end.", "rolling-2026-28")],
    rules: {
      educationLevels: ["undergraduate", "community_college"],
      canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      acceptsExternalStudents: true,
      classYears: allYears,
      majors: manufacturingMajors,
      citizenshipStatuses: ["us_citizen", "permanent_resident", "us_work_authorized"],
      ageRange: { minimum: 18 },
      transferEligibility: "general_undergraduate",
      availability: "rolling",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: ["Ranking is limited to manufacturing-adjacent majors, current students with a positively proven U.S. status, and age even though the public Explorer track accepts other majors and adult learners."],
    },
    reviewerNotes: "The catalog represents the undergraduate Explorer pathway only; the year-long Developer pathway has additional aptitude requirements.",
    difficulty: "Competitive",
    prestige: "Very High",
    applicationRequirements: ["NSF ETAP application", "Short-answer motivation statement", "Technical or lab-experience statement"],
    skillsGained: ["Cleanroom Practice", "Nanomanufacturing", "Laboratory Safety", "Technical Communication"],
    careerPaths: ["Semiconductor Manufacturing", "Materials Science", "Engineering Technology", "National Laboratories"],
    expectedROI: "Paid technical training and national-laboratory exposure without requiring a STEM major for the Explorer track.",
    recommendedMajors: manufacturingMajors,
    recommendedClassYears: allYears,
    estimatedApplicationTime: "1-2 hours",
    duration: "3 months",
    recurrence: "rolling_cohort",
    nextReviewAt: "2026-11-20",
  }),
  record({
    id: "career--nsf-bridge-to-cyber-2026",
    aliases: ["B2C@OU", "NSF Bridge To Cyber Program"],
    title: "NSF Bridge To Cyber Program",
    type: "Career",
    category: "Cybersecurity Training",
    description: "A flexible cybersecurity bridge program covering programming, networking, and systems administration for students entering the field from non-computing majors.",
    organization: "Oakland University",
    majors: socialAndQuantitativeMajors,
    years: allYears,
    eligibility: "U.S. citizens, U.S. nationals, or permanent residents who are completing an undergraduate degree in a non-computing discipline and want foundational cybersecurity preparation.",
    estimatedValue: null,
    valueNote: "Unknown - the official listing describes low-cost non-credit courses but does not publish a single program price.",
    deadline: "2026-08-28",
    deadlineType: "fixed",
    cycle: "2026",
    lifecycleState: "open",
    location: "Rochester, MI or online",
    remote: null,
    paid: false,
    tags: ["Cybersecurity", "Training", "Online Option", "Career Change", "Non-STEM Majors"],
    source: "https://www.oakland.edu/secs/labs-and-centers/cybersecurity/",
    sourceReferences: [
      source("https://etap.nsf.gov/api/edge/awards/public/183/opportunities/3632", "The official NSF ETAP record confirms the August 28 application close, undergraduate access, and citizenship restriction.", "2026"),
      source("https://www.oakland.edu/secs/labs-and-centers/cybersecurity/", "The official university page identifies Bridge To Cyber as an NSF-supported cybersecurity education program at Oakland University.", "2026"),
    ],
    rules: {
      educationLevels: ["undergraduate", "community_college"],
      canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      acceptsExternalStudents: true,
      classYears: allYears,
      majors: socialAndQuantitativeMajors,
      citizenshipStatuses: ["us_citizen", "permanent_resident"],
      transferEligibility: "general_undergraduate",
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: ["Computing majors are intentionally omitted because the program is designed for students entering cybersecurity from non-computing disciplines."],
    },
    reviewerNotes: "This is structured career training, not a paid internship or degree program. Price remains unknown until the current course selection is reviewed by an applicant.",
    difficulty: "Open",
    prestige: "High",
    applicationRequirements: ["NSF ETAP application"],
    skillsGained: ["Programming", "Networking", "Systems Administration", "Cybersecurity Foundations"],
    careerPaths: ["Cybersecurity", "Information Technology", "Technology Policy", "Security Operations"],
    expectedROI: "An accessible bridge into cybersecurity for students whose current major does not provide computing prerequisites.",
    recommendedMajors: socialAndQuantitativeMajors,
    recommendedClassYears: allYears,
    estimatedApplicationTime: "15-30 minutes",
    recurrence: "rolling_cohort",
    nextReviewAt: "2026-08-29",
  }),
] satisfies Opportunity[];

const acceptedById = new Map(acceptedRecords.map((item) => [item.id, item]));
const accepted = (id: string, groups: string[], gaps: string[]): OpportunityAcquisitionCandidate => {
  const item = acceptedById.get(id);
  if (!item) throw new Error(`Missing research-wave record ${id}.`);
  return { id, title: item.title, organization: item.organization, type: item.type, targetStudentGroups: groups, coverageGaps: gaps, sourceUrls: item.metadata.sourceReferences?.map((entry) => entry.url) ?? [item.official_source_url], verificationEffort: "high", quality: item.prestige === "Very High" ? "very_high" : "high", lifecycleStability: "medium", broadEligibility: item.majors.includes("Any Major"), status: "recommendation_safe", disposition: "accepted", dispositionReason: "Current official sources prove the active lifecycle and every eligibility fact used for ranking.", record: item };
};

type ResearchedProgram = readonly [id: string, title: string, organization: string, reason: string, reviewAt: string, disposition?: OpportunityAcquisitionCandidate["disposition"]];
const etapPrograms: ResearchedProgram[] = [
  ["12009", "NSF ExLENT Aerospace Engineering Workforce Training", "University of Texas at Arlington", "The application closes on the verification date and is not durable enough for a new recommendation record.", "2027-01-15"],
  ["11322", "GLEAM Biomedical and Biochemical Engineering", "University of Alabama", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11323", "GLEAM Data Analytics and AI", "University of Alabama", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11324", "GLEAM Advanced Manufacturing Processes", "University of Alabama", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11325", "GLEAM Sensors and Robotics", "University of Alabama", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11935", "RaMP BOATS Internship Program", "University of Nebraska", "The official listing is post-baccalaureate only.", "2027-01-01", "graduate_only"],
  ["11521", "On-Ramp to the Molecular Machine Shop", "City College of New York", "The official listing is post-baccalaureate only.", "2027-01-01", "graduate_only"],
  ["12012", "STEGG-INTERACT 2027", "National Science Foundation", "The official listing is post-baccalaureate only.", "2027-01-01", "graduate_only"],
  ["12024", "UCSD Interdisciplinary AI REU", "University of California San Diego", "San Diego County residency, programming experience, and course prerequisites cannot all be proven from the current student profile.", "2027-05-01", "eligibility_unclear"],
  ["11262", "EMERGE Alaska Geosciences", "University of Alaska", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11260", "EMERGE Alaska Life Sciences", "University of Alaska", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11261", "EMERGE Alaska Integrative Activities", "University of Alaska", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["12004", "Pivot to Plants", "National Science Foundation", "The official listing is post-baccalaureate only.", "2027-01-01", "graduate_only"],
  ["12016", "IRES Digital Twins and Logistics in Germany", "University of Louisville", "The current application does not open until September 1.", "2026-09-01"],
  ["11287", "I-SEER Biological Sciences", "University of Idaho", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11967", "BioRISE Trainee 2026-2027", "National Science Foundation", "The official listing is post-baccalaureate only.", "2027-01-01", "graduate_only"],
  ["12015", "Boise State RISE NRT Traineeship", "Boise State University", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11273", "I-SEER Geosciences", "University of Idaho", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11285", "WIN-WIN LSU Coastal Research", "Louisiana State University", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11343", "Big Sky Fellows Engineering", "Montana State University", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11345", "Big Sky Fellows Ecology", "Montana State University", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11346", "Big Sky Fellows Microbiology", "Montana State University", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11970", "Xavier University of Louisiana REU", "Xavier University of Louisiana", "The current application does not open until November 1.", "2026-11-01"],
  ["11976", "REU-EXTEND", "University of Illinois Urbana-Champaign", "The current application does not open until November 1.", "2026-11-01"],
  ["12025", "Urban Watershed Science REU", "University of Michigan-Dearborn", "The current application does not open until September 1.", "2026-09-01"],
  ["12020", "REU AICT 2027", "Gallaudet University", "The current application does not open until November 1.", "2026-11-01"],
  ["12021", "Universal AI NRT 2027-28", "Gallaudet University", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11244", "NAIRR Workshop Series", "Oakland University", "The listed program end date precedes the application close, so lifecycle evidence conflicts.", "2026-10-01", "conflicting_official_sources"],
  ["11808", "QIS-AI Fellows", "Oklahoma State University", "The official listing is for PhD positions.", "2027-01-01", "graduate_only"],
  ["11954", "WVU Biology EGFP", "West Virginia University", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["10305", "USDA HSI Micro-Nano-Plastics Research", "Texas A&M University-Kingsville", "Institutional participation, position level, and current project availability are not sufficiently explicit for national ranking.", "2026-10-01", "institution_membership_unproven"],
  ["9175", "Eco Catalyzers RET", "University of San Diego", "The listing mixes teacher, undergraduate, graduate, and postdoctoral access without a separable undergraduate pathway.", "2026-10-01", "eligibility_unclear"],
  ["11979", "Graduate Fellowships in Geosciences", "University of Nevada Las Vegas", "The official rules require graduate enrollment and prior NSF GRFP honorable mention.", "2027-01-01", "graduate_only"],
  ["11342", "WildFIRE QUEST", "University of Idaho", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["3467", "CyberCorps Scholarship for Service at UTC", "University of Tennessee Chattanooga", "School enrollment, dual-citizenship exclusions, and service obligations cannot all be proven by the current profile.", "2026-10-01", "institution_membership_unproven"],
  ["10155", "Norwalk Community College S-STEM Scholarship", "Norwalk Community College", "The award is restricted to one institution and the official listing omits enough current award detail to structure safely.", "2026-10-01", "institution_membership_unproven"],
  ["11913", "EXPLOR-NEPA AI and Robotics", "National Science Foundation", "The official listing is high-school only.", "2027-01-01", "graduate_only"],
  ["11303", "UAH Astronomy EGFP", "University of Alabama Huntsville", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11332", "UAH Heliophysics EGFP", "University of Alabama Huntsville", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11333", "UAH Systems Engineering EGFP", "University of Alabama Huntsville", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11334", "UAH Aerospace Materials EGFP", "University of Alabama Huntsville", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11335", "UAH Computing and AI EGFP", "University of Alabama Huntsville", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11336", "UAH Atmospheric Sciences EGFP", "University of Alabama Huntsville", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11256", "STEM Workforce Development in Materials Research", "National Science Foundation", "The official listing is graduate-only.", "2027-01-01", "graduate_only"],
  ["11977", "DataSENSE NRT", "Michigan Technological University", "The listing is an institution-based graduate traineeship despite a broad applicant-type tag.", "2026-10-01", "institution_membership_unproven"],
  ["11369", "ELEAN Nanomanufacturing Traineeship", "Stony Brook University", "Accepted as a current, broad-access undergraduate Explorer pathway.", "2026-09-02", "accepted"],
  ["3632", "NSF Bridge To Cyber Program", "Oakland University", "Accepted as current non-computing undergraduate training.", "2026-08-29", "accepted"],
];

const candidateFromEtap = ([id, title, organization, reason, reviewAt, disposition = "current_cycle_unavailable"]: ResearchedProgram): OpportunityAcquisitionCandidate => {
  const acceptedRecord = id === "11369" ? acceptedById.get("career--nsf-elean-nanomanufacturing-2026") : id === "3632" ? acceptedById.get("career--nsf-bridge-to-cyber-2026") : undefined;
  if (acceptedRecord) return accepted(acceptedRecord.id, ["undergraduate students"], ["research", "career training"]);
  return { id: `candidate--nsf-etap-${id}`, title, organization, type: "Research", targetStudentGroups: ["undergraduate researchers"], coverageGaps: ["research", "STEM"], sourceUrls: ["https://etap.nsf.gov/search"], verificationEffort: "medium", quality: "high", lifecycleStability: "medium", broadEligibility: false, status: "rejected", disposition, dispositionReason: reason, sourceWatch: { sourceUrl: "https://etap.nsf.gov/search", expectedReviewAt: reviewAt, reason: `Recheck NSF ETAP on ${reviewAt}.` } };
};

export const opportunityAcquisitionCandidatesBatch6 = etapPrograms.map(candidateFromEtap);
export const opportunityAcquisitionBatch6 = { batchId: context.batchId, verifiedAt: context.verifiedAt, records: acceptedRecords } as const;
