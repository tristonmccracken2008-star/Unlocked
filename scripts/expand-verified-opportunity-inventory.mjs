import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "data", "db", "opportunities.json");
const catalogSource = process.env.UNLOCKED_CATALOG_BASE === "HEAD"
  ? execFileSync("git", ["show", "HEAD:data/db/opportunities.json"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(catalogPath, "utf8");
const catalog = JSON.parse(catalogSource);
const verifiedAt = "2026-08-08";

const undergraduateYears = ["First year", "Second year", "Third year", "Fourth year"];
const stemMajors = [
  "Computer Science", "Data Science", "Mathematics", "Statistics", "Engineering",
  "Aerospace Engineering", "Biomedical Engineering", "Chemical Engineering", "Civil Engineering",
  "Computer Engineering", "Electrical Engineering", "Environmental Engineering", "Industrial Engineering",
  "Materials Science", "Mechanical Engineering", "Nuclear Engineering", "Physics", "Chemistry",
  "Biology", "Environmental Science", "Earth Science",
];

function date(kind, value, sourceUrl) {
  return {
    kind,
    sourceValue: value,
    normalizedValue: value,
    precision: "date",
    estimated: false,
    verifiedAt,
    sourceUrl,
  };
}

function lifecycle({ id, cycle, state, reason, sourceUrl, evidence, openingDate, deadline, recurrence = "annual" }) {
  return {
    schemaVersion: 1,
    migrationId: "verified-inventory-2026-08-08",
    identity: { identityId: id },
    cycle: { cycleId: cycle, label: cycle },
    state,
    confidence: "confirmed",
    reason,
    effectiveAt: `${verifiedAt}T00:00:00.000Z`,
    ...(openingDate ? { openingDate: date("application_open", openingDate, sourceUrl) } : {}),
    ...(deadline ? { finalDeadline: date("final_deadline", deadline, sourceUrl) } : {}),
    recurrence: { type: recurrence, confidence: "confirmed", officialStatement: evidence },
    evidence: [{
      id: `${id}:${cycle}:official`,
      source: state === "upcoming" ? "official_opening_date" : "official_application_page",
      observedAt: `${verifiedAt}T00:00:00.000Z`,
      value: evidence,
      sourceUrl,
      confidence: "confirmed",
    }],
    events: [],
    sourceChecks: [{ url: sourceUrl, checkedAt: `${verifiedAt}T00:00:00.000Z`, classification: "official_application", status: 200 }],
    fieldVerifiedAt: {
      state: verifiedAt,
      deadline: verifiedAt,
      applicationUrl: verifiedAt,
      openingDate: verifiedAt,
      eligibility: verifiedAt,
      award: verifiedAt,
      location: verifiedAt,
      programDates: verifiedAt,
      description: verifiedAt,
    },
    review: { note: evidence, reviewedAt: `${verifiedAt}T00:00:00.000Z`, reviewer: "UnlockED catalog audit" },
  };
}

function verification(sourceUrl, cycle, notes, deadlineVerified = true) {
  return {
    status: "verified",
    lastVerifiedAt: verifiedAt,
    verifiedCycle: cycle,
    officialSourceUrl: sourceUrl,
    applicationUrlVerified: true,
    deadlineVerified,
    eligibilityVerified: true,
    sourceReachable: true,
    sourceAuditStatus: 200,
    notes,
  };
}

function upsert(record) {
  const index = catalog.findIndex((item) => item.id === record.id);
  if (index >= 0) catalog[index] = record;
  else catalog.push(record);
}

function update(id, patch) {
  const index = catalog.findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Missing catalog record: ${id}`);
  catalog[index] = patch(catalog[index]);
}

function baseRecord({ id, title, type, category, description, organization, majors, years, eligibility, value, valueNote, deadline, location, remote, paid, tags, source, difficulty, prestige, metadata }) {
  return {
    id,
    title,
    type,
    category,
    description,
    organization,
    school_scope: "National",
    schools: [],
    majors,
    academic_years: years,
    eligibility,
    estimated_value: value,
    application_deadline: deadline,
    recurring: true,
    location,
    remote,
    paid,
    tags,
    official_source: source,
    official_source_url: source,
    verification_status: "verified",
    last_verified: verifiedAt,
    deadline,
    reviewer_notes: metadata.verification.notes,
    estimated_value_note: valueNote,
    date_added: verifiedAt,
    difficulty,
    prestige,
    icon: type.toLowerCase(),
    featured: false,
    hidden_gem: false,
    metadata,
  };
}

const seoSource = "https://career.seo-usa.org/apply-faq/";
const seoNotes = "SEO Career's official FAQ confirms rolling applications for first-year, sophomore, and junior students at accredited four-year U.S. institutions, with a published 3.2 GPA standard and U.S. work authorization requirement.";
upsert(baseRecord({
  id: "career--seo-career-program",
  title: "SEO Career",
  type: "Career",
  category: "Career Resources",
  description: "A structured career-development program that prepares undergraduates for competitive internships through training, coaching, and employer access. First-year through junior students who meet the published GPA and work-authorization rules can submit the official rolling application.",
  organization: "SEO Career",
  majors: ["Any Major"],
  years: ["First year", "Second year", "Third year"],
  eligibility: "Current first-year, sophomore, or junior at an accredited four-year U.S. college or university with at least a 3.2 GPA and authorization to work in the United States.",
  value: null,
  valueNote: "Unknown — the official source does not publish a single monetary value for program participation.",
  deadline: null,
  location: "United States / virtual and employer-based programming",
  remote: null,
  paid: null,
  tags: ["Career Development", "Internship Preparation", "Coaching", "Any Major", "Rolling"],
  source: seoSource,
  difficulty: "Competitive",
  prestige: "High",
  metadata: {
    deadlineType: "rolling",
    compensation: "Varies",
    workMode: "Varies",
    estimatedApplicationTime: "1-2 hours",
    skillsGained: ["Interviewing", "Networking", "Professional Communication"],
    careerPaths: ["Business", "Technology", "Consulting"],
    eligibilityRules: {
      educationLevels: ["undergraduate"],
      canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: ["First year", "Second year", "Third year"],
      majors: ["Any Major"],
      minimumGpa: 3.2,
      citizenshipStatuses: ["us_work_authorized"],
      availability: "rolling",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [seoNotes],
    },
    verification: verification(seoSource, "Rolling 2026-27", seoNotes, false),
    lifecycle: lifecycle({ id: "career--seo-career-program", cycle: "rolling-2026-27", state: "rolling", reason: "rolling_confirmed", sourceUrl: seoSource, evidence: "The official FAQ states that applications are accepted year-round on a rolling basis.", recurrence: "rolling_cohort" }),
  },
}));

const nreipSource = "https://www.navalsteminterns.us/nreip/index.html";
const nreipNotes = "The official NREIP site confirms the August 1–November 1 annual application window, full-time four-year enrollment, rising-sophomore standing, relevant STEM study, U.S. citizenship, and published undergraduate stipends.";
upsert(baseRecord({
  id: "research--naval-research-enterprise-internship-program",
  title: "Naval Research Enterprise Internship Program",
  type: "Research",
  category: "Government & National Labs",
  description: "A ten-week paid summer research internship at a participating U.S. Navy laboratory. Eligible four-year STEM students who will be rising sophomores or above can choose laboratory interests and apply through the official NREIP portal.",
  organization: "U.S. Navy",
  majors: stemMajors,
  years: ["Second year", "Third year", "Fourth year"],
  eligibility: "U.S. citizens enrolled full time at an accredited four-year college or university who will be rising sophomores or above and study a field relevant to a participating laboratory.",
  value: 7500,
  valueNote: "$7,500 published stipend for new undergraduate participants; returning undergraduate participants receive $9,000.",
  deadline: "2026-11-01",
  location: "Participating U.S. Navy laboratories",
  remote: false,
  paid: true,
  tags: ["Research", "STEM", "Government", "National Labs", "Paid", "Summer"],
  source: nreipSource,
  difficulty: "Highly Competitive",
  prestige: "Very High",
  metadata: {
    deadlineType: "fixed",
    compensation: "Paid",
    workMode: "In Person",
    professor: null,
    department: "Naval Research Enterprise Internship Program",
    researchArea: "Science and engineering research at participating U.S. Navy laboratories",
    stipendAmount: 7500,
    semesters: ["Summer"],
    estimatedApplicationTime: "3-5 hours",
    internshipDuration: "10 weeks",
    skillsGained: ["Research", "Technical Communication", "Laboratory Practice"],
    careerPaths: ["Research", "Engineering", "Public Service"],
    eligibilityRules: {
      educationLevels: ["undergraduate"],
      canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: ["Second year", "Third year", "Fourth year"],
      majors: stemMajors,
      citizenshipStatuses: ["us_citizen"],
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [nreipNotes],
    },
    verification: verification(nreipSource, "Summer 2027", nreipNotes),
    lifecycle: lifecycle({ id: "research--naval-research-enterprise-internship-program", cycle: "summer-2027", state: "open", reason: "official_status_open", sourceUrl: nreipSource, evidence: "The official program page lists applications from August 1 through November 1 each year.", deadline: "2026-11-01" }),
  },
}));

const mcmSource = "https://www.contest.comap.com/undergraduate/contests/mcm/instructions.php";
const mcmNotes = "COMAP's official 2027 instructions confirm undergraduate participation, teams of up to three from one institution, advisor registration, and the January 28, 2027 registration deadline.";
upsert(baseRecord({
  id: "career--comap-mcm-icm-2027",
  title: "COMAP Mathematical Contest in Modeling",
  type: "Career",
  category: "Competitions",
  description: "An international team competition where students model a complex real-world problem and communicate a defensible solution. Undergraduates from any major can form a team of up to three, ask a faculty member to register as adviser, and complete registration on COMAP's official site.",
  organization: "COMAP",
  majors: ["Any Major"],
  years: undergraduateYears,
  eligibility: "Current undergraduate students may compete in teams of up to three students from the same institution; a faculty, staff, or administrator adviser must register the team.",
  value: null,
  valueNote: "Unknown — recognition varies by final award level and no guaranteed cash value is published.",
  deadline: "2027-01-28",
  location: "Remote team competition",
  remote: true,
  paid: false,
  tags: ["Competition", "Modeling", "Teamwork", "Problem Solving", "Any Major", "Remote"],
  source: mcmSource,
  difficulty: "Competitive",
  prestige: "High",
  metadata: {
    deadlineType: "fixed",
    compensation: "Unpaid",
    workMode: "Remote",
    estimatedApplicationTime: "15-30 minutes",
    skillsGained: ["Quantitative Modeling", "Teamwork", "Technical Writing"],
    careerPaths: ["Data Science", "Research", "Consulting"],
    eligibilityRules: {
      educationLevels: ["undergraduate"],
      canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: undergraduateYears,
      majors: ["Any Major"],
      citizenshipStatuses: ["unrestricted"],
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [mcmNotes],
    },
    verification: verification(mcmSource, "2027 contest", mcmNotes),
    lifecycle: lifecycle({ id: "career--comap-mcm-icm-2027", cycle: "2027-contest", state: "open", reason: "official_status_open", sourceUrl: mcmSource, evidence: "The official 2027 contest instructions provide an active registration process and a January 28 deadline.", deadline: "2027-01-28" }),
  },
}));

const forteSource = "https://www.fortefoundation.org/college/career-ready-certificate/";
const forteNotes = "Forté's official Career Ready Certificate page lists the Fall 2026 cohort, an October 18 join deadline, and access for undergraduate students of all majors and class years worldwide.";
upsert(baseRecord({
  id: "career--forte-career-ready-certificate",
  title: "Forté Career Ready Certificate",
  type: "Career",
  category: "Certifications",
  description: "A structured career-readiness program covering professional skills, networking, and internship preparation. Current undergraduates of any major or class year can review the published cohort schedule and join through Forté's official application.",
  organization: "Forté Foundation",
  majors: ["Any Major"],
  years: undergraduateYears,
  eligibility: "Current undergraduate students of any major and class year at colleges and universities worldwide may participate; the published program fee and cohort dates apply.",
  value: null,
  valueNote: "Unknown — the program publishes a $150 participation fee rather than a guaranteed monetary award.",
  deadline: "2026-10-18",
  location: "Online",
  remote: true,
  paid: false,
  tags: ["Career Development", "Certification", "Networking", "Internship Preparation", "Any Major", "Online"],
  source: forteSource,
  difficulty: "Open",
  prestige: "Established",
  metadata: {
    deadlineType: "fixed",
    compensation: "Unpaid",
    workMode: "Remote",
    pricing: "$150; fee waivers may be available through participating institutions.",
    estimatedApplicationTime: "15-30 minutes",
    skillsGained: ["Networking", "Professional Communication", "Career Preparation"],
    careerPaths: ["Business", "Consulting", "Technology"],
    eligibilityRules: {
      educationLevels: ["undergraduate"],
      canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: undergraduateYears,
      majors: ["Any Major"],
      citizenshipStatuses: ["unrestricted"],
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [forteNotes],
    },
    verification: verification(forteSource, "Fall 2026", forteNotes),
    lifecycle: lifecycle({ id: "career--forte-career-ready-certificate", cycle: "fall-2026", state: "open", reason: "official_status_open", sourceUrl: forteSource, evidence: "The official page lists a Fall 2026 cohort and October 18 as the final day to join.", deadline: "2026-10-18", recurrence: "seasonal" }),
  },
}));

const jplSource = "https://www.jpl.nasa.gov/edu/internships/apply/jpl-year-round-internship-program/";
const jplNotes = "JPL's official page confirms year-round applications, undergraduate or graduate STEM enrollment, a 3.0 GPA, U.S. citizenship or lawful permanent residence, and monetary awards.";
upsert(baseRecord({
  id: "research--jpl-year-round-internship",
  title: "JPL Year-Round Internship Program",
  type: "Research",
  category: "Government & National Labs",
  description: "Paid academic-year and summer placements let students contribute to science and engineering work at NASA's Jet Propulsion Laboratory. Eligible STEM undergraduates and graduate students can submit a resume and transcript through JPL's year-round application.",
  organization: "NASA Jet Propulsion Laboratory",
  majors: stemMajors,
  years: [...undergraduateYears, "Graduate student"],
  eligibility: "Current undergraduate or graduate STEM and STEM-adjacent students with at least a 3.0 GPA who are U.S. citizens or lawful permanent residents.",
  value: null,
  valueNote: "Unknown — the official source confirms a monetary award but does not publish one standard amount.",
  deadline: null,
  location: "Pasadena, California",
  remote: false,
  paid: true,
  tags: ["Research", "NASA", "JPL", "STEM", "Paid", "Year Round"],
  source: jplSource,
  difficulty: "Highly Competitive",
  prestige: "Very High",
  metadata: {
    deadlineType: "rolling",
    compensation: "Paid",
    workMode: "In Person",
    professor: null,
    department: "Jet Propulsion Laboratory Education Office",
    researchArea: "Space science, engineering, and STEM-adjacent research",
    stipendAmount: null,
    semesters: ["Fall", "Spring", "Summer"],
    estimatedApplicationTime: "1-2 hours",
    skillsGained: ["Research", "Engineering", "Technical Communication"],
    careerPaths: ["Research", "Engineering", "Space Science"],
    eligibilityRules: {
      educationLevels: ["undergraduate", "graduate"],
      canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college", "graduate_school"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: [...undergraduateYears, "Graduate student"],
      majors: stemMajors,
      minimumGpa: 3,
      citizenshipStatuses: ["us_citizen", "permanent_resident"],
      availability: "rolling",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [jplNotes],
    },
    verification: verification(jplSource, "Year-round 2026-27", jplNotes, false),
    lifecycle: lifecycle({ id: "research--jpl-year-round-internship", cycle: "rolling-2026-27", state: "rolling", reason: "rolling_confirmed", sourceUrl: jplSource, evidence: "The official JPL page states that opportunities are offered year-round.", recurrence: "rolling_cohort" }),
  },
}));

const daadSource = "https://www.daad.de/rise/en/rise-germany/find-an-internship/what-applicants-need-to-know/";
const daadNotes = "DAAD's official RISE Germany page confirms the October 15–November 30, 2026 application window, eligible countries and fields, undergraduate standing, and the published monthly scholarship package.";
upsert(baseRecord({
  id: "research--daad-rise-germany-2027",
  title: "DAAD RISE Germany",
  type: "Research",
  category: "Study Abroad",
  description: "A funded summer research placement with a German university or research institution. Eligible undergraduates in the listed science and engineering fields can browse projects and apply through the official DAAD portal once the 2027 window opens.",
  organization: "German Academic Exchange Service (DAAD)",
  majors: ["Biology", "Chemistry", "Computer Science", "Physics", "Earth Science", "Environmental Science", "Engineering"],
  years: ["Second year", "Third year"],
  eligibility: "Current undergraduates at eligible four-year institutions in the United States, Canada, the United Kingdom, or Ireland who will have completed at least two years by the internship and remain undergraduates afterward; listed science and engineering fields apply.",
  value: null,
  valueNote: "Unknown total — the official source publishes €992 per month plus insurance and travel support, with total value varying by placement length and origin.",
  deadline: "2026-11-30",
  location: "Germany",
  remote: false,
  paid: true,
  tags: ["Research", "Study Abroad", "STEM", "Germany", "Funded", "Summer"],
  source: daadSource,
  difficulty: "Highly Competitive",
  prestige: "Very High",
  metadata: {
    deadlineType: "fixed",
    compensation: "Paid",
    workMode: "In Person",
    professor: null,
    department: "DAAD RISE Germany",
    researchArea: "Biology, chemistry, computer science, physics, earth science, and engineering research",
    stipendAmount: 992,
    semesters: ["Summer"],
    salaryEstimate: "€992 per month plus insurance and travel support",
    estimatedApplicationTime: "3-5 hours",
    skillsGained: ["Research", "Cross-Cultural Communication", "Technical Communication"],
    careerPaths: ["Research", "Graduate School", "Engineering"],
    eligibilityRules: {
      educationLevels: ["undergraduate"],
      canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: ["Second year", "Third year"],
      majors: ["Biology", "Chemistry", "Computer Science", "Physics", "Earth Science", "Environmental Science", "Engineering"],
      citizenshipStatuses: ["international_allowed"],
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [daadNotes],
    },
    verification: verification(daadSource, "Summer 2027", daadNotes),
    lifecycle: lifecycle({ id: "research--daad-rise-germany-2027", cycle: "summer-2027", state: "upcoming", reason: "opening_date_future", sourceUrl: daadSource, evidence: "The official page lists the 2027 application period from October 15 through November 30, 2026.", openingDate: "2026-10-15", deadline: "2026-11-30" }),
  },
}));

const gwiSource = "https://www.girlswhoinvest.org/apply-faq";
const gwiNotes = "Girls Who Invest's official application FAQ confirms first-year and sophomore eligibility across all majors and gender identities, eligible institution rules, and 2027 priority and final deadlines.";
upsert(baseRecord({
  id: "career--girls-who-invest-scholars-2027",
  title: "Girls Who Invest Scholars Program",
  type: "Career",
  category: "Fellowships",
  description: "A tuition-free educational program that introduces first-year and sophomore students to investment management and professional networks. Eligible students of any major or gender identity can prepare now and apply through the official portal when the 2027 application opens.",
  organization: "Girls Who Invest",
  majors: ["Any Major"],
  years: ["First year", "Second year"],
  eligibility: "Current first-year or sophomore students of any major and gender identity at an eligible four-year U.S. or U.S.-style institution, with graduation between fall 2028 and spring 2030 for the 2027 cycle.",
  value: null,
  valueNote: "Unknown — the educational program is tuition-free, but no guaranteed cash award is published.",
  deadline: "2026-10-15",
  location: "United States / hybrid program options",
  remote: null,
  paid: false,
  tags: ["Finance", "Investment Management", "Career Development", "Fellowship", "Any Major"],
  source: gwiSource,
  difficulty: "Highly Competitive",
  prestige: "High",
  metadata: {
    deadlineType: "fixed",
    compensation: "Unpaid",
    workMode: "Varies",
    estimatedApplicationTime: "3-5 hours",
    skillsGained: ["Finance", "Networking", "Investment Analysis"],
    careerPaths: ["Investment Management", "Finance", "Business"],
    eligibilityRules: {
      educationLevels: ["undergraduate"],
      canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: ["First year", "Second year"],
      majors: ["Any Major"],
      citizenshipStatuses: ["international_allowed"],
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [gwiNotes],
    },
    verification: verification(gwiSource, "2027 program", gwiNotes),
    lifecycle: lifecycle({ id: "career--girls-who-invest-scholars-2027", cycle: "2027-program", state: "upcoming", reason: "opening_date_future", sourceUrl: gwiSource, evidence: "The official FAQ says the 2027 application will be available in late summer 2026 and publishes October 15 as the final deadline.", deadline: "2026-10-15" }),
  },
}));

function enrichExisting(id, fields) {
  update(id, (item) => ({
    ...item,
    ...fields,
    official_source: fields.official_source,
    official_source_url: fields.official_source,
    verification_status: "verified",
    last_verified: verifiedAt,
    deadline: fields.application_deadline,
    reviewer_notes: fields.metadata.verification.notes,
    metadata: { ...item.metadata, ...fields.metadata },
  }));
}

const suliSource = "https://science.osti.gov/wdts/suli/How-to-Apply";
const suliNotes = "DOE's official SULI eligibility and application pages confirm the Spring 2027 deadline, enrollment and credit rules, 3.0 GPA, age 18 requirement, and U.S.-citizen or lawful-permanent-resident eligibility.";
enrichExisting("research--doe-suli", {
  description: "A paid research appointment at a Department of Energy national laboratory. Eligible undergraduates and recent graduates in STEM fields can identify preferred laboratories, prepare transcripts and references, and apply through DOE's official portal.",
  eligibility: "Current undergraduates or qualifying recent graduates with required coursework, at least a 3.0 GPA, age 18 by the internship start, and U.S. citizenship or lawful permanent residence.",
  application_deadline: "2026-09-30",
  official_source: suliSource,
  metadata: {
    deadlineType: "fixed",
    claimUrl: suliSource,
    eligibilityRules: {
      educationLevels: ["undergraduate", "recent_graduate"],
      canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled", "graduated"],
      classYears: ["Second year", "Third year", "Fourth year"],
      majors: stemMajors,
      minimumGpa: 3,
      ageRange: { minimum: 18 },
      citizenshipStatuses: ["us_citizen", "permanent_resident"],
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [suliNotes],
    },
    verification: verification(suliSource, "Spring 2027", suliNotes),
    lifecycle: lifecycle({ id: "research--doe-suli", cycle: "spring-2027", state: "open", reason: "official_status_open", sourceUrl: suliSource, evidence: "DOE's official application page lists Spring 2027 applications as open through September 30, 2026.", deadline: "2026-09-30", recurrence: "semester" }),
  },
});

const nasaSource = "https://www.nasa.gov/learning-resources/internship-programs/";
const nasaNotes = "NASA's official internship and FAQ pages confirm paid OSTEM placements, broad major access, U.S. citizenship, age 16, 3.0 GPA, accredited enrollment, and the Spring 2027 deadline.";
enrichExisting("national-curated-2026--nasa--nasa-ostem-internships", {
  description: "Paid, project-based internships let students contribute to NASA missions with guidance from agency mentors. Eligible students in STEM and non-STEM fields can browse current projects and apply through NASA's official STEM Gateway before the published session deadline.",
  eligibility: "U.S. citizens age 16 or older with at least a 3.0 GPA who are enrolled full or part time in a certificate or degree program at an accredited U.S. technical school, college, or university.",
  application_deadline: "2026-09-14",
  official_source: nasaSource,
  metadata: {
    deadlineType: "fixed",
    claimUrl: nasaSource,
    eligibilityRules: {
      educationLevels: ["community_college", "undergraduate", "graduate"],
      canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college", "graduate_school"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: [...undergraduateYears, "Graduate student"],
      majors: ["Any Major"],
      minimumGpa: 3,
      ageRange: { minimum: 16 },
      citizenshipStatuses: ["us_citizen"],
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [nasaNotes],
    },
    verification: verification(nasaSource, "Spring 2027", nasaNotes),
    lifecycle: lifecycle({ id: "national-curated-2026--nasa--nasa-ostem-internships", cycle: "spring-2027", state: "open", reason: "official_status_open", sourceUrl: nasaSource, evidence: "NASA's official internship page lists the Spring 2027 application deadline as September 14, 2026.", deadline: "2026-09-14", recurrence: "semester" }),
  },
});

const smartSource = "https://www.smartscholarship.org/smart";
const smartNotes = "Official SMART materials confirm annual applications beginning August 1, full tuition, a $30,000–$46,000 annual stipend, internships, and post-graduation DoD employment. Ranking is conservatively limited to verified U.S.-citizen profiles because the current profile model cannot represent every partner-country citizenship category.";
enrichExisting("scholarship--dod-smart-scholarship", {
  description: "A scholarship-for-service program covering tuition and providing a stipend, summer internships, mentoring, and a Department of Defense employment pathway. Eligible STEM students who understand the service commitment can apply through the official SMART portal during the annual cycle.",
  eligibility: "U.S.-citizen undergraduate or graduate students in an eligible STEM discipline with at least a 3.0 GPA, age 18 by the program's required date, and the ability to complete the degree and service commitments.",
  estimated_value: null,
  estimated_value_note: "Unknown total — official SMART materials publish full tuition plus a $30,000–$46,000 annual stipend and additional allowances, with total value varying by participant.",
  application_deadline: null,
  official_source: smartSource,
  metadata: {
    deadlineType: "varies",
    claimUrl: smartSource,
    awardAmountLabel: "Full tuition plus $30,000–$46,000 annual stipend",
    eligibilityRules: {
      educationLevels: ["undergraduate", "graduate"],
      canonicalInstitutionTypes: ["four_year_college", "university", "liberal_arts_college", "graduate_school"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: [...undergraduateYears, "Graduate student"],
      majors: stemMajors,
      minimumGpa: 3,
      ageRange: { minimum: 18 },
      citizenshipStatuses: ["us_citizen"],
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [smartNotes],
    },
    verification: verification(smartSource, "2027 award cycle", smartNotes, false),
    lifecycle: lifecycle({ id: "scholarship--dod-smart-scholarship", cycle: "2027-award", state: "open", reason: "official_status_open", sourceUrl: smartSource, evidence: "Official SMART materials state that the annual application opens August 1; no single final deadline was stored because current official references conflict.", recurrence: "annual" }),
  },
});

const gilmanSource = "https://www.gilmanscholarship.org/applicants/deadlines-and-timeline/";
const gilmanNotes = "The official Gilman pages confirm up to $5,000, U.S.-citizen undergraduate and Federal Pell Grant eligibility, and an October 1, 2026 deadline for the cycle opening in mid-August.";
enrichExisting("scholarship--gilman-scholarship", {
  description: "A federal scholarship of up to $5,000 that helps Pell Grant recipients study or intern abroad. Eligible U.S. undergraduates can prepare essays and adviser certifications now, then apply through the official Gilman portal when the fall cycle opens.",
  eligibility: "U.S. citizen undergraduates receiving a Federal Pell Grant who are applying to or accepted into an eligible credit-bearing study-abroad or international internship program.",
  application_deadline: "2026-10-01",
  official_source: gilmanSource,
  metadata: {
    deadlineType: "fixed",
    claimUrl: gilmanSource,
    eligibilityRules: {
      educationLevels: ["undergraduate"],
      canonicalInstitutionTypes: ["community_college", "four_year_college", "university", "liberal_arts_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      classYears: undergraduateYears,
      majors: ["Any Major"],
      citizenshipStatuses: ["us_citizen"],
      financialNeedRequired: true,
      demographicRequirements: ["pell_grant_recipient"],
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [gilmanNotes],
    },
    verification: verification(gilmanSource, "October 2026", gilmanNotes),
    lifecycle: lifecycle({ id: "scholarship--gilman-scholarship", cycle: "october-2026", state: "upcoming", reason: "opening_date_future", sourceUrl: gilmanSource, evidence: "The official timeline states that the application opens in mid-August 2026 and closes October 1, 2026; no exact opening day is published.", deadline: "2026-10-01" }),
  },
});

const cookeId = "national-curated-2026--jack-kent-cooke-foundation--jack-kent-cooke-undergraduate-transfer-scholarship";
const cookeSource = "https://www.jkcf.org/our-scholarships/undergraduate-transfer-scholarship/how-to-apply/";
const cookeNotes = "The official Cooke Foundation pages confirm the August 19–December 9, 2026 cycle, community-college sophomore or recent-graduate status, fall 2027 transfer plan, 3.5 GPA, financial-need limit, no citizenship restriction, and awards up to $55,000 per year.";
enrichExisting(cookeId, {
  description: "A major transfer scholarship providing up to $55,000 per year plus advising for high-achieving community-college students. Eligible sophomores and recent graduates planning a fall 2027 transfer can prepare Common App materials now and apply through the official foundation process after August 19.",
  eligibility: "Current U.S. community-college sophomores by January 1, 2027 or qualifying recent graduates, planning full-time fall 2027 transfer, with at least a 3.5 GPA and demonstrated unmet financial need; U.S. citizenship is not required.",
  estimated_value: 55000,
  estimated_value_note: "Up to $55,000 per year, as published by the Jack Kent Cooke Foundation.",
  application_deadline: "2026-12-09",
  official_source: cookeSource,
  metadata: {
    deadlineType: "fixed",
    claimUrl: cookeSource,
    awardAmountLabel: "Up to $55,000 per year",
    eligibilityRules: {
      educationLevels: ["community_college", "recent_graduate"],
      canonicalInstitutionTypes: ["community_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled", "transfer_applicant", "graduated"],
      classYears: ["Second year", "Third year"],
      majors: ["Any Major"],
      minimumGpa: 3.5,
      citizenshipStatuses: ["unrestricted"],
      financialNeedRequired: true,
      transferOnly: true,
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: [cookeNotes],
    },
    verification: verification(cookeSource, "2027 transfer award", cookeNotes),
    lifecycle: lifecycle({ id: cookeId, cycle: "2027-transfer-award", state: "upcoming", reason: "opening_date_future", sourceUrl: cookeSource, evidence: "The official application page lists an August 19, 2026 opening and December 9, 2026 deadline.", openingDate: "2026-08-19", deadline: "2026-12-09" }),
  },
});

function archiveDuplicate(id, canonicalId) {
  update(id, (item) => {
    const notes = `Archived as a duplicate of canonical record ${canonicalId}; retained only for historical identifier compatibility.`;
    return {
      ...item,
      verification_status: "archived",
      last_verified: verifiedAt,
      reviewer_notes: notes,
      metadata: {
        ...item.metadata,
        eligibilityRules: {
          ...item.metadata.eligibilityRules,
          availability: "closed",
          recommendationEligibilityStatus: "ineligible",
          evidence: [notes],
        },
        verification: { ...item.metadata.verification, status: "archived", lastVerifiedAt: verifiedAt, eligibilityVerified: true, notes },
        lifecycle: {
          schemaVersion: 1,
          migrationId: "verified-inventory-2026-08-08",
          identity: { identityId: item.id, supersededBy: canonicalId },
          cycle: { cycleId: "archived-duplicate" },
          state: "archived",
          confidence: "confirmed",
          reason: "record_archived",
          effectiveAt: `${verifiedAt}T00:00:00.000Z`,
          evidence: [{ id: `${item.id}:archived`, source: "manual_review", observedAt: `${verifiedAt}T00:00:00.000Z`, value: notes, sourceUrl: item.official_source, confidence: "confirmed" }],
          events: [],
          sourceChecks: [{ url: item.official_source, checkedAt: `${verifiedAt}T00:00:00.000Z`, classification: "official_information", status: 200 }],
          fieldVerifiedAt: { state: verifiedAt, eligibility: verifiedAt, description: verifiedAt },
          review: { note: notes, reviewedAt: `${verifiedAt}T00:00:00.000Z`, reviewer: "UnlockED catalog audit" },
        },
      },
    };
  });
}

archiveDuplicate("national-curated-2026--u-s-department-of-state--gilman-international-scholarship", "scholarship--gilman-scholarship");
archiveDuplicate("national-curated-2026--u-s-department-of-defense--smart-scholarship-for-service-program", "scholarship--dod-smart-scholarship");

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Expanded verified opportunity inventory to ${catalog.length} records.`);
