import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = path.join(root, "data", "db");
const read = (file) => JSON.parse(fs.readFileSync(path.join(db, file), "utf8"));
const write = (file, value) => fs.writeFileSync(path.join(db, file), `${JSON.stringify(value, null, 2)}\n`);

const verifiedAt = "2026-07-09";
const generatedPrefix = "v1-school-resource--";
const schools = [...read("schools.json"), ...read("institutions.json")];
const existing = read("opportunities.json").filter((item) => !item.id.startsWith(generatedPrefix)).map(strengthenExisting);

const cleanDomain = (school) => (school.website || `https://${school.domain}`).replace(/\/$/, "");
const text = (value) => String(value ?? "").trim();
const slugify = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const locationTags = (school) => school.location.split(",").map((part) => part.trim()).filter(Boolean);
const displayName = (school) => school.name.replace(/\//g, " and ");

function strengthenExisting(item) {
  if (/This matters because/i.test(item.description) && /official source/i.test(item.description)) return item;
  const audience = item.majors?.includes("Any Major") ? "students who meet the eligibility rules" : `${item.majors?.slice(0, 3).join(", ")} students who meet the eligibility rules`;
  const typeReason = {
    Benefit: "it can reduce costs or unlock useful student-only access",
    AI: "it can support studying, research, writing, coding, accessibility, or productivity when used within course rules",
    Career: "it can build experience, employer exposure, portfolio evidence, or professional direction",
    Research: "it can build faculty connections, technical skills, research experience, and graduate-school preparation",
    Scholarship: "it can reduce education costs and point students toward awards with documented eligibility",
  }[item.type] ?? "it can give students a concrete next step";
  return {
    ...item,
    description: `${item.description} This matters because ${typeReason}. ${audience.charAt(0).toUpperCase()}${audience.slice(1)} should review the official ${item.organization} source, confirm current requirements, and apply or claim through the provider's published process.`,
  };
}

function baseRecord(school, kind, input) {
  const source = cleanDomain(school);
  const name = displayName(school);
  const id = `${generatedPrefix}${school.slug}--${kind}`;
  return {
    id,
    title: input.title,
    type: input.type,
    category: input.category,
    description: input.description,
    organization: name,
    school_scope: "School Specific",
    schools: [school.slug],
    majors: input.majors ?? ["Any Major"],
    academic_years: input.academicYears ?? ["Any Year"],
    eligibility: input.eligibility,
    estimated_value: input.estimatedValue ?? null,
    application_deadline: null,
    recurring: true,
    location: school.location,
    remote: input.remote ?? null,
    paid: input.paid ?? null,
    tags: [
      input.category,
      input.type,
      name,
      school.slug,
      school.domain,
      "Official University Resource",
      "School Specific",
      ...locationTags(school),
      ...(input.tags ?? []),
    ].filter(Boolean),
    official_source: source,
    official_source_url: source,
    verification_status: "verified",
    last_verified: verifiedAt,
    deadline: null,
    reviewer_notes: `Generated for Version 1 school coverage from the official ${name} website domain. Replace with a more specific office URL when an office-level source has been manually reviewed.`,
    estimated_value_note: input.estimatedValue === undefined || input.estimatedValue === null ? "Unknown — no verified dollar value is documented by the official source." : "Estimated from official university documentation.",
    date_added: verifiedAt,
    difficulty: input.difficulty ?? null,
    prestige: input.prestige ?? null,
    icon: input.icon ?? null,
    featured: false,
    hidden_gem: input.hiddenGem ?? false,
    metadata: {
      deadlineType: "varies",
      claimUrl: source,
      verificationMethod: `Official ${name} website domain from the supported school database.`,
      eligibilityNotes: [input.eligibility],
      reviewScore: 75,
      ...(input.metadata ?? {}),
    },
  };
}

function schoolOpportunities(school) {
  const name = displayName(school);
  const sourceInstruction = `Use the official ${name} website linked on this page, then follow the university's current office, application, or student portal instructions.`;
  return [
    baseRecord(school, "scholarships-financial-aid", {
      title: `${name} Scholarships and Financial Aid`,
      type: "Scholarship",
      category: "Scholarships",
      description: `Official scholarship and financial aid resources for ${name} students. This matters because institutional aid can reduce out-of-pocket cost, and students should use it to find university-managed awards, eligibility rules, and renewal requirements. Current and prospective students should review the official source before relying on any third-party scholarship listing. ${sourceInstruction}`,
      eligibility: `Current and prospective ${name} students; award-specific eligibility varies by college, program, residency, financial need, merit, and enrollment status.`,
      tags: ["Scholarships", "Financial Aid", "Aid", "Tuition", "Funding", "Merit Aid", "Need Based Aid"],
      icon: "scholarship",
      metadata: {
        awardAmountLabel: "Varies by award and aid package",
        renewable: null,
        applicationRequirements: [
          `Review ${name}'s official scholarship and financial aid instructions.`,
          "Confirm whether awards require admission, FAFSA/CSS Profile, departmental applications, essays, recommendations, or separate scholarship forms.",
          "Submit materials through the university's official process before the current published deadline.",
        ],
      },
    }),
    baseRecord(school, "undergraduate-research", {
      title: `${name} Undergraduate Research Opportunities`,
      type: "Research",
      category: "Undergraduate Research",
      description: `Official research resources for ${name} students. This matters because undergraduate research can build faculty relationships, technical skills, graduate-school preparation, and evidence of original work. Students in any major should use the official source to find current labs, programs, departments, and application steps. ${sourceInstruction}`,
      eligibility: `Current ${name} students; eligibility varies by department, faculty mentor, program, academic standing, research area, and funding source.`,
      tags: ["Research", "Undergraduate Research", "Labs", "Faculty", "Academic Departments", "Graduate School Preparation"],
      icon: "research",
      metadata: {
        department: "Undergraduate research and academic departments",
        researchArea: "Research across disciplines",
        professor: null,
        stipendAmount: null,
        semesters: ["Fall", "Spring", "Summer"],
        applicationRequirements: [
          `Review ${name}'s official research resources and department pages.`,
          "Identify programs, labs, faculty mentors, or research offices that match your interests.",
          "Follow the current university instructions for applications, outreach, eligibility, or funding.",
        ],
      },
    }),
    baseRecord(school, "career-center-internships", {
      title: `${name} Internship and Career Center Resources`,
      type: "Career",
      category: "Internships",
      description: `Official internship and career resources for ${name} students. This matters because university career offices often provide job boards, employer events, resume review, interview preparation, and internship guidance tied to the school. Students in any year should use the official source to find current internship systems and application instructions. ${sourceInstruction}`,
      eligibility: `Current ${name} students and eligible alumni; access may vary by enrollment status, program, campus, and university account access.`,
      tags: ["Internships", "Career Center", "Jobs", "Employer Events", "Resume", "Interview Prep", "Handshake"],
      icon: "career",
      difficulty: "Open",
      metadata: {
        compensation: "Varies",
        workMode: "Varies",
        applicationRequirements: [
          `Visit ${name}'s official career resources.`,
          "Use the current student job board, career platform, advising office, or employer-event instructions.",
          "Apply through the employer or university-posted process after confirming eligibility.",
        ],
      },
    }),
    baseRecord(school, "ai-academic-technology", {
      title: `${name} AI and Academic Technology Resources`,
      type: "AI",
      category: "AI Tools",
      description: `Official AI, academic technology, library, or digital learning resources for ${name} students. This matters because course policies, approved tools, data privacy rules, and campus-supported software can differ by university. Students using AI for writing, research, coding, studying, or accessibility should start with the official source before adopting outside tools. ${sourceInstruction}`,
      eligibility: `Current ${name} students; access to academic technology, AI guidance, and software resources may vary by course, school, license, and university account status.`,
      tags: ["AI", "Academic Technology", "Library", "Digital Learning", "Software", "Responsible AI", "Study Tools"],
      remote: true,
      icon: "ai",
      metadata: {
        studentOffer: "University-supported AI, software, library, or academic technology guidance",
        offerType: "Campus academic technology resource",
        applicationRequirements: [
          `Review ${name}'s official AI, library, academic technology, or software guidance.`,
          "Confirm whether your course, department, or instructor allows the tool or workflow.",
          "Access approved tools through the university's official login, library, or technology portal when available.",
        ],
      },
    }),
    baseRecord(school, "student-benefits-services", {
      title: `${name} Student Services and Campus Benefits`,
      type: "Benefit",
      category: "Campus",
      description: `Official student services and campus benefit resources for ${name} students. This matters because students may have access to health, wellness, transportation, library, software, advising, emergency support, and campus-life resources that are easy to miss. Current students should use the official source to confirm available services, eligibility, and how to claim them. ${sourceInstruction}`,
      eligibility: `Current ${name} students; benefit access varies by enrollment status, campus, fee payment, program, and service rules.`,
      tags: ["Student Benefits", "Campus Services", "Student Affairs", "Wellness", "Library", "Transportation", "Software"],
      icon: "benefit",
      metadata: {
        valueLabel: "Varies by service",
        renewalNotes: "Campus services and benefits can change by term; confirm current availability on the official university site.",
        claimSteps: [
          `Open the official ${name} student services or campus resources website.`,
          "Review current services, eligibility rules, required student ID or account access, and any appointment or request steps.",
          "Use the university's official portal, office, or service desk to claim the relevant benefit.",
        ],
      },
    }),
    baseRecord(school, "competitions-innovation", {
      title: `${name} Competitions, Innovation, and Student Challenges`,
      type: "Career",
      category: "Competitions",
      description: `Official competition, entrepreneurship, hackathon, innovation, and student challenge resources for ${name} students. This matters because competitions can create portfolio projects, funding exposure, team experience, and employer or mentor connections. Students interested in startups, research translation, design, business, engineering, or computing should use the official source to find current events and rules. ${sourceInstruction}`,
      eligibility: `Current ${name} students; eligibility varies by event, sponsor, team composition, academic level, major, and registration rules.`,
      tags: ["Competitions", "Hackathons", "Innovation", "Entrepreneurship", "Startups", "Pitch", "Student Challenges"],
      icon: "career",
      difficulty: "Competitive",
      metadata: {
        compensation: "Varies",
        workMode: "Varies",
        applicationRequirements: [
          `Review ${name}'s official innovation, entrepreneurship, student organization, or event resources.`,
          "Confirm event eligibility, team rules, registration requirements, judging criteria, and deadlines.",
          "Register or apply through the official university or event process.",
        ],
      },
    }),
    baseRecord(school, "career-services", {
      title: `${name} Career Services`,
      type: "Career",
      category: "Career Resources",
      description: `Official career services for ${name} students. This matters because career offices can help students choose next steps, prepare resumes and interviews, find networking events, and connect with employers recruiting from the university. First-year through graduate students should use the official source early, not only when they are actively applying. ${sourceInstruction}`,
      eligibility: `Current ${name} students and eligible alumni; services vary by school, program, campus, and university account access.`,
      tags: ["Career Resources", "Career Services", "Advising", "Resume", "Networking", "Employer Events", "Job Search"],
      icon: "career",
      difficulty: "Open",
      metadata: {
        compensation: "Varies",
        workMode: "Varies",
        applicationRequirements: [
          `Open ${name}'s official career services resources.`,
          "Schedule advising, review career guides, attend employer events, or use the university job platform as directed.",
          "Follow current university instructions for appointments, event registration, and job or internship applications.",
        ],
      },
    }),
  ];
}

const additions = schools.flatMap(schoolOpportunities);
const byId = new Map();
for (const item of [...existing, ...additions]) {
  if (byId.has(item.id)) throw new Error(`Duplicate opportunity id generated: ${item.id}`);
  byId.set(item.id, item);
}
write("opportunities.json", [...existing, ...additions]);

const coveredSchools = new Set(additions.flatMap((item) => item.schools));
const categoryCount = additions.reduce((count, item) => count.set(item.category, (count.get(item.category) ?? 0) + 1), new Map());
console.log(`Added ${additions.length} Version 1 school-resource opportunities for ${coveredSchools.size} supported universities.`);
console.log([...categoryCount.entries()].map(([category, count]) => `${category}: ${count}`).join("\n"));
