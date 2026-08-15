import type {
  Opportunity,
  OpportunityEligibilityEvidenceField,
  OpportunityEligibilityRules,
  OpportunitySourceReference,
} from "./opportunities";
import type { OpportunityAcquisitionCandidate } from "./opportunity-acquisition";

const verifiedAt = "2026-08-14";
const batchId = "high-quality-expansion-2026-08-wave-1";
const undergraduateYears = ["First year", "Second year", "Third year", "Fourth year"];
const upperUndergraduateYears = ["Third year", "Fourth year"];
const scienceMajors = [
  "Natural Sciences", "Biology", "Chemistry", "Physics", "Neuroscience", "Environmental Science",
  "Computer Science", "Data Science", "Mathematics", "Statistics", "Engineering", "Aerospace Engineering",
  "Biomedical Engineering", "Chemical Engineering", "Computer Engineering", "Electrical Engineering",
  "Environmental Engineering", "Materials Science", "Mechanical Engineering",
];
const allEvidenceFields: OpportunityEligibilityEvidenceField[] = [
  "academic_level", "institution_type", "enrollment_status", "school_restriction",
  "external_student_eligibility", "class_year", "major", "citizenship", "residency",
  "gpa", "age", "financial_need", "invitation", "application_status", "deadline",
];

export type OpportunityAcquisitionRecordSpec = {
  id: string;
  aliases?: string[];
  title: string;
  type: Opportunity["type"];
  category: string;
  description: string;
  organization: string;
  majors: string[];
  years: string[];
  eligibility: string;
  estimatedValue: number | null;
  valueNote: string;
  deadline: string | null;
  deadlineType: NonNullable<Opportunity["metadata"]["deadlineType"]>;
  cycle: string;
  lifecycleState: "open" | "rolling";
  location: string;
  remote: boolean | null;
  paid: boolean | null;
  tags: string[];
  source: string;
  sourceReferences: OpportunitySourceReference[];
  rules: OpportunityEligibilityRules;
  reviewerNotes: string;
  difficulty: Opportunity["difficulty"];
  prestige: Opportunity["prestige"];
  applicationRequirements?: string[];
  skillsGained?: string[];
  careerPaths?: string[];
  estimatedApplicationTime?: Opportunity["metadata"]["estimatedApplicationTime"];
  stipendAmount?: number | null;
  duration?: string;
  recurrence?: "annual" | "rolling_cohort";
  reviewCadenceDays?: number;
  nextReviewAt: string;
};

export type OpportunityAcquisitionRecordContext = {
  batchId: string;
  verifiedAt: string;
};

function evidenceFor(spec: OpportunityAcquisitionRecordSpec, context: OpportunityAcquisitionRecordContext) {
  return Object.fromEntries(allEvidenceFields.map((field) => {
    const reference = spec.sourceReferences.find((item) => item.supports.includes(field)) ?? spec.sourceReferences[0];
    const anyMajor = spec.rules.majors?.includes("Any Major") === true;
    const unrestrictedCitizenship = spec.rules.citizenshipStatuses?.includes("international_allowed") === true;
    const noRestriction = (
      (field === "residency" && !spec.rules.residency)
      || (field === "gpa" && spec.rules.minimumGpa === undefined)
      || (field === "age" && spec.rules.ageRange === undefined)
      || (field === "financial_need" && spec.rules.financialNeedRequired !== true)
      || (field === "invitation" && spec.rules.invitationOnly !== true)
    );
    const verifiedOpen = field === "application_status"
      || field === "deadline"
      || (field === "external_student_eligibility" && spec.rules.acceptsExternalStudents === true)
      || (field === "major" && anyMajor)
      || (field === "citizenship" && unrestrictedCitizenship);
    return [field, {
      state: verifiedOpen ? "verified_open" : noRestriction ? "reviewed_no_restriction" : "verified_restriction",
      sourceUrl: reference.url,
      authority: reference.authority,
      verifiedAt: context.verifiedAt,
      cycle: spec.cycle,
      note: reference.note,
    }];
  }));
}

function date(kind: "final_deadline" | "priority_deadline" | "program_start" | "program_end", value: string, sourceUrl: string) {
  return { kind, sourceValue: value, normalizedValue: value, precision: "date" as const, estimated: false, verifiedAt, sourceUrl };
}

export function buildAcquisitionRecord(spec: OpportunityAcquisitionRecordSpec, context: OpportunityAcquisitionRecordContext): Opportunity {
  const { batchId, verifiedAt } = context;
  const lifecycleEvidence = spec.sourceReferences.map((reference, index) => ({
    id: `${spec.id}:${spec.cycle}:official:${index + 1}`,
    source: spec.deadline ? "official_application_page" as const : "official_status" as const,
    observedAt: `${verifiedAt}T00:00:00.000Z`,
    value: reference.note,
    sourceUrl: reference.url,
    confidence: "confirmed" as const,
  }));
  return {
    id: spec.id,
    title: spec.title,
    type: spec.type,
    category: spec.category,
    description: spec.description,
    organization: spec.organization,
    school_scope: "National",
    schools: [],
    majors: spec.majors,
    academic_years: spec.years,
    eligibility: spec.eligibility,
    estimated_value: spec.estimatedValue,
    application_deadline: spec.deadline,
    recurring: true,
    location: spec.location,
    remote: spec.remote,
    paid: spec.paid,
    tags: spec.tags,
    official_source: spec.source,
    official_source_url: spec.source,
    verification_status: "verified",
    last_verified: verifiedAt,
    deadline: spec.deadline,
    reviewer_notes: spec.reviewerNotes,
    estimated_value_note: spec.valueNote,
    date_added: verifiedAt,
    difficulty: spec.difficulty,
    prestige: spec.prestige,
    icon: spec.type.toLowerCase(),
    featured: false,
    hidden_gem: false,
    metadata: {
      deadlineType: spec.deadlineType,
      compensation: spec.paid === true ? "Paid" : spec.paid === false ? "Unpaid" : "Varies",
      workMode: spec.remote === true ? "Remote" : spec.remote === false ? "In Person" : "Varies",
      ...(spec.type === "Research" ? {
        professor: null,
        department: spec.organization,
        researchArea: spec.tags.includes("STEM") ? "Science and technology" : spec.category,
        stipendAmount: spec.stipendAmount ?? null,
        semesters: [spec.deadline ? spec.cycle : "Year-round"],
      } : {}),
      ...(spec.type === "Scholarship" ? {
        awardAmountLabel: spec.valueNote,
        renewable: null,
      } : {}),
      internshipDuration: spec.duration,
      applicationRequirements: spec.applicationRequirements,
      estimatedApplicationTime: spec.estimatedApplicationTime ?? "3-5 hours",
      skillsGained: spec.skillsGained,
      careerPaths: spec.careerPaths,
      eligibilityRules: { ...spec.rules, fieldEvidence: evidenceFor(spec, context) },
      sourceReferences: spec.sourceReferences,
      acquisition: {
        batchId,
        acquiredAt: verifiedAt,
        reviewCadenceDays: spec.reviewCadenceDays ?? (spec.deadline ? 45 : 90),
        nextReviewAt: spec.nextReviewAt,
        freshnessModel: spec.deadline ? "fixed_cycle" : spec.recurrence === "annual" ? "annual_event" : "rolling_program",
      },
      verification: {
        status: "verified",
        lastVerifiedAt: verifiedAt,
        verifiedCycle: spec.cycle,
        officialSourceUrl: spec.source,
        applicationUrlVerified: true,
        deadlineVerified: spec.deadlineType === "fixed",
        eligibilityVerified: true,
        sourceReachable: true,
        sourceAuditStatus: 200,
        notes: spec.reviewerNotes,
      },
      lifecycle: {
        schemaVersion: 1,
        migrationId: batchId,
        identity: { identityId: spec.id, aliases: spec.aliases },
        cycle: { cycleId: spec.cycle, label: spec.cycle },
        state: spec.lifecycleState,
        confidence: "confirmed",
        reason: spec.lifecycleState === "rolling" ? "rolling_confirmed" : "official_status_open",
        effectiveAt: `${verifiedAt}T00:00:00.000Z`,
        ...(spec.deadline ? { finalDeadline: date("final_deadline", spec.deadline, spec.source) } : {}),
        recurrence: { type: spec.recurrence ?? (spec.deadline ? "annual" : "rolling_cohort"), confidence: "confirmed", officialStatement: spec.reviewerNotes },
        evidence: lifecycleEvidence,
        events: [],
        sourceChecks: spec.sourceReferences.map((reference) => ({ url: reference.url, checkedAt: `${verifiedAt}T00:00:00.000Z`, classification: "official_application" as const, status: 200 })),
        fieldVerifiedAt: { state: verifiedAt, deadline: verifiedAt, applicationUrl: verifiedAt, eligibility: verifiedAt, award: verifiedAt, location: verifiedAt, programDates: verifiedAt, description: verifiedAt },
        review: { note: spec.reviewerNotes, reviewedAt: `${verifiedAt}T00:00:00.000Z`, reviewer: "UnlockED catalog acquisition" },
      },
    },
  };
}

export function acquisitionSource(url: string, supports: OpportunityEligibilityEvidenceField[], note: string, context: OpportunityAcquisitionRecordContext, cycle = "2026-27"): OpportunitySourceReference {
  return { url, authority: "official_program", verifiedAt: context.verifiedAt, cycle, supports, note };
}

const recordContext = { batchId, verifiedAt };
const buildRecord = (spec: OpportunityAcquisitionRecordSpec) => buildAcquisitionRecord(spec, recordContext);
const source = (url: string, supports: OpportunityEligibilityEvidenceField[], note: string) => acquisitionSource(url, supports, note, recordContext);

const acceptedRecords = [
  buildRecord({
    id: "scholarship--fund-for-education-abroad",
    aliases: ["FEA Scholarship", "Fund for Education Abroad Scholarship"],
    title: "Fund for Education Abroad Scholarships",
    type: "Scholarship",
    category: "Study Abroad",
    description: "Need-based funding for U.S. undergraduates earning home-institution credit through a winter or spring study-abroad program lasting at least 14 days.",
    organization: "Fund for Education Abroad",
    majors: ["Any Major"], years: undergraduateYears,
    eligibility: "Undergraduates age 18 or older enrolled at a U.S. institution who are U.S. citizens or permanent residents, have demonstrated financial need, will earn home-institution credit abroad for at least 14 days, and have not previously studied abroad after high school.",
    estimatedValue: 10000, valueNote: "$1,000-$10,000, with the amount based on program length.",
    deadline: "2026-09-16", deadlineType: "fixed", cycle: "winter-spring-2027", lifecycleState: "open",
    location: "Study abroad destination", remote: false, paid: true,
    tags: ["Scholarship", "Study Abroad", "Financial Need", "Any Major", "Undergraduate"],
    source: "https://fundforeducationabroad.org/apply/",
    sourceReferences: [
      source("https://fundforeducationabroad.org/apply/", ["academic_level", "institution_type", "enrollment_status", "school_restriction", "external_student_eligibility", "class_year", "major", "citizenship", "age", "financial_need", "application_status"], "The official application page confirms undergraduate enrollment, U.S. institution, citizenship, age, credit, prior-study-abroad, and financial-need rules."),
      source("https://fundforeducationabroad.org/wp-content/uploads/2026/07/WinterSpring-2027-Application-Flyer.pdf", ["deadline", "application_status"], "The official Winter/Spring 2027 flyer confirms the July 29 opening, September 16 deadline, eligibility, and $1,000-$10,000 award range."),
    ],
    rules: { educationLevels: ["undergraduate"], canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"], canonicalEnrollmentStatuses: ["currently_enrolled"], classYears: undergraduateYears, majors: ["Any Major"], citizenshipStatuses: ["us_citizen", "permanent_resident"], ageRange: { minimum: 18 }, financialNeedRequired: true, availability: "open", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["Official current-cycle application and flyer reviewed on 2026-08-14."] },
    reviewerNotes: "Official FEA sources confirm the open Winter/Spring 2027 cycle, exact deadline, award range, and baseline eligibility. DACA is also accepted by FEA but is conservatively omitted from structured ranking because the current profile model has no DACA status.",
    difficulty: "Competitive", prestige: "High", estimatedApplicationTime: "3-5 hours", applicationRequirements: ["Online application", "Unofficial transcript", "Study-abroad program and credit details", "Financial-need information"], skillsGained: ["Cross-cultural Communication"], careerPaths: ["Any Career"], nextReviewAt: "2026-09-17",
  }),
  buildRecord({
    id: "career--hacu-national-internship-program-spring-2027",
    aliases: ["HNIP", "HACU National Internship Program"],
    title: "HACU National Internship Program",
    type: "Career", category: "Internships",
    description: "Paid spring internships with U.S. federal agencies for students who have completed at least one undergraduate year. HNIP considers applicants across majors for remote, hybrid, and in-person roles.",
    organization: "Hispanic Association of Colleges and Universities",
    majors: ["Any Major"], years: ["Second year", "Third year", "Fourth year", "Graduate student"],
    eligibility: "Students enrolled in an accredited degree-seeking program in the United States or Puerto Rico, or eligible recent graduates, who have completed at least one undergraduate year and are authorized to work in the United States. Most federal placements require U.S. citizenship.",
    estimatedValue: null, valueNote: "Unknown - placement hours vary; the official 2026 undergraduate rate is $18.50 per hour and graduate rate is $20.25 per hour.",
    deadline: null, deadlineType: "rolling", cycle: "spring-2027", lifecycleState: "rolling",
    location: "United States; remote, hybrid, and in-person placements", remote: null, paid: true,
    tags: ["Internship", "Federal Government", "Public Service", "Paid", "Any Major"],
    source: "https://hacu.net/hnip/overview/",
    sourceReferences: [
      source("https://hacu.net/hnip/overview/", ["academic_level", "institution_type", "enrollment_status", "school_restriction", "external_student_eligibility", "class_year", "major", "citizenship", "gpa", "application_status", "deadline"], "The official HNIP overview confirms Spring 2027 dates, paid status, U.S./Puerto Rico enrollment, one completed undergraduate year, all majors, work authorization, and placement formats."),
      source("https://my.hacu.net/assnfe/StudentInfo.asp?RD=1", ["application_status", "deadline"], "The official portal confirms that Spring 2027 applications opened July 6, 2026, have a November 20 priority deadline, and remain under consideration until the session starts."),
    ],
    rules: { educationLevels: ["undergraduate", "graduate", "recent_graduate"], canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college", "graduate_school"], canonicalEnrollmentStatuses: ["currently_enrolled", "graduated"], classYears: ["Second year", "Third year", "Fourth year", "Graduate student"], majors: ["Any Major"], citizenshipStatuses: ["us_citizen"], minimumGpa: 2, availability: "rolling", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["Structured ranking is conservatively limited to U.S. citizens because the official page states most federal placements require citizenship."] },
    reviewerNotes: "Current official HACU pages confirm Spring 2027 is accepting applications and provide central eligibility. Ranking is narrower than the program's baseline work-authorization rule to avoid recommending federal placements to students whose citizenship fit is uncertain.",
    difficulty: "Competitive", prestige: "High", estimatedApplicationTime: "3-5 hours", applicationRequirements: ["Resume", "Essay", "Enrollment verification or recent-graduate proof", "Unofficial transcripts", "One professional reference"], skillsGained: ["Public Service", "Professional Communication", "Government Operations"], careerPaths: ["Public Service", "Policy", "Government"], duration: "15 weeks", nextReviewAt: "2026-11-21",
  }),
  buildRecord({
    id: "research--ista-year-round-scientific-internships",
    aliases: ["ISTA Scientific Internship", "ISTA Year-Round Internship"],
    title: "ISTA Year-Round Scientific Internships",
    type: "Research", category: "Internships",
    description: "Paid research placements lasting two months to one year with an ISTA research group in Austria. Applicants contact a relevant group leader directly with their background, CV, and proposed dates.",
    organization: "Institute of Science and Technology Austria",
    majors: scienceMajors, years: [...undergraduateYears, "Graduate student"],
    eligibility: "Bachelor's or master's students and recent graduates in natural sciences, computer science, mathematics, or related disciplines who can spend at least two months at ISTA and work in English.",
    estimatedValue: 1583, valueNote: "Minimum salary of EUR 1,583 gross per month.",
    deadline: null, deadlineType: "rolling", cycle: "year-round-2026", lifecycleState: "rolling",
    location: "Klosterneuburg, Austria", remote: false, paid: true,
    tags: ["Research", "International", "Paid", "STEM", "Rolling"],
    source: "https://phd.pages.ista.ac.at/scientific-internships/",
    sourceReferences: [source("https://phd.pages.ista.ac.at/scientific-internships/", allEvidenceFields, "ISTA's official internship page confirms continuous applications, eligible degrees and fields, English, duration, direct application process, and minimum salary.")],
    rules: { educationLevels: ["undergraduate", "graduate", "recent_graduate"], canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college", "graduate_school"], canonicalEnrollmentStatuses: ["currently_enrolled", "graduated"], acceptsExternalStudents: true, classYears: [...undergraduateYears, "Graduate student"], majors: scienceMajors, citizenshipStatuses: ["international_allowed"], availability: "rolling", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["The official page accepts students and recent graduates without a citizenship restriction and explains visa assistance after selection."] },
    reviewerNotes: "The year-round scientific internship is distinct from ISTA's paused 2026 summer ISTernship. The official page confirms rolling contact-based applications and a two-month minimum.",
    difficulty: "Highly Competitive", prestige: "Very High", estimatedApplicationTime: "1-2 hours", applicationRequirements: ["Email a relevant group leader", "Curriculum vitae", "Short background and motivation", "Proposed dates at least two months ahead"], skillsGained: ["Research", "Scientific Communication", "Laboratory or Computational Methods"], careerPaths: ["Research", "Graduate School", "Science and Engineering"], stipendAmount: 1583, duration: "2-12 months", nextReviewAt: "2026-11-12",
  }),
  buildRecord({
    id: "research--oist-research-internship-spring-2027",
    aliases: ["OIST Research Internship", "OIST RI"],
    title: "OIST Research Internship",
    type: "Research", category: "Internships",
    description: "A four-to-six-month research placement with an OIST faculty unit in Japan for advanced bachelor's students, master's students, and recent graduates considering further research study.",
    organization: "Okinawa Institute of Science and Technology",
    majors: scienceMajors, years: [...upperUndergraduateYears, "Graduate student"],
    eligibility: "Students in the final two years of a bachelor's degree, master's students, and bachelor's or master's graduates from institutions in Japan or overseas whose academic background fits a listed OIST research unit. Enrolled students need home-institution approval.",
    estimatedValue: null, valueNote: "Unknown - the official application source does not present a single guaranteed cash value in the reviewed eligibility and schedule sections.",
    deadline: "2026-10-15", deadlineType: "fixed", cycle: "spring-2027", lifecycleState: "open",
    location: "Okinawa, Japan", remote: false, paid: null,
    tags: ["Research", "International", "STEM", "Graduate School", "Japan"],
    source: "https://www.oist.jp/admissions/research-internship/apply-research-internship",
    sourceReferences: [
      source("https://www.oist.jp/admissions/research-internship/apply-research-internship", ["academic_level", "institution_type", "enrollment_status", "school_restriction", "external_student_eligibility", "class_year", "major", "citizenship", "application_status", "deadline"], "OIST's official application page confirms Spring 2027 dates, the October 15 deadline, eligible degree stages, overseas institutions, and academic-fit requirements."),
      source("https://www.oist.jp/admissions/research-internship/ri-faculty-project-availability", ["major", "application_status"], "The official project page lists faculty and projects available for the April-September 2027 intake."),
    ],
    rules: { educationLevels: ["undergraduate", "graduate", "recent_graduate"], canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college", "graduate_school"], canonicalEnrollmentStatuses: ["currently_enrolled", "graduated"], acceptsExternalStudents: true, classYears: [...upperUndergraduateYears, "Graduate student"], majors: scienceMajors, citizenshipStatuses: ["international_allowed"], availability: "open", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["Official current-cycle selection schedule and project availability reviewed."] },
    reviewerNotes: "Official OIST admissions pages confirm the Spring 2027 cycle and external/international eligibility. Recommendation majors are limited to fields represented by current OIST research units.",
    difficulty: "Highly Competitive", prestige: "Very High", estimatedApplicationTime: "3-5 hours", applicationRequirements: ["Online application", "Academic transcript", "Statement", "Recommendation materials", "Faculty/project selection"], skillsGained: ["Research", "Scientific Communication", "Independent Investigation"], careerPaths: ["Research", "Graduate School", "Science and Engineering"], duration: "4-6 months", nextReviewAt: "2026-10-16",
  }),
  buildRecord({
    id: "research--kaust-visiting-student-research-program",
    aliases: ["KAUST VSRP", "Visiting Student Research Program"],
    title: "KAUST Visiting Student Research Program",
    type: "Research", category: "Internships",
    description: "Fully funded, faculty-led STEM research internships at KAUST lasting two to six months. Students choose among more than 100 projects and may arrange dates throughout the year.",
    organization: "King Abdullah University of Science and Technology",
    majors: scienceMajors, years: [...upperUndergraduateYears, "Graduate student"],
    eligibility: "Third- or fourth-year bachelor's students and master's students in STEM with at least a 3.5 GPA. Current PhD candidates, KAUST students, and KAUST alumni are not eligible.",
    estimatedValue: 1000, valueNote: "$1,000 monthly stipend plus private housing, return airfare, activities, and research-facility access.",
    deadline: null, deadlineType: "rolling", cycle: "year-round-2026", lifecycleState: "rolling",
    location: "Thuwal, Saudi Arabia", remote: false, paid: true,
    tags: ["Research", "International", "Fully Funded", "STEM", "Rolling"],
    source: "https://admissions.kaust.edu.sa/study/internships",
    sourceReferences: [source("https://admissions.kaust.edu.sa/study/internships", allEvidenceFields, "KAUST's official internship page confirms year-round dates, degree stage, STEM focus, 3.5 GPA, international community, required documents, duration, and full funding.")],
    rules: { educationLevels: ["undergraduate", "graduate"], canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college", "graduate_school"], canonicalEnrollmentStatuses: ["currently_enrolled"], acceptsExternalStudents: true, classYears: ["Third year", "Fourth year", "Graduate student"], majors: scienceMajors, minimumGpa: 3.5, citizenshipStatuses: ["international_allowed"], availability: "rolling", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["Official year-round program page reviewed on 2026-08-14."] },
    reviewerNotes: "The official page confirms a year-round fully funded program for external students. Recommendation eligibility excludes PhD students because the current catalog class-year vocabulary cannot distinguish master's from doctoral profiles.",
    difficulty: "Highly Competitive", prestige: "Very High", estimatedApplicationTime: "3-5 hours", applicationRequirements: ["Official transcripts in English", "Faculty recommendation", "Passport", "Statement of purpose", "Curriculum vitae"], skillsGained: ["Research", "Laboratory or Computational Methods", "Cross-cultural Communication"], careerPaths: ["Research", "Graduate School", "Science and Engineering"], stipendAmount: 1000, duration: "2-6 months", nextReviewAt: "2026-11-12",
  }),
  buildRecord({
    id: "scholarship--knight-hennessy-scholars-2027",
    aliases: ["KHS", "Knight-Hennessy Scholarship"],
    title: "Knight-Hennessy Scholars",
    type: "Scholarship", category: "Fellowships",
    description: "Up to three years of graduate funding at Stanford plus a multidisciplinary leadership program. Applicants submit separate applications to Knight-Hennessy and an eligible full-time Stanford graduate program.",
    organization: "Stanford University",
    majors: ["Any Major"], years: ["Fourth year", "Graduate student"],
    eligibility: "Applicants from any country and field who earned or will earn their first bachelor's degree in January 2020 or later, including current students graduating by September 2027, and who apply to an eligible full-time Stanford graduate program for 2027 entry.",
    estimatedValue: null, valueNote: "Unknown - funding covers up to three years of eligible Stanford graduate study, but value depends on the degree program and individual support.",
    deadline: "2026-10-06", deadlineType: "fixed", cycle: "2027-cohort", lifecycleState: "open",
    location: "Stanford, California", remote: false, paid: true,
    tags: ["Scholarship", "Fellowship", "Graduate School", "Leadership", "International", "Any Major"],
    source: "https://knight-hennessy.stanford.edu/admission",
    sourceReferences: [
      source("https://knight-hennessy.stanford.edu/admission/before-you-apply/eligibility", ["academic_level", "institution_type", "enrollment_status", "school_restriction", "external_student_eligibility", "class_year", "major", "citizenship"], "The official eligibility page confirms degree timing, eligible Stanford graduate enrollment paths, and worldwide eligibility without field restrictions."),
      source("https://knight-hennessy.stanford.edu/admission", ["application_status", "deadline"], "The official admissions page confirms the 2027 application is open and closes October 6, 2026 at 1 p.m. Pacific."),
    ],
    rules: { educationLevels: ["undergraduate", "graduate", "recent_graduate"], canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college", "graduate_school"], canonicalEnrollmentStatuses: ["currently_enrolled", "graduated"], acceptsExternalStudents: true, classYears: ["Fourth year", "Graduate student"], majors: ["Any Major"], citizenshipStatuses: ["international_allowed"], availability: "open", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["Applicants must separately apply to and enroll in an eligible full-time Stanford graduate program."] },
    reviewerNotes: "Current official Stanford pages confirm a common deadline and international access. The record is limited to fourth-year and graduate profiles; students must still meet the selected Stanford program's admission requirements.",
    difficulty: "Highly Competitive", prestige: "Very High", estimatedApplicationTime: "1-2 weeks", applicationRequirements: ["Knight-Hennessy application", "Separate eligible Stanford graduate application", "Resume", "Transcripts", "Essays and short answers", "Recommendations"], skillsGained: ["Leadership", "Interdisciplinary Collaboration", "Graduate Study"], careerPaths: ["Graduate School", "Public Service", "Research", "Leadership"], nextReviewAt: "2026-10-07",
  }),
  buildRecord({
    id: "scholarship--rhodes-scholarship-united-states-2027",
    aliases: ["Rhodes Scholarship USA", "Rhodes Scholarship U.S."],
    title: "Rhodes Scholarship for the United States",
    type: "Scholarship", category: "Fellowships",
    description: "Fully funded postgraduate study at the University of Oxford for U.S.-constituency applicants who meet the published citizenship, age, degree, and course-entry rules.",
    organization: "Rhodes Trust",
    majors: ["Any Major"], years: ["Fourth year", "Graduate student"],
    eligibility: "U.S. citizens or lawful permanent residents who meet the 2027 age rules and will complete an undergraduate degree by July 2027 with an academic record that meets their chosen full-time Oxford course requirements.",
    estimatedValue: null, valueNote: "Unknown - the scholarship funds covered Oxford study and related support, with total value depending on course and tenure.",
    deadline: "2026-10-07", deadlineType: "fixed", cycle: "2027-entry", lifecycleState: "open",
    location: "Oxford, United Kingdom", remote: false, paid: true,
    tags: ["Scholarship", "Fellowship", "Graduate School", "International Study", "Any Major"],
    source: "https://www.rhodeshouse.ox.ac.uk/scholarships/applications/united-states/",
    sourceReferences: [
      source("https://www.rhodeshouse.ox.ac.uk/scholarships/applications/united-states/eligibilitycriteria/", ["academic_level", "institution_type", "enrollment_status", "school_restriction", "external_student_eligibility", "class_year", "major", "citizenship", "age"], "The official U.S. constituency eligibility checker confirms citizenship/permanent residence, age, degree completion, and Oxford course-entry requirements."),
      source("https://www.rhodeshouse.ox.ac.uk/scholarships/applications/united-states/", ["application_status", "deadline"], "The official U.S. constituency page confirms applications opened July 1 and close October 7, 2026."),
    ],
    rules: { educationLevels: ["undergraduate", "graduate", "recent_graduate"], canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college", "graduate_school"], canonicalEnrollmentStatuses: ["currently_enrolled", "graduated"], acceptsExternalStudents: true, classYears: ["Fourth year", "Graduate student"], majors: ["Any Major"], citizenshipStatuses: ["us_citizen", "permanent_resident"], ageRange: { minimum: 18, maximum: 23 }, availability: "open", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["The structured age range uses the standard 18-23 route; the official later-graduate exception remains visible on the source but is not broadened in ranking."] },
    reviewerNotes: "The record uses the standard U.S. constituency route and intentionally omits DACA/inter-jurisdictional and older-recent-graduate exceptions that cannot be represented safely in the current profile model.",
    difficulty: "Highly Competitive", prestige: "Very High", estimatedApplicationTime: "1-2 weeks", applicationRequirements: ["Online application", "Oxford course selection", "Academic transcript", "Personal and academic statements", "References"], skillsGained: ["Graduate Study", "Leadership", "Cross-cultural Communication"], careerPaths: ["Graduate School", "Research", "Public Service", "Leadership"], nextReviewAt: "2026-10-08",
  }),
  buildRecord({
    id: "career--nasa-space-apps",
    aliases: ["NASA Space Apps", "NASA International Space Apps Challenge"],
    title: "NASA International Space Apps Challenge",
    type: "Career", category: "Competitions",
    description: "A global challenge where participants form teams and build solutions using NASA and partner-agency data. The 2026 event begins November 14 at registered local and virtual locations.",
    organization: "NASA",
    majors: ["Any Major"], years: undergraduateYears,
    eligibility: "Participants worldwide across ages, skill levels, and professional backgrounds may register; participants under 18 need parent or guardian registration and accompaniment. U.S. federal civil servants cannot register as participants.",
    estimatedValue: null, valueNote: "Unknown - recognition depends on challenge judging and no guaranteed cash award is published.",
    deadline: null, deadlineType: "varies", cycle: "2026-challenge", lifecycleState: "open",
    location: "Global local and virtual event locations", remote: null, paid: false,
    tags: ["Competition", "International", "First-Year Friendly", "Teamwork", "Any Major", "NASA"],
    source: "https://www.spaceappschallenge.org/legal/",
    sourceReferences: [
      source("https://www.spaceappschallenge.org/legal/", ["academic_level", "institution_type", "enrollment_status", "school_restriction", "external_student_eligibility", "class_year", "major", "citizenship", "age", "application_status"], "The official 2026 participant terms confirm registration, worldwide event structure, November 14 start, guardian rules for minors, and the federal-civil-servant exclusion."),
      source("https://www.nasa.gov/learning-resources/nasa-stem-opportunities-activities/", ["major", "citizenship", "external_student_eligibility"], "NASA's official STEM opportunities page describes Space Apps as open globally across ages, skill levels, and backgrounds."),
    ],
    rules: { educationLevels: ["undergraduate"], canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"], canonicalEnrollmentStatuses: ["currently_enrolled"], acceptsExternalStudents: true, classYears: undergraduateYears, majors: ["Any Major"], citizenshipStatuses: ["international_allowed"], availability: "open", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["Official 2026 participant terms and NASA program overview reviewed on 2026-08-14."] },
    reviewerNotes: "The event date and participant registration requirement are current. No exact registration deadline is claimed; deadline metadata remains varies rather than inventing a date.",
    difficulty: "Open", prestige: "High", estimatedApplicationTime: "15-30 minutes", applicationRequirements: ["Space Apps account", "Event registration before the local event begins", "Parent or guardian registration for participants under 18"], skillsGained: ["Teamwork", "Problem Solving", "Data Communication", "Prototyping"], careerPaths: ["Technology", "Research", "Design", "Public Service"], recurrence: "annual", reviewCadenceDays: 30, nextReviewAt: "2026-09-13",
  }),
] satisfies Opportunity[];

const acceptedById = new Map(acceptedRecords.map((record) => [record.id, record]));

function accepted(id: string, groups: string[], gaps: string[], effort: "low" | "medium" | "high" = "medium"): OpportunityAcquisitionCandidate {
  const record = acceptedById.get(id);
  if (!record) throw new Error(`Missing accepted acquisition record ${id}.`);
  return { id, title: record.title, organization: record.organization, type: record.type, targetStudentGroups: groups, coverageGaps: gaps, sourceUrls: record.metadata.sourceReferences?.map((item) => item.url) ?? [record.official_source_url], verificationEffort: effort, quality: record.prestige === "Very High" ? "very_high" : "high", lifecycleStability: record.metadata.deadlineType === "rolling" ? "high" : "medium", broadEligibility: record.majors.includes("Any Major"), status: "recommendation_safe", disposition: "accepted", dispositionReason: "Current official sources prove actionable lifecycle and structured eligibility.", record };
}

function rejected(input: Omit<OpportunityAcquisitionCandidate, "status" | "record">): OpportunityAcquisitionCandidate {
  return { ...input, status: "rejected" };
}

export const opportunityAcquisitionCandidates: OpportunityAcquisitionCandidate[] = [
  accepted("scholarship--fund-for-education-abroad", ["undergraduates with financial need", "study-abroad students"], ["scholarship", "first year"], "low"),
  accepted("career--hacu-national-internship-program-spring-2027", ["second-year and later students", "public-service students"], ["internship", "social sciences"], "medium"),
  accepted("research--ista-year-round-scientific-internships", ["STEM undergraduates", "international students", "recent graduates"], ["research", "internship", "international"], "low"),
  accepted("research--oist-research-internship-spring-2027", ["advanced STEM undergraduates", "international students"], ["research", "internship", "international"], "medium"),
  accepted("research--kaust-visiting-student-research-program", ["advanced STEM undergraduates", "international students"], ["research", "internship", "international"], "low"),
  accepted("scholarship--knight-hennessy-scholars-2027", ["graduating seniors", "international students", "graduate-school applicants"], ["scholarship", "fellowship", "international", "humanities", "social sciences"], "medium"),
  accepted("scholarship--rhodes-scholarship-united-states-2027", ["graduating seniors", "U.S. graduate-school applicants"], ["scholarship", "fellowship", "humanities", "social sciences"], "medium"),
  accepted("career--nasa-space-apps", ["first-year students", "international students", "all majors"], ["competition", "first year", "international"], "medium"),
  rejected({ id: "candidate--wege-prize-2027", title: "Wege Prize 2027", organization: "Kendall College of Art and Design", type: "Career", targetStudentGroups: ["global university students", "multidisciplinary teams"], coverageGaps: ["competition", "international", "first year"], sourceUrls: ["https://www.wegeprize.org/2027-info-guide", "https://www.wegeprize.org/apply"], verificationEffort: "medium", quality: "high", lifecycleStability: "high", broadEligibility: true, disposition: "conflicting_official_sources", dispositionReason: "The 2027 guide says applications open August 3, while the official application page still says the exact fall opening is to be determined.", sourceWatch: { sourceUrl: "https://www.wegeprize.org/apply", expectedReviewAt: "2026-09-01", reason: "Recheck when the application page confirms the 2027 portal is open." } }),
  rejected({ id: "candidate--d-prize-global-competition", title: "D-Prize Global Competition", organization: "D-Prize", type: "Career", targetStudentGroups: ["student entrepreneurs", "international students"], coverageGaps: ["competition", "international"], sourceUrls: ["https://d-prize.org/"], verificationEffort: "low", quality: "high", lifecycleStability: "high", broadEligibility: true, disposition: "current_cycle_unavailable", dispositionReason: "The official page says the next competition launches in fall 2026 but does not yet provide an open application.", sourceWatch: { sourceUrl: "https://d-prize.org/", expectedReviewAt: "2026-09-15", reason: "Check for the next competition launch and exact deadlines." } }),
  rejected({ id: "candidate--fulbright-us-student-2027-28", title: "Fulbright U.S. Student Program", organization: "U.S. Department of State", type: "Scholarship", targetStudentGroups: ["graduating seniors", "recent graduates"], coverageGaps: ["fellowship", "humanities", "social sciences"], sourceUrls: ["https://us.fulbrightonline.org/about/eligibility"], verificationEffort: "high", quality: "very_high", lifecycleStability: "high", broadEligibility: true, disposition: "variable_position_eligibility", dispositionReason: "Baseline eligibility is current, but country and award descriptions add material eligibility rules that cannot be proven for a generic program recommendation.", sourceWatch: { sourceUrl: "https://us.fulbrightonline.org/applicants/award-search", expectedReviewAt: "2026-08-28", reason: "Acquire individual awards only when country-specific eligibility can be modeled." } }),
  rejected({ id: "candidate--twc-academic-internship-spring-2027", title: "Academic Internship Program", organization: "The Washington Center", type: "Career", targetStudentGroups: ["sophomores and above", "international students", "policy students"], coverageGaps: ["internship", "social sciences", "international"], sourceUrls: ["https://twc.edu/programs/academic-internship-program"], verificationEffort: "high", quality: "established", lifecycleStability: "high", broadEligibility: true, disposition: "eligibility_unclear", dispositionReason: "The official page states affiliated schools may impose additional eligibility requirements, so a universal school-level eligibility claim is not safe.", sourceWatch: { sourceUrl: "https://twc.edu/programs/academic-internship-program", expectedReviewAt: "2026-10-01", reason: "Revisit if school-specific requirements become structured in UnlockED." } }),
  rejected({ id: "candidate--venturewell-e-team-winter-2027", title: "VentureWell E-Team Program", organization: "VentureWell", type: "Career", targetStudentGroups: ["student inventors", "entrepreneurship teams"], coverageGaps: ["competition", "first year"], sourceUrls: ["https://venturewell.org/e-team-program/"], verificationEffort: "high", quality: "high", lifecycleStability: "high", broadEligibility: false, disposition: "institution_membership_unproven", dispositionReason: "A team needs a qualifying U.S. institution, faculty support, and VentureWell membership before the full proposal; current profiles cannot prove those conditions.", sourceWatch: { sourceUrl: "https://venturewell.org/e-team-program/", expectedReviewAt: "2026-11-09", reason: "Keep for future school-membership and team-eligibility modeling." } }),
  rejected({ id: "candidate--oecd-internship", title: "OECD Internship Programme", organization: "OECD", type: "Career", targetStudentGroups: ["policy students", "economics students", "international students"], coverageGaps: ["internship", "social sciences", "international"], sourceUrls: ["https://www.oecd.org/en/about/careers/internships.html"], verificationEffort: "high", quality: "high", lifecycleStability: "high", broadEligibility: false, disposition: "variable_position_eligibility", dispositionReason: "Non-member-country eligibility is limited to specific projects, and the generic rolling program cannot prove a student's nationality/project fit.", sourceWatch: { sourceUrl: "https://www.oecd.org/en/about/careers/internships.html", expectedReviewAt: "2026-11-12", reason: "Acquire only vacancies with explicit nationality and discipline rules." } }),
  rejected({ id: "candidate--putnam-2026", title: "William Lowell Putnam Mathematical Competition", organization: "Mathematical Association of America", type: "Career", targetStudentGroups: ["undergraduate mathematics students", "international students at North American institutions"], coverageGaps: ["competition", "first year", "international"], sourceUrls: ["https://maa.org/putnam/"], verificationEffort: "low", quality: "very_high", lifecycleStability: "high", broadEligibility: false, disposition: "current_cycle_unavailable", dispositionReason: "The 2026 contest is confirmed, but student registration does not open until September 8, 2026.", sourceWatch: { sourceUrl: "https://maa.org/putnam/", expectedReviewAt: "2026-09-08", reason: "Promote when student registration opens." } }),
  rejected({ id: "candidate--ppia-jsi-2027", title: "PPIA Junior Summer Institute", organization: "Public Policy and International Affairs Program", type: "Career", targetStudentGroups: ["public-policy students", "rising seniors"], coverageGaps: ["fellowship", "social sciences"], sourceUrls: ["https://www.ppiaprogram.org/JSI"], verificationEffort: "low", quality: "very_high", lifecycleStability: "high", broadEligibility: false, disposition: "current_cycle_unavailable", dispositionReason: "The official page says the prior cycle concluded and the 2027 application opens later in 2026.", sourceWatch: { sourceUrl: "https://www.ppiaprogram.org/JSI", expectedReviewAt: "2026-11-01", reason: "Check for the 2027 opening and campus-specific rules." } }),
  rejected({ id: "candidate--loc-junior-fellows-2027", title: "Library of Congress Junior Fellows Program", organization: "Library of Congress", type: "Career", targetStudentGroups: ["humanities students", "library and archives students"], coverageGaps: ["internship", "humanities", "fellowship"], sourceUrls: ["https://www.loc.gov/internships-and-fellowships/overview/junior-fellows-program/"], verificationEffort: "low", quality: "very_high", lifecycleStability: "high", broadEligibility: true, disposition: "current_cycle_unavailable", dispositionReason: "The official page projects the next application window for late 2026; it is not currently open.", sourceWatch: { sourceUrl: "https://www.loc.gov/internships-and-fellowships/overview/junior-fellows-program/", expectedReviewAt: "2026-10-26", reason: "Verify the 2027 cycle when the application opens." } }),
  rejected({ id: "candidate--phi-kappa-phi-study-abroad", title: "Phi Kappa Phi Study Abroad Grant", organization: "The Honor Society of Phi Kappa Phi", type: "Scholarship", targetStudentGroups: ["study-abroad students"], coverageGaps: ["scholarship", "first year"], sourceUrls: ["https://www.phikappaphi.org/grants-awards/study-abroad"], verificationEffort: "low", quality: "established", lifecycleStability: "high", broadEligibility: true, disposition: "current_cycle_unavailable", dispositionReason: "The current cycle is closed; the official page says the next application opens December 15, 2026.", sourceWatch: { sourceUrl: "https://www.phikappaphi.org/grants-awards/study-abroad", expectedReviewAt: "2026-12-15", reason: "Verify the next cycle and deadline when applications open." } }),
  rejected({ id: "candidate--outreachy-december-2026", title: "Outreachy Internship", organization: "Software Freedom Conservancy", type: "Career", targetStudentGroups: ["open-source contributors", "international students"], coverageGaps: ["internship", "international"], sourceUrls: ["https://www.outreachy.org/"], verificationEffort: "medium", quality: "high", lifecycleStability: "high", broadEligibility: false, disposition: "current_cycle_unavailable", dispositionReason: "The official site has not yet published complete applicant rules for the December 2026 cohort.", sourceWatch: { sourceUrl: "https://www.outreachy.org/", expectedReviewAt: "2026-08-31", reason: "Recheck when the December 2026 application and contribution period are published." } }),
  rejected({ id: "candidate--rangel-graduate-fellowship", title: "Rangel Graduate Fellowship", organization: "Howard University", type: "Scholarship", targetStudentGroups: ["public-service seniors", "international-affairs students"], coverageGaps: ["fellowship", "social sciences"], sourceUrls: ["https://rangelprogram.org/graduate-fellowship-program/overview-eligibility/"], verificationEffort: "low", quality: "very_high", lifecycleStability: "high", broadEligibility: false, disposition: "current_cycle_unavailable", dispositionReason: "The official program reports the current selection cycle postponed pending U.S. Department of State direction.", sourceWatch: { sourceUrl: "https://rangelprogram.org/graduate-fellowship-program/overview-eligibility/", expectedReviewAt: "2026-10-15", reason: "Recheck for an official reopening notice." } }),
  rejected({ id: "candidate--jack-kent-cooke-transfer-2027", title: "Cooke Undergraduate Transfer Scholarship", organization: "Jack Kent Cooke Foundation", type: "Scholarship", targetStudentGroups: ["community-college transfer students"], coverageGaps: ["scholarship", "transfer"], sourceUrls: ["https://www.jkcf.org/our-scholarships/"], verificationEffort: "low", quality: "very_high", lifecycleStability: "high", broadEligibility: false, disposition: "duplicate", dispositionReason: "A canonical transfer-scholarship record already exists in UnlockED and is scheduled to open August 19, 2026.", sourceWatch: { sourceUrl: "https://www.jkcf.org/our-scholarships/", expectedReviewAt: "2026-08-19", reason: "Update the existing canonical record when the application opens." } }),
];

export const opportunityAcquisitionBatch = { batchId, verifiedAt, records: acceptedRecords } as const;
