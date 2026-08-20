import type { Opportunity } from "./opportunities";
import type { OpportunityAcquisitionCandidate, OpportunityCandidateDisposition } from "./opportunity-acquisition";
import { acquisitionSource, buildAcquisitionRecord, type OpportunityAcquisitionRecordSpec } from "./opportunity-acquisition-batch";

const context = { batchId: "catalog-breakthrough-2026-08-breadth-wave", verifiedAt: "2026-08-20" };
const allYears = ["First year", "Second year", "Third year", "Fourth year"];
const broadMajors = ["Any Major"];
const policyMajors = ["Political Science", "Public Policy", "International Relations", "Economics", "History", "English", "Journalism", "Communications", "Business"];
const serviceMajors = ["Public Policy", "Political Science", "Emergency Management", "Criminal Justice", "Environmental Science", "Social Work", "Sociology", "Public Health"];
const evidence = ["academic_level", "institution_type", "enrollment_status", "school_restriction", "external_student_eligibility", "class_year", "major", "citizenship", "residency", "gpa", "age", "financial_need", "invitation", "application_status", "deadline"] as const;
const source = (url: string, note: string, cycle: string) => acquisitionSource(url, [...evidence], note, context, cycle);
const record = (spec: OpportunityAcquisitionRecordSpec) => buildAcquisitionRecord(spec, context);

const acceptedRecords = [
  record({
    id: "career--tfas-spring-washington-fellowship-2027",
    aliases: ["TFAS Spring Fellowship", "Capital Semester Spring"],
    title: "TFAS Spring Washington Fellowship",
    type: "Career", category: "Fellowships",
    description: "A fully funded semester in Washington with a guaranteed internship, accredited coursework, professional mentoring, and a completion stipend.",
    organization: "The Fund for American Studies",
    majors: policyMajors, years: allYears,
    eligibility: "Undergraduates age 18 or older who have completed at least one college semester. Structured recommendations are limited to U.S. citizens and permanent residents; TFAS separately publishes requirements for eligible F-1 students.",
    estimatedValue: 1000, valueNote: "Full program tuition and furnished housing plus a $1,000 completion stipend; TFAS does not publish one combined retail value.",
    deadline: "2026-10-21", deadlineType: "fixed", cycle: "spring-2027", lifecycleState: "open",
    location: "Washington, DC", remote: false, paid: true,
    tags: ["Fellowship", "Internship", "Washington DC", "Public Policy", "Journalism", "Business", "Fully Funded"],
    source: "https://semester.connect.dcinternships.org/",
    sourceReferences: [source("https://semester.connect.dcinternships.org/", "The official Spring Fellowship page confirms the January 20-April 29, 2027 session, October 21 final deadline, full tuition and housing, $1,000 stipend, internship, credits, age, and one-semester requirement.", "spring-2027")],
    rules: { educationLevels: ["undergraduate", "community_college"], canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"], canonicalEnrollmentStatuses: ["currently_enrolled"], acceptsExternalStudents: true, classYears: allYears, majors: policyMajors, citizenshipStatuses: ["us_citizen", "permanent_resident"], ageRange: { minimum: 18 }, transferEligibility: "general_undergraduate", availability: "open", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["The public program accepts all majors; Pro ranking is conservatively limited to the four published academic tracks.", "Recommendations use the final deadline and a narrower domestic eligibility rule than the program's separately documented F-1 pathway."] },
    reviewerNotes: "Current official session, funding, deadline, and baseline eligibility were reviewed. The early and priority deadlines remain visible on the source, while the catalog stores the final deadline.",
    difficulty: "Competitive", prestige: "High", estimatedApplicationTime: "3-5 hours",
    applicationRequirements: ["Online application", "Personal statement", "Resume", "Transcript"],
    skillsGained: ["Professional Communication", "Policy Analysis", "Networking"], careerPaths: ["Public Policy", "Government", "Journalism", "Business"], expectedROI: "A funded academic semester, guaranteed internship experience, and a Washington professional network.",
    recommendedMajors: policyMajors, recommendedClassYears: allYears, duration: "14 weeks", recurrence: "annual", nextReviewAt: "2026-10-22",
  }),
  record({
    id: "career--tfas-summer-academic-internship-2027",
    aliases: ["DC Internships Summer", "TFAS Summer Academic Internship Program"],
    title: "TFAS Summer Academic Internship Program",
    type: "Career", category: "Internships",
    description: "An eight-week Washington program combining a guaranteed internship with accredited coursework in policy, international affairs, journalism, or business.",
    organization: "The Fund for American Studies",
    majors: policyMajors, years: allYears,
    eligibility: "Undergraduates from any year who are age 18 or older and have completed at least one college semester. International students are accepted through a separate published application timeline.",
    estimatedValue: null, valueNote: "Unknown - TFAS publishes program costs and need-based awards but no single guaranteed net value.",
    deadline: "2026-10-08", deadlineType: "fixed", cycle: "summer-2027-international", lifecycleState: "open",
    location: "Washington, DC", remote: false, paid: null,
    tags: ["Internship", "Washington DC", "International Students", "Public Policy", "Journalism", "International Affairs", "Business"],
    source: "https://www.dcinternships.org/",
    sourceReferences: [
      source("https://www.dcinternships.org/", "The official program page confirms the June 2-July 31, 2027 session, four academic tracks, guaranteed internship, 250 or more internship hours, housing, and credits.", "summer-2027"),
      source("https://www.dcinternships.org/about/faq/", "The official FAQ confirms all undergraduate years, age 18, one completed college semester, no formal GPA requirement, and an October 8 international deadline.", "summer-2027"),
    ],
    rules: { educationLevels: ["undergraduate", "community_college"], canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"], canonicalEnrollmentStatuses: ["currently_enrolled"], acceptsExternalStudents: true, classYears: allYears, majors: policyMajors, citizenshipStatuses: ["international_allowed"], ageRange: { minimum: 18 }, transferEligibility: "general_undergraduate", availability: "open", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["The public program accepts all majors; Pro ranking is conservatively limited to the four published academic tracks.", "The October 8 international deadline is used for all recommendations so international students never receive the later domestic timeline incorrectly."] },
    reviewerNotes: "The program accepts domestic and international students. The conservative international deadline is stored globally; domestic applicants can verify later rounds on the official page.",
    difficulty: "Competitive", prestige: "High", estimatedApplicationTime: "3-5 hours",
    applicationRequirements: ["Online application", "Personal statement", "Resume", "Transcript"], skillsGained: ["Professional Communication", "Networking", "Applied Policy or Business Experience"], careerPaths: ["Public Policy", "International Affairs", "Journalism", "Business"], expectedROI: "A structured Washington internship with academic credit and professional development.",
    recommendedMajors: policyMajors, recommendedClassYears: allYears, duration: "8 weeks", recurrence: "annual", nextReviewAt: "2026-10-09",
  }),
  record({
    id: "fellowship--fulbright-us-student-2027-28",
    aliases: ["Fulbright U.S. Student Program", "Fulbright Study Research Award", "Fulbright English Teaching Assistant Award"],
    title: "Fulbright U.S. Student Program",
    type: "Career", category: "Fellowships",
    description: "International study, research, or English-teaching awards for graduating seniors and recent graduates in more than 140 countries.",
    organization: "U.S. Department of State",
    majors: broadMajors, years: ["Fourth year"],
    eligibility: "U.S. citizens or nationals who will hold a bachelor's degree or equivalent before the grant begins and meet the requirements of their selected country and award.",
    estimatedValue: null, valueNote: "Unknown - grant benefits and living support vary by host country and award.",
    deadline: "2026-10-06", deadlineType: "fixed", cycle: "2027-28", lifecycleState: "open",
    location: "More than 140 countries", remote: false, paid: true,
    tags: ["Fellowship", "International", "Research", "Teaching", "Graduate Study", "Any Major"],
    source: "https://us.fulbrightonline.org/about/competition-selection",
    sourceReferences: [
      source("https://us.fulbrightonline.org/about/competition-selection", "The official competition page confirms that the 2027-28 cycle is open and closes October 6, 2026 at 5:00 p.m. Eastern Time.", "2027-28"),
      source("https://new-us.fulbrightonline.org/about/eligibility", "The official eligibility page confirms U.S. citizenship or nationality and the bachelor's-degree requirement by the grant start.", "2027-28"),
    ],
    rules: { educationLevels: ["undergraduate", "recent_graduate"], canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college"], canonicalEnrollmentStatuses: ["currently_enrolled", "graduated"], acceptsExternalStudents: true, classYears: ["Fourth year"], majors: broadMajors, citizenshipStatuses: ["us_citizen"], transferEligibility: "general_undergraduate", availability: "open", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["Current undergraduates are limited to fourth-year profiles because the official rules require a bachelor's degree before the grant begins."] },
    reviewerNotes: "Country-specific language, affiliation, and award rules remain on the official award pages and must be checked before applying. The catalog does not claim eligibility for a particular country.",
    difficulty: "Highly Competitive", prestige: "Very High", estimatedApplicationTime: "1-2 weeks",
    applicationRequirements: ["Country and award selection", "Project or grant statement", "Personal statement", "Transcripts", "Recommendations", "Language evaluation where required"], skillsGained: ["Cross-cultural Communication", "Research or Teaching", "Independent Project Planning"], careerPaths: ["Research", "Education", "Public Service", "International Affairs"], expectedROI: "A funded international research, study, or teaching experience with significant academic and professional value.",
    recommendedMajors: broadMajors, recommendedClassYears: ["Fourth year"], recurrence: "annual", nextReviewAt: "2026-10-07",
  }),
  record({
    id: "career--americorps-fema-corps-2027",
    aliases: ["FEMA Corps", "AmeriCorps NCCC FEMA Corps Member"],
    title: "AmeriCorps FEMA Corps",
    type: "Career", category: "Leadership Programs",
    description: "A ten-month, full-time national service program supporting disaster preparedness, response, and recovery while traveling with a team across the United States.",
    organization: "AmeriCorps and FEMA",
    majors: serviceMajors, years: allYears,
    eligibility: "U.S. citizens age 18-24 who can serve full time for ten months, travel throughout the United States, and meet the program's background and service requirements.",
    estimatedValue: 7300, valueNote: "Education award of more than $7,300 after successful service, plus housing, meals, travel, health benefits, and a living allowance.",
    deadline: "2026-10-19", deadlineType: "fixed", cycle: "winter-2027", lifecycleState: "open",
    location: "United States; travel required", remote: false, paid: true,
    tags: ["National Service", "Disaster Response", "Leadership", "Any Major", "Education Award", "First-Year Friendly"],
    source: "https://www.americorps.gov/serve/americorps/americorps-nccc/fema-corps",
    sourceReferences: [source("https://www.americorps.gov/serve/americorps/americorps-nccc/fema-corps", "The official FEMA Corps page confirms the open July 1-October 19 application, February 2027 start, age 18-24, U.S. citizenship, ten-month full-time service, travel, benefits, and education award.", "winter-2027")],
    rules: { educationLevels: ["undergraduate", "community_college", "recent_graduate"], canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"], canonicalEnrollmentStatuses: ["currently_enrolled", "graduated"], acceptsExternalStudents: true, classYears: allYears, majors: serviceMajors, citizenshipStatuses: ["us_citizen"], ageRange: { minimum: 18, maximum: 24 }, transferEligibility: "general_undergraduate", availability: "open", recommendationEligibilityStatus: "eligible_for_ranking", evidence: ["The public program accepts all majors; Pro ranking is conservatively limited to public-service and emergency-response fields.", "This is a full-time service commitment rather than a conventional semester internship; recommendations retain that tradeoff explicitly."] },
    reviewerNotes: "FEMA Corps is broad-access and current, but participation can interrupt enrollment. The details page must remain clear about the ten-month full-time travel commitment.",
    difficulty: "Competitive", prestige: "High", estimatedApplicationTime: "3-5 hours",
    applicationRequirements: ["AmeriCorps application", "Eligibility documentation", "Background screening"], skillsGained: ["Emergency Management", "Team Leadership", "Public Service", "Project Operations"], careerPaths: ["Emergency Management", "Public Service", "Nonprofit Leadership", "Government"], expectedROI: "Living support, practical disaster-response experience, and an education award exceeding $7,300.",
    recommendedMajors: serviceMajors, recommendedClassYears: allYears, duration: "10 months", recurrence: "annual", nextReviewAt: "2026-10-20",
  }),
] satisfies Opportunity[];

const acceptedById = new Map(acceptedRecords.map((item) => [item.id, item]));
const acceptedCandidate = (id: string, gaps: string[]): OpportunityAcquisitionCandidate => {
  const item = acceptedById.get(id);
  if (!item) throw new Error(`Missing breadth-wave record ${id}.`);
  return { id, title: item.title, organization: item.organization, type: item.type, targetStudentGroups: ["undergraduate students"], coverageGaps: gaps, sourceUrls: item.metadata.sourceReferences?.map((entry) => entry.url) ?? [item.official_source_url], verificationEffort: "high", quality: item.prestige === "Very High" ? "very_high" : "high", lifecycleStability: "high", broadEligibility: item.majors.includes("Any Major"), status: "recommendation_safe", disposition: "accepted", dispositionReason: "Current first-party sources prove the active cycle and all eligibility dimensions used for ranking.", record: item };
};

type Deferred = readonly [id: string, title: string, organization: string, url: string, disposition: Exclude<OpportunityCandidateDisposition, "accepted">, reason: string, reviewAt: string, gap: string];
const deferredPrograms: Deferred[] = [
  ["nih-sip-2027", "NIH Summer Internship Program", "National Institutes of Health", "https://www.training.nih.gov/research-training/pb/sip/", "current_cycle_unavailable", "The next application is scheduled to open in mid-November and is not yet actionable.", "2026-11-16", "health"],
  ["nci-summer-2027", "NCI Summer Internship Program", "National Cancer Institute", "https://www.cancer.gov/grants-training/training/at-nci", "current_cycle_unavailable", "No current 2027 undergraduate application window is published.", "2026-11-16", "health"],
  ["cdc-fellowships-2027", "CDC Student Internships and Fellowships", "Centers for Disease Control and Prevention", "https://jobs.cdc.gov/working-at-cdc/student-intern-jobs/index.html", "variable_position_eligibility", "The official hub routes to position-specific vacancies with different eligibility.", "2026-10-15", "health"],
  ["nist-surf-2027", "NIST SURF", "National Institute of Standards and Technology", "https://www.nist.gov/surf", "current_cycle_unavailable", "The next undergraduate cycle and deadline are not yet published.", "2026-11-15", "research"],
  ["noaa-hollings-2027", "NOAA Hollings Scholarship", "NOAA", "https://www.noaa.gov/office-education/hollings-scholarship", "current_cycle_unavailable", "The next application does not open until September.", "2026-09-02", "scholarship"],
  ["noaa-lapenta-2027", "NOAA Lapenta Internship", "NOAA", "https://www.noaa.gov/office-education/lapenta-internship-program", "current_cycle_unavailable", "A current open application cycle could not be verified.", "2026-11-01", "research"],
  ["epa-pathways-2027", "EPA Student Internships", "Environmental Protection Agency", "https://www.epa.gov/careers/student-internships", "variable_position_eligibility", "Eligibility and deadlines vary by live Pathways vacancy.", "2026-10-01", "environment"],
  ["usda-wallace-carver-2027", "Wallace-Carver Fellowship", "USDA", "https://www.usda.gov/youth/career", "current_cycle_unavailable", "The next cycle is not currently open on the official source.", "2026-11-01", "agriculture"],
  ["nara-internships-2027", "National Archives Internships", "National Archives", "https://www.archives.gov/careers/internships", "current_cycle_unavailable", "No current nationally reusable undergraduate application is open.", "2026-10-15", "humanities"],
  ["loc-junior-fellows-2027-b7", "Library of Congress Junior Fellows", "Library of Congress", "https://www.loc.gov/item/internships/junior-fellows-program/", "current_cycle_unavailable", "The 2027 application is not yet open.", "2026-10-15", "humanities"],
  ["loc-loci-2027", "Library of Congress Internship", "Library of Congress", "https://www.loc.gov/internships-and-fellowships/", "current_cycle_unavailable", "Current openings and eligibility must be captured by individual program cycle.", "2026-10-15", "humanities"],
  ["smithsonian-apac-2027-b7", "Smithsonian APAC Internship", "Smithsonian Institution", "https://www.si.edu/ofi", "current_cycle_unavailable", "The next application cycle does not open until January.", "2027-01-05", "humanities"],
  ["white-house-internship-2027", "White House Internship Program", "The White House", "https://www.whitehouse.gov/get-involved/internships/", "current_cycle_unavailable", "No current undergraduate cycle could be verified.", "2026-10-15", "policy"],
  ["fed-board-internships-2027", "Federal Reserve Board Internships", "Federal Reserve Board", "https://www.federalreserve.gov/careers-internships.htm", "variable_position_eligibility", "Majors, work authorization, and deadlines vary by vacancy.", "2026-09-15", "finance"],
  ["sec-student-honors-2027", "SEC Student Honors Program", "U.S. Securities and Exchange Commission", "https://www.sec.gov/careers/student-honors-program", "variable_position_eligibility", "Eligibility and openings vary by semester and position.", "2026-10-01", "finance"],
  ["udall-2027", "Udall Undergraduate Scholarship", "Udall Foundation", "https://www.udall.gov/OurPrograms/Scholarship/Scholarship.aspx", "current_cycle_unavailable", "The next competition opens October 15 and requires institutional nomination.", "2026-10-16", "scholarship"],
  ["goldwater-2027-b7", "Goldwater Scholarship", "Goldwater Foundation", "https://goldwaterscholarship.gov/", "institution_membership_unproven", "Institutional nomination and research-career evidence cannot be proven from the current profile.", "2026-09-15", "scholarship"],
  ["truman-2027-b7", "Truman Scholarship", "Harry S. Truman Scholarship Foundation", "https://www.truman.gov/apply", "institution_membership_unproven", "Institutional nomination and sustained public-service evidence are required.", "2026-09-15", "scholarship"],
  ["gates-scholarship-2027-b7", "The Gates Scholarship", "The Gates Scholarship", "https://www.thegatesscholarship.org/scholarship", "graduate_only", "The program is for high-school seniors, not current undergraduates.", "2027-07-01", "scholarship"],
  ["point-scholarship-2027-b7", "Point Foundation Scholarship", "Point Foundation", "https://pointfoundation.org/point-apply/apply-now", "current_cycle_unavailable", "The next application has not opened yet.", "2026-09-10", "scholarship"],
  ["horatio-alger-2027", "Horatio Alger National Scholarship", "Horatio Alger Association", "https://scholars.horatioalger.org/scholarships/", "graduate_only", "The national award primarily targets high-school students.", "2027-01-01", "scholarship"],
  ["coca-cola-scholars-2027", "Coca-Cola Scholars Program", "Coca-Cola Scholars Foundation", "https://www.coca-colascholarsfoundation.org/apply/", "graduate_only", "The scholarship is restricted to high-school seniors.", "2027-08-01", "scholarship"],
  ["amazon-future-engineer-2027", "Amazon Future Engineer Scholarship", "Amazon", "https://www.amazonfutureengineer.com/scholarships", "graduate_only", "The scholarship targets high-school seniors entering college.", "2027-10-01", "scholarship"],
  ["brooke-owens-2027", "Brooke Owens Fellowship", "Brooke Owens Fellowship", "https://www.brookeowensfellowship.org/apply", "current_cycle_unavailable", "The next application cycle is not currently open.", "2026-09-15", "fellowship"],
  ["voyager-scholarship-2027", "Voyager Scholarship", "Obama Foundation", "https://www.obama.org/programs/voyager-scholarship/", "current_cycle_unavailable", "A current cycle and application deadline could not be verified.", "2027-01-15", "scholarship"],
  ["cls-2027", "Critical Language Scholarship", "U.S. Department of State", "https://clscholarship.org/apply", "current_cycle_unavailable", "The next application window is not yet open.", "2026-10-01", "language"],
  ["boren-2027-b7", "Boren Awards", "National Security Education Program", "https://www.borenawards.org/", "eligibility_unclear", "Current cycle details and institution-specific campus deadlines are not sufficiently stable for one national deadline.", "2026-09-15", "language"],
  ["rangel-2027", "Rangel Undergraduate Summer Enrichment Program", "U.S. Department of State", "https://rangelprogram.org/summer-enrichment-program/", "current_cycle_unavailable", "The program has not published an actionable next cycle.", "2026-10-01", "policy"],
  ["pickering-2027", "Thomas R. Pickering Foreign Affairs Graduate Fellowship", "U.S. Department of State", "https://pickeringfellowship.org/", "graduate_only", "The fellowship funds graduate study and is not a general undergraduate opportunity.", "2027-01-01", "policy"],
  ["payne-2027", "Donald M. Payne International Development Fellowship", "USAID", "https://paynefellows.org/", "graduate_only", "The fellowship supports graduate study and requires a bachelor's degree by enrollment.", "2027-01-01", "policy"],
  ["gilman-b7", "Gilman International Scholarship", "U.S. Department of State", "https://www.gilmanscholarship.org/", "duplicate", "An existing verified canonical record already covers this program.", "2026-10-10", "scholarship"],
  ["cooke-transfer-b7", "Cooke Undergraduate Transfer Scholarship", "Jack Kent Cooke Foundation", "https://www.jkcf.org/our-scholarships/undergraduate-transfer-scholarship/", "duplicate", "An existing verified canonical record already covers this program.", "2026-10-10", "transfer"],
  ["smart-b7", "SMART Scholarship-for-Service", "U.S. Department of Defense", "https://www.smartscholarship.org/smart", "duplicate", "An existing verified canonical record already covers this program.", "2026-12-01", "scholarship"],
  ["fea-b7", "Fund for Education Abroad Scholarship", "Fund for Education Abroad", "https://fundforeducationabroad.org/apply/", "duplicate", "An existing verified canonical record already covers this program.", "2026-09-17", "scholarship"],
  ["brookings-internship-2027", "Brookings Internship Program", "Brookings Institution", "https://www.brookings.edu/careers/internships/", "current_cycle_unavailable", "The currently displayed application window is closed.", "2026-10-15", "policy"],
  ["urban-institute-2027", "Urban Institute Internships", "Urban Institute", "https://www.urban.org/about/careers", "variable_position_eligibility", "The official careers page exposes role-specific openings rather than one reusable student program.", "2026-10-01", "policy"],
  ["rand-internships-2027", "RAND Student Opportunities", "RAND Corporation", "https://www.rand.org/jobs/internships.html", "variable_position_eligibility", "Degree, citizenship, location, and deadline vary by position.", "2026-10-01", "policy"],
  ["aei-internship-2027", "AEI Internship Program", "American Enterprise Institute", "https://www.aei.org/internships/", "current_cycle_unavailable", "A current nationally actionable cycle could not be verified.", "2026-10-01", "policy"],
  ["csis-internships-2027", "CSIS Internships", "Center for Strategic and International Studies", "https://careers.csis.org/", "variable_position_eligibility", "Eligibility and deadlines differ by live vacancy.", "2026-09-15", "policy"],
  ["atlantic-council-2027", "Atlantic Council Young Global Professionals", "Atlantic Council", "https://www.atlanticcouncil.org/careers/internships/", "current_cycle_unavailable", "The next cycle is not open yet.", "2026-10-01", "policy"],
  ["carnegie-endowment-2027", "Carnegie Endowment Internships", "Carnegie Endowment for International Peace", "https://carnegieendowment.org/about/employment", "variable_position_eligibility", "Openings are role-specific and do not share stable eligibility.", "2026-10-01", "policy"],
  ["met-internships-b7", "Metropolitan Museum of Art Internships", "The Metropolitan Museum of Art", "https://www.metmuseum.org/about-the-met/internships", "duplicate", "An existing catalog identity already covers this program family.", "2026-10-01", "humanities"],
  ["getty-marrow-2027", "Getty Marrow Undergraduate Internships", "Getty Foundation", "https://www.getty.edu/projects/getty-marrow-undergraduate-internships/", "current_cycle_unavailable", "The next cycle is not currently open.", "2026-11-01", "humanities"],
  ["national-gallery-2027-b7", "National Gallery of Art Internships", "National Gallery of Art", "https://www.nga.gov/internships", "current_cycle_unavailable", "No current undergraduate-relevant window is open.", "2026-10-01", "humanities"],
  ["moma-internships-2027", "MoMA Internships", "Museum of Modern Art", "https://www.moma.org/about/careers/internships", "current_cycle_unavailable", "No current reusable undergraduate cycle could be verified.", "2026-10-01", "humanities"],
  ["goldman-summer-analyst-2027", "2027 Summer Analyst Program", "Goldman Sachs", "https://www.goldmansachs.com/careers/students/programs/americas/summer-analyst-program", "eligibility_unclear", "The official program is open, but work authorization and division-specific requirements cannot be positively proven from the generic record.", "2026-09-15", "finance"],
  ["blackrock-summer-2027", "BlackRock Summer Internship Program", "BlackRock", "https://careers.blackrock.com/students-and-graduates", "variable_position_eligibility", "Country, function, year, and authorization requirements vary by position.", "2026-09-15", "finance"],
  ["jpm-early-insights-2027", "JPMorgan Early Insights", "JPMorgan Chase", "https://careers.jpmorgan.com/us/en/students/programs", "variable_position_eligibility", "The program hub contains distinct roles with different eligibility and deadlines.", "2026-09-15", "finance"],
  ["cfa-research-challenge-2027", "CFA Institute Research Challenge", "CFA Institute", "https://www.cfainstitute.org/insights/professional-learning/refresher-readings/research-challenge", "institution_membership_unproven", "Participation requires an institution-sponsored team and local host arrangements.", "2026-09-15", "finance"],
  ["imagine-cup-2027", "Microsoft Imagine Cup", "Microsoft", "https://imaginecup.microsoft.com/", "eligibility_unclear", "Registration is visible but complete 2027 rules and stage deadlines are not yet authoritative enough for ranking.", "2026-09-15", "competition"],
  ["hult-prize-2027-b7", "Hult Prize", "Hult Prize Foundation", "https://www.hultprize.org/", "institution_membership_unproven", "Team and campus pathway requirements cannot be proven from an individual profile.", "2026-09-15", "competition"],
  ["millennium-fellowship-2027", "Millennium Fellowship", "United Nations Academic Impact and MCN", "https://www.millenniumfellows.org/", "current_cycle_unavailable", "The current application is closed.", "2027-01-15", "leadership"],
  ["ppia-2027-b7", "PPIA Junior Summer Institute", "Public Policy and International Affairs Program", "https://ppiaprogram.org/page/junior-summer-institute", "current_cycle_unavailable", "The next cycle has not opened yet.", "2026-09-15", "policy"],
  ["americorps-forest-corps-2027", "AmeriCorps NCCC Forest Corps", "AmeriCorps", "https://www.americorps.gov/serve/americorps/americorps-nccc/forest-corps", "current_cycle_unavailable", "The next application opens in November.", "2026-11-01", "first year"],
  ["americorps-nccc-2027", "AmeriCorps NCCC Traditional Corps", "AmeriCorps", "https://www.americorps.gov/serve/americorps/americorps-nccc", "current_cycle_unavailable", "The next relevant application window is not currently open.", "2026-11-01", "first year"],
  ["mlh-fellowship-2027", "MLH Fellowship", "Major League Hacking", "https://fellowship.mlh.io/", "eligibility_unclear", "Track-specific technical prerequisites and current cohort timing cannot be proven as one stable opportunity.", "2026-09-15", "computing"],
  ["microsoft-student-ambassadors-2027", "Microsoft Learn Student Ambassadors", "Microsoft", "https://mvp.microsoft.com/studentambassadors", "eligibility_unclear", "Country, account, age, and active-student requirements need a current complete rules source before ranking.", "2026-09-15", "computing"],
];

const deferredCandidates = deferredPrograms.map(([id, title, organization, url, disposition, reason, reviewAt, gap]): OpportunityAcquisitionCandidate => ({
  id: `candidate--${id}`, title, organization, type: gap === "scholarship" || gap === "transfer" ? "Scholarship" : gap === "research" || gap === "health" ? "Research" : "Career",
  targetStudentGroups: ["undergraduate students"], coverageGaps: [gap], sourceUrls: [url], verificationEffort: "medium", quality: "high", lifecycleStability: "medium", broadEligibility: false,
  status: "rejected", disposition, dispositionReason: reason, sourceWatch: { sourceUrl: url, expectedReviewAt: reviewAt, reason: `Recheck the official source on ${reviewAt}.` },
}));

export const opportunityAcquisitionCandidatesBatch7 = [
  acceptedCandidate("career--tfas-spring-washington-fellowship-2027", ["humanities", "social sciences", "policy", "fellowship"]),
  acceptedCandidate("career--tfas-summer-academic-internship-2027", ["humanities", "social sciences", "international", "internship"]),
  acceptedCandidate("fellowship--fulbright-us-student-2027-28", ["humanities", "research", "senior", "fellowship"]),
  acceptedCandidate("career--americorps-fema-corps-2027", ["first year", "public service", "leadership"]),
  ...deferredCandidates,
];

export const opportunityAcquisitionBatch7 = { batchId: context.batchId, verifiedAt: context.verifiedAt, records: acceptedRecords } as const;
