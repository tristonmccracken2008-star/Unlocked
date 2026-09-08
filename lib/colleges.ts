import "server-only";

import scorecard from "@/data/db/college-scorecard.json";

export type CollegeProgram = { id: string; label: string; share: number };
export type College = {
  id: string; slug: string; name: string; aliases: string[]; city: string; state: string; zip: string;
  website: string | null; priceCalculatorUrl: string | null; ownership: "Public" | "Private nonprofit" | "Private for-profit";
  setting: "Urban" | "Suburban" | "Town" | "Rural" | null; region: string | null; carnegieBasic: number | null;
  degreeLevel: "Associate" | "Bachelor's"; hbcu: boolean; hsi: boolean; womensCollege: boolean; openAdmissions: boolean;
  undergraduateEnrollment: number; studentFacultyRatio: number | null; retentionRate: number | null; acceptanceRate: number | null;
  testRequirementCode: number | null; satReadingRange: [number | null, number | null]; satMathRange: [number | null, number | null];
  actRange: [number | null, number | null]; tuitionInState: number | null; tuitionOutOfState: number | null; roomAndBoard: number | null;
  publishedTotalCost: number | null; averageNetPrice: number | null; graduationRate: number | null; medianEarnings10Years: number | null;
  programs: CollegeProgram[];
};

export type CollegeQuery = {
  query?: string; state?: string; region?: string; ownership?: string; setting?: string; size?: string; program?: string;
  minAcceptance?: number; maxAcceptance?: number; maxNetPrice?: number; minGraduation?: number; designation?: string; page?: number; limit?: number;
};

const colleges = scorecard.colleges as College[];
const bySlug = new Map(colleges.map((college) => [college.slug, college]));
const byId = new Map(colleges.map((college) => [college.id, college]));
const stateNames: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  AS: "American Samoa", GU: "Guam", MP: "Northern Mariana Islands", PR: "Puerto Rico", PW: "Palau", FM: "Federated States of Micronesia", MH: "Marshall Islands", VI: "U.S. Virgin Islands",
};
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sizeBand = (enrollment: number) => enrollment < 2_000 ? "Small" : enrollment < 10_000 ? "Medium" : enrollment < 25_000 ? "Large" : "Very large";
const acceptanceBand = (rate: number | null) => rate === null ? null : rate < .2 ? 0 : rate < .5 ? 1 : rate < .8 ? 2 : 3;
const programAliases: Record<string, string> = {
  "11": "computer science computing information technology software data science",
  "14": "engineering aerospace biomedical chemical civil electrical mechanical",
  "24": "liberal arts humanities general studies",
  "26": "biology biological sciences biochemistry",
  "27": "mathematics statistics applied math",
  "42": "psychology",
  "45": "economics political science sociology international relations social sciences",
  "51": "health nursing medicine public health",
  "52": "business finance accounting marketing management economics",
};

const searchable = colleges.map((college) => ({
  college,
  name: normalize([college.name, ...college.aliases, college.name.replace(/^University of /, "U ")].join(" ")),
  location: normalize(`${college.city} ${college.state} ${stateNames[college.state] ?? ""} ${college.region ?? ""} ${college.setting ?? ""}`),
  programs: normalize(college.programs.map((program) => `${program.label} ${programAliases[program.id] ?? ""}`).join(" ")),
  type: normalize(`${college.ownership} ${college.degreeLevel} ${college.hbcu ? "HBCU historically black" : ""} ${college.hsi ? "Hispanic serving" : ""} ${college.womensCollege ? "women college" : ""} ${sizeBand(college.undergraduateEnrollment)}`),
}));

function relevance(record: (typeof searchable)[number], rawQuery: string) {
  const query = normalize(rawQuery);
  if (!query) return 1;
  const tokens = query.split(" ").filter((token) => !["in", "at", "near", "college", "colleges", "university", "universities", "school", "schools"].includes(token));
  const squashed = query.replaceAll(" ", "");
  const all = `${record.name} ${record.location} ${record.programs} ${record.type}`;
  if (!tokens.every((token) => all.includes(token) || record.name.replaceAll(" ", "").includes(token))) return 0;
  let score = 0;
  if (record.name.replaceAll(" ", "").includes(squashed)) score += 2_200;
  else if (record.name === query) score += 2_000;
  else if (record.name.startsWith(query)) score += 1_200;
  else if (record.name.includes(query)) score += 800;
  for (const token of tokens) {
    if (record.name.split(" ").includes(token)) score += 240;
    else if (record.location.split(" ").includes(token)) score += 120;
    else if (record.programs.includes(token)) score += 80;
    else score += 40;
  }
  return score;
}

function matches(college: College, query: CollegeQuery) {
  const intent = normalize(query.query ?? "");
  if (/\bpublic (?:universit(?:y|ies)|colleges?|schools?)/.test(intent) && college.ownership !== "Public") return false;
  if (/\bprivate (?:universit(?:y|ies)|colleges?|schools?)/.test(intent) && college.ownership === "Public") return false;
  if (/\bsmall (?:universit(?:y|ies)|colleges?|schools?)/.test(intent) && sizeBand(college.undergraduateEnrollment) !== "Small") return false;
  if (/\blarge (?:universit(?:y|ies)|colleges?|schools?)/.test(intent) && !["Large", "Very large"].includes(sizeBand(college.undergraduateEnrollment))) return false;
  if (query.state && college.state !== query.state) return false;
  if (query.region && college.region !== query.region) return false;
  if (query.ownership && college.ownership !== query.ownership) return false;
  if (query.setting && college.setting !== query.setting) return false;
  if (query.size && sizeBand(college.undergraduateEnrollment) !== query.size) return false;
  if (query.program && !college.programs.some((program) => program.id === query.program)) return false;
  if (query.designation === "hbcu" && !college.hbcu) return false;
  if (query.designation === "hsi" && !college.hsi) return false;
  if (query.designation === "women" && !college.womensCollege) return false;
  if (query.minAcceptance !== undefined && (college.acceptanceRate === null || college.acceptanceRate < query.minAcceptance)) return false;
  if (query.maxAcceptance !== undefined && (college.acceptanceRate === null || college.acceptanceRate > query.maxAcceptance)) return false;
  if (query.maxNetPrice !== undefined && (college.averageNetPrice === null || college.averageNetPrice > query.maxNetPrice)) return false;
  if (query.minGraduation !== undefined && (college.graduationRate === null || college.graduationRate < query.minGraduation)) return false;
  return true;
}

export function searchColleges(query: CollegeQuery = {}) {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = Math.min(40, Math.max(1, Math.floor(query.limit ?? 18)));
  const results = searchable.flatMap((record) => {
    if (!matches(record.college, query)) return [];
    const score = relevance(record, query.query ?? "");
    return score ? [{ college: record.college, score }] : [];
  }).sort((a, b) => b.score - a.score || a.college.name.localeCompare(b.college.name));
  return { colleges: results.slice((page - 1) * limit, page * limit).map((item) => item.college), total: results.length, page, pageCount: Math.ceil(results.length / limit) };
}

export const collegeCatalogMetadata = scorecard.metadata;
export const collegeFilterOptions = {
  states: [...new Set(colleges.map((college) => college.state))].sort((a, b) => (stateNames[a] ?? a).localeCompare(stateNames[b] ?? b)).map((code) => ({ code, name: stateNames[code] ?? code })),
  regions: [...new Set(colleges.flatMap((college) => college.region ? [college.region] : []))].sort(),
  programs: Object.entries(Object.fromEntries(colleges.flatMap((college) => college.programs.map((program) => [program.id, program.label])))).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)),
};

export function getCollege(slugOrId: string) { return bySlug.get(slugOrId) ?? byId.get(slugOrId) ?? null; }
export function getColleges(slugsOrIds: readonly string[]) { return slugsOrIds.flatMap((id) => { const college = getCollege(id); return college ? [college] : []; }); }
export function collegeSizeLabel(college: College) { return sizeBand(college.undergraduateEnrollment); }
export function collegeTypeLabel(college: College) {
  const research = college.carnegieBasic !== null && [15, 16, 17].includes(college.carnegieBasic) ? " research university" : college.degreeLevel === "Associate" ? " two-year college" : " university";
  return `${college.ownership}${research}`;
}

export function relatedColleges(college: College, limit = 5) {
  const programIds = new Set(college.programs.slice(0, 8).map((program) => program.id));
  return colleges.filter((candidate) => candidate.id !== college.id).map((candidate) => {
    const reasons: string[] = [];
    let score = 0;
    if (candidate.ownership === college.ownership) { score += 4; reasons.push(`also ${college.ownership.toLowerCase()}`); }
    if (candidate.setting === college.setting && college.setting) { score += 3; reasons.push(`a similarly ${college.setting.toLowerCase()} setting`); }
    if (candidate.region === college.region && college.region) { score += 2; reasons.push(`in the ${college.region}`); }
    if (sizeBand(candidate.undergraduateEnrollment) === sizeBand(college.undergraduateEnrollment)) { score += 3; reasons.push(`a similarly ${sizeBand(college.undergraduateEnrollment).toLowerCase()} undergraduate population`); }
    const overlap = candidate.programs.slice(0, 8).filter((program) => programIds.has(program.id)).length;
    score += overlap * 2;
    if (overlap) reasons.push("overlapping popular fields");
    if (acceptanceBand(candidate.acceptanceRate) === acceptanceBand(college.acceptanceRate) && college.acceptanceRate !== null) score += 2;
    return { college: candidate, score, reasons: reasons.slice(0, 2) };
  }).sort((a, b) => b.score - a.score || a.college.name.localeCompare(b.college.name)).slice(0, limit);
}

export const collegeCollections = [
  { id: "major-cities", title: "Universities in major cities", description: "Explore urban institutions in large metropolitan settings.", query: { setting: "Urban" } },
  { id: "large-public", title: "Large public universities", description: "Broad public institutions with 25,000+ undergraduates.", query: { ownership: "Public", size: "Very large" } },
  { id: "engineering", title: "Engineering-focused paths", description: "Institutions where engineering is an offered field—not a quality ranking.", query: { program: "14" } },
  { id: "hbcu", title: "Historically Black colleges", description: "Federally designated HBCUs across the country.", query: { designation: "hbcu" } },
  { id: "women", title: "Women’s colleges", description: "Institutions identified by federal data as women-only undergraduate colleges.", query: { designation: "women" } },
  { id: "california", title: "Colleges in California", description: "Public, private, two-year, and four-year options across California.", query: { state: "CA" } },
] satisfies Array<{ id: string; title: string; description: string; query: CollegeQuery }>;
