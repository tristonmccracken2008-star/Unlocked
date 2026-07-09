import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = path.join(root, "data", "db");
const docs = path.join(root, "docs");
const read = (file) => JSON.parse(fs.readFileSync(path.join(db, file), "utf8"));
const write = (file, value) => fs.writeFileSync(path.join(db, file), `${JSON.stringify(value, null, 2)}\n`);
const verifiedAt = "2026-07-09";
const generatedPrefix = "v1-expanded-resource--";

const supplementalSchools = [
  ["miami-dade-college", "Miami Dade College", ["MDC"], "mdc.edu", "Miami, FL"],
  ["northern-virginia-community-college", "Northern Virginia Community College", ["NOVA", "NVCC"], "nvcc.edu", "Annandale, VA"],
  ["houston-community-college", "Houston Community College", ["HCC"], "hccs.edu", "Houston, TX"],
  ["dallas-college", "Dallas College", ["DCCCD"], "dallascollege.edu", "Dallas, TX"],
  ["valencia-college", "Valencia College", ["Valencia"], "valenciacollege.edu", "Orlando, FL"],
  ["austin-community-college", "Austin Community College", ["ACC"], "austincc.edu", "Austin, TX"],
  ["santa-monica-college", "Santa Monica College", ["SMC"], "smc.edu", "Santa Monica, CA"],
  ["de-anza-college", "De Anza College", ["De Anza"], "deanza.edu", "Cupertino, CA"],
  ["lone-star-college", "Lone Star College", ["LSC"], "lonestar.edu", "The Woodlands, TX"],
  ["maricopa-community-colleges", "Maricopa Community Colleges", ["Maricopa"], "maricopa.edu", "Tempe, AZ"],
  ["north-carolina-a-t-state-university", "North Carolina A&T State University", ["NC A&T", "NCA&T", "North Carolina A and T"], "ncat.edu", "Greensboro, NC"],
  ["florida-a-m-university", "Florida A&M University", ["FAMU", "Florida A and M"], "famu.edu", "Tallahassee, FL"],
  ["spelman-college", "Spelman College", ["Spelman"], "spelman.edu", "Atlanta, GA"],
  ["morehouse-college", "Morehouse College", ["Morehouse"], "morehouse.edu", "Atlanta, GA"],
  ["hampton-university", "Hampton University", ["Hampton"], "hamptonu.edu", "Hampton, VA"],
  ["tuskegee-university", "Tuskegee University", ["Tuskegee"], "tuskegee.edu", "Tuskegee, AL"],
  ["clark-atlanta-university", "Clark Atlanta University", ["CAU"], "cau.edu", "Atlanta, GA"],
  ["xavier-university-of-louisiana", "Xavier University of Louisiana", ["XULA"], "xula.edu", "New Orleans, LA"],
  ["morgan-state-university", "Morgan State University", ["Morgan State", "MSU"], "morgan.edu", "Baltimore, MD"],
  ["williams-college", "Williams College", ["Williams"], "williams.edu", "Williamstown, MA"],
  ["amherst-college", "Amherst College", ["Amherst"], "amherst.edu", "Amherst, MA"],
  ["swarthmore-college", "Swarthmore College", ["Swarthmore"], "swarthmore.edu", "Swarthmore, PA"],
  ["pomona-college", "Pomona College", ["Pomona"], "pomona.edu", "Claremont, CA"],
  ["wellesley-college", "Wellesley College", ["Wellesley"], "wellesley.edu", "Wellesley, MA"],
  ["bowdoin-college", "Bowdoin College", ["Bowdoin"], "bowdoin.edu", "Brunswick, ME"],
  ["carleton-college", "Carleton College", ["Carleton"], "carleton.edu", "Northfield, MN"],
  ["middlebury-college", "Middlebury College", ["Middlebury"], "middlebury.edu", "Middlebury, VT"],
  ["davidson-college", "Davidson College", ["Davidson"], "davidson.edu", "Davidson, NC"],
  ["university-of-toronto", "University of Toronto", ["U of T", "Toronto"], "utoronto.ca", "Toronto, Canada"],
  ["university-of-british-columbia", "University of British Columbia", ["UBC"], "ubc.ca", "Vancouver, Canada"],
  ["mcgill-university", "McGill University", ["McGill"], "mcgill.ca", "Montreal, Canada"],
  ["university-of-oxford", "University of Oxford", ["Oxford"], "ox.ac.uk", "Oxford, United Kingdom"],
  ["university-of-cambridge", "University of Cambridge", ["Cambridge"], "cam.ac.uk", "Cambridge, United Kingdom"],
  ["imperial-college-london", "Imperial College London", ["Imperial"], "imperial.ac.uk", "London, United Kingdom"],
  ["london-school-of-economics", "London School of Economics and Political Science", ["LSE"], "lse.ac.uk", "London, United Kingdom"],
  ["university-of-melbourne", "University of Melbourne", ["Melbourne"], "unimelb.edu.au", "Melbourne, Australia"],
  ["national-university-of-singapore", "National University of Singapore", ["NUS"], "nus.edu.sg", "Singapore"],
].map(([slug, name, aliases, domain, location]) => ({ slug, name, aliases, domain, location, initials: aliases[0], website: `https://${domain}`, sourceUrl: `https://${domain}` }))
  .filter((school) => school.domain.endsWith(".edu"));

const majorFamilies = {
  Engineering: ["Aerospace Engineering", "Biomedical Engineering", "Chemical Engineering", "Civil Engineering", "Computer Engineering", "Electrical Engineering", "Environmental Engineering", "Industrial Engineering", "Materials Science", "Mechanical Engineering", "Nuclear Engineering", "Software Engineering"],
  "Computer Science": ["Computer Science", "Software Engineering", "Cybersecurity", "Information Systems", "Information Technology", "Game Design", "Human-Computer Interaction"],
  "Data Science": ["Data Science", "Statistics", "Analytics", "Information Systems", "Machine Learning"],
  Mathematics: ["Mathematics", "Applied Mathematics", "Statistics", "Actuarial Science"],
  Physics: ["Physics", "Astronomy", "Astrophysics"],
  "Natural Sciences": ["Biology", "Chemistry", "Physics", "Environmental Science", "Neuroscience", "Geology", "Earth Science", "Marine Science", "Pre-med", "Nursing", "Public Health", "Kinesiology"],
  Business: ["Business", "Economics", "Finance", "Accounting", "Marketing", "Management", "Entrepreneurship", "Operations Management", "Supply Chain Management", "Hospitality Management", "Human Resources"],
  Finance: ["Finance", "Accounting", "Economics", "Business", "Actuarial Science"],
  Design: ["Design", "Architecture", "Fine Arts", "Graphic Design", "Industrial Design", "Interior Design", "Fashion Design", "User Experience Design"],
  "Social Sciences": ["Psychology", "Political Science", "Sociology", "Anthropology", "International Relations", "Public Policy", "Criminal Justice", "Social Work", "Urban Studies", "Education", "Communications", "Journalism", "English", "History", "Philosophy", "Religious Studies", "Languages", "Linguistics", "Music", "Theatre", "Fine Arts"],
};
const allCommonMajors = ["Any Major", ...Object.values(majorFamilies).flat(), "Architecture", "Nursing", "Pre-med", "Education", "English", "History", "Communications", "Journalism", "Music", "Fine Arts", "Cybersecurity", "Environmental Science"];
const unique = (items) => [...new Set(items.filter(Boolean))];
const displayName = (school) => school.name.replace(/\//g, " and ");
const source = (school) => (school.website || `https://${school.domain}`).replace(/\/$/, "");
const sourceInstruction = (school) => `Use ${displayName(school)}'s official website as the starting point, then follow the current office, application, student portal, or department instructions.`;
const locationTags = (school) => school.location.split(",").map((part) => part.trim()).filter(Boolean);

function enrichedMajors(item) {
  if (item.majors.includes("Any Major")) return ["Any Major"];
  const expanded = item.majors.flatMap((major) => [major, ...(majorFamilies[major] ?? [])]);
  const text = `${item.title} ${item.category} ${item.description} ${item.tags?.join(" ") ?? ""}`.toLowerCase();
  for (const [family, majors] of Object.entries(majorFamilies)) if (text.includes(family.toLowerCase())) expanded.push(...majors);
  if (/nursing|health|medicine|medical|pre-med|clinical|public health/.test(text)) expanded.push("Nursing", "Pre-med", "Public Health", "Biology", "Chemistry", "Neuroscience");
  if (/journalism|media|communication|marketing/.test(text)) expanded.push("Communications", "Journalism", "Marketing");
  if (/architecture|design|arts|music|creative/.test(text)) expanded.push("Architecture", "Design", "Fine Arts", "Music");
  return unique(expanded);
}

function record(school, key, input) {
  const url = source(school);
  const name = displayName(school);
  return {
    id: `${generatedPrefix}${school.slug}--${key}`,
    title: `${name} ${input.title}`,
    type: input.type,
    category: input.category,
    description: `${input.description} This matters because students often miss these resources when they are spread across offices, departments, portals, and event pages. ${sourceInstruction(school)}`,
    organization: name,
    school_scope: "School Specific",
    schools: [school.slug],
    majors: input.majors ?? ["Any Major"],
    academic_years: input.academicYears ?? ["Any Year"],
    eligibility: `Current ${name} students; eligibility varies by program, department, campus, academic standing, funding source, and current university rules.`,
    estimated_value: null,
    application_deadline: null,
    recurring: true,
    location: school.location,
    remote: input.remote ?? null,
    paid: input.paid ?? null,
    tags: unique([input.category, input.type, name, school.slug, school.domain, "Official University Resource", "School Specific", ...locationTags(school), ...(input.tags ?? [])]),
    official_source: url,
    official_source_url: url,
    verification_status: "needs_review",
    last_verified: verifiedAt,
    deadline: null,
    reviewer_notes: `Generated from the official ${name} website domain for content coverage. Needs manual office-level verification before being marked fully verified.`,
    estimated_value_note: "Unknown — no verified dollar value is documented by the official source.",
    date_added: verifiedAt,
    difficulty: input.difficulty ?? null,
    prestige: null,
    icon: input.icon ?? null,
    featured: false,
    hidden_gem: false,
    metadata: {
      deadlineType: "varies",
      claimUrl: url,
      verificationMethod: `Official ${name} website domain from the supported school database; office-level source pending manual review.`,
      eligibilityNotes: [`Current ${name} students; details vary by program and office.`],
      reviewScore: 65,
      applicationRequirements: [
        `Start at ${school.name}'s official website.`,
        "Search for the current office, department, student portal, or event page connected to this resource.",
        "Confirm eligibility, deadlines, and application or registration steps before relying on this listing.",
      ],
      ...(input.metadata ?? {}),
    },
  };
}

function resourcesForSchool(school) {
  return [
    record(school, "grants-funding", { title: "Grants and Student Funding", type: "Scholarship", category: "Grants", description: `Official grant, emergency funding, departmental award, and student funding resources for ${displayName(school)} students.`, tags: ["Grants", "Funding", "Emergency Aid", "Department Awards"], icon: "scholarship", metadata: { awardAmountLabel: "Varies by grant", renewable: null } }),
    record(school, "study-abroad", { title: "Study Abroad and Global Programs", type: "Scholarship", category: "Study Abroad", description: `Official study abroad, global education, international program, and travel funding resources for ${displayName(school)} students.`, tags: ["Study Abroad", "Global Programs", "International", "Travel Funding"], icon: "scholarship", metadata: { awardAmountLabel: "Varies by program", renewable: null } }),
    record(school, "campus-jobs", { title: "Campus Jobs and Student Employment", type: "Career", category: "Campus Jobs", description: `Official campus job, work-study, student employment, and on-campus hiring resources for ${displayName(school)} students.`, tags: ["Campus Jobs", "Student Employment", "Work Study", "Part Time Jobs"], paid: true, difficulty: "Open", icon: "career", metadata: { compensation: "Paid", workMode: "In Person" } }),
    record(school, "co-ops", { title: "Co-ops and Experiential Learning", type: "Career", category: "Co-ops", description: `Official co-op, practicum, experiential learning, applied project, and work-integrated learning resources for ${displayName(school)} students.`, tags: ["Co-ops", "Experiential Learning", "Practicum", "Applied Projects"], paid: null, difficulty: "Competitive", icon: "career", metadata: { compensation: "Varies", workMode: "Varies" } }),
    record(school, "student-organizations", { title: "Student Organizations and Campus Involvement", type: "Career", category: "Student Organizations", description: `Official student organization, club, leadership, campus involvement, and student government resources for ${displayName(school)} students.`, tags: ["Student Organizations", "Clubs", "Student Government", "Campus Involvement"], difficulty: "Open", icon: "career", metadata: { compensation: "Varies", workMode: "In Person" } }),
    record(school, "conferences-events", { title: "Conferences and Professional Events", type: "Career", category: "Conferences", description: `Official conference, symposium, professional event, poster session, and campus speaker resources for ${displayName(school)} students.`, tags: ["Conferences", "Symposium", "Professional Events", "Networking"], difficulty: "Open", icon: "career", metadata: { compensation: "Varies", workMode: "Varies" } }),
    record(school, "certifications", { title: "Certifications and Skill Credentials", type: "Career", category: "Certifications", description: `Official certification, training, credential, online learning, and skill-building resources for ${displayName(school)} students.`, tags: ["Certifications", "Credentials", "Training", "Skills"], remote: true, difficulty: "Open", icon: "career", metadata: { compensation: "Varies", workMode: "Remote" } }),
    record(school, "fellowships", { title: "Fellowships and Funded Programs", type: "Career", category: "Fellowships", description: `Official fellowship, funded program, post-graduate award, and special opportunity resources for ${displayName(school)} students.`, tags: ["Fellowships", "Funded Programs", "Awards", "Postgraduate"], difficulty: "Highly Competitive", icon: "career", metadata: { compensation: "Varies", workMode: "Varies" } }),
    record(school, "leadership-programs", { title: "Leadership Programs", type: "Career", category: "Leadership Programs", description: `Official leadership development, peer mentor, ambassador, residence life, and campus leadership resources for ${displayName(school)} students.`, tags: ["Leadership Programs", "Peer Mentor", "Ambassador", "Residence Life"], difficulty: "Competitive", icon: "career", metadata: { compensation: "Varies", workMode: "In Person" } }),
    record(school, "student-software", { title: "Student Software and Technology Access", type: "Benefit", category: "Software", description: `Official student software, academic technology, device support, licensing, and digital resource access for ${displayName(school)} students.`, tags: ["Student Software", "Technology", "Software Licenses", "Academic Technology"], remote: true, icon: "benefit", metadata: { valueLabel: "Varies by license", claimSteps: [`Open ${displayName(school)}'s official technology or software resources.`, "Confirm current student eligibility and license terms.", "Claim access through the university portal or official provider process."] } }),
  ];
}

const institutions = read("institutions.json");
const nextInstitutions = institutions.filter((school) => school.domain.endsWith(".edu"));
const domains = new Set([...read("schools.json"), ...nextInstitutions].map((school) => school.domain));
for (const school of supplementalSchools) if (!domains.has(school.domain)) { nextInstitutions.push(school); domains.add(school.domain); }
write("institutions.json", nextInstitutions);

const schools = [...read("schools.json"), ...nextInstitutions];
const supportedSchoolSlugs = new Set(schools.map((school) => school.slug));
const original = read("opportunities.json").filter((item) => !item.id.startsWith(generatedPrefix) && (item.school_scope !== "School Specific" || item.schools.every((slug) => supportedSchoolSlugs.has(slug))));
const enriched = original.map((item) => ({ ...item, majors: enrichedMajors(item), tags: unique([...(item.tags ?? []), ...enrichedMajors(item).filter((major) => major !== "Any Major")]) }));
const generated = schools.flatMap(resourcesForSchool);
const byKey = new Map();
for (const item of [...enriched, ...generated]) {
  const key = `${item.type}|${item.title.toLowerCase()}|${item.organization.toLowerCase()}`;
  if (!byKey.has(key)) byKey.set(key, item);
}
const opportunities = [...byKey.values()];
write("opportunities.json", opportunities);

const typeCounts = Object.entries(Object.groupBy(opportunities, (item) => item.type)).map(([type, items]) => `${type}: ${items.length}`).join("\n");
const categoryCounts = Object.entries(Object.groupBy(opportunities, (item) => item.category)).sort((a,b) => b[1].length - a[1].length);
const majorCount = new Set(opportunities.flatMap((item) => item.majors)).size;
const report = `# UnlockED Content Expansion Audit

Generated: ${verifiedAt}

## Summary

- Supported schools: ${schools.length}
- Opportunities: ${opportunities.length}
- Supported structured majors in catalog records: ${majorCount}
- Duplicate content keys removed or prevented: ${enriched.length + generated.length - opportunities.length}

## Opportunity counts by type

${typeCounts}

## Categories expanded

${categoryCounts.map(([category, items]) => `- ${category}: ${items.length}`).join("\n")}

## Supplemental school coverage

Supported ${supplementalSchools.filter((school) => domains.has(school.domain)).length} supplemental U.S. institutions across community colleges, HBCUs, and liberal arts colleges.

International school support remains future work because the current school schema only accepts official .edu domains.

## Major coverage

The catalog now expands broad records into common undergraduate majors across engineering, computing, mathematics, sciences, health, business, arts, humanities, education, communications, journalism, and social sciences. Any Major records remain broadly available.

## Trust notes

Generated expansion records use official institution domains and are marked "needs_review" until an office-level source URL is manually verified. Existing verified records keep their current verification status.

## Remaining manual verification

- Replace institution-domain links on generated records with office-specific official URLs where possible.
- Add exact deadlines for school-specific grants, study abroad awards, campus jobs, and fellowships.
- Add dollar values only when official pages publish a fixed amount or reliable range.
- Continue pruning records if official sources retire programs.
`;
fs.writeFileSync(path.join(docs, "CONTENT_EXPANSION_AUDIT.md"), report);
console.log(report);
