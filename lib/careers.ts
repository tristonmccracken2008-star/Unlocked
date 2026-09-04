import { careers, type CareerGrade, type CareerRecord } from "@/data/careers";

export type CareerSort = "name" | "salary" | "outlook" | "workLife" | "aiResilience" | "aiUpside" | "education";
export type CareerFilters = { query?: string; category?: string; salary?: string; hours?: string; education?: string; math?: string; coding?: string; people?: string; outlook?: string; aiResilience?: string; aiUpside?: string; workLife?: string; entry?: string; remote?: string; sort?: CareerSort };

const gradeOrder: Record<CareerGrade, number> = { "A+": 13, A: 12, "A-": 11, "B+": 10, B: 9, "B-": 8, "C+": 7, C: 6, "C-": 5, "D+": 4, D: 3, "D-": 2, F: 1 };
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const gradeAtLeast = (actual: CareerGrade, requested?: string) => !requested || requested === "All" || gradeOrder[actual] >= gradeOrder[requested as CareerGrade];
const performanceIndex = careers.map((career) => ({ career, search: normalize([career.name, ...career.aliases, career.category, career.industry, career.description, ...career.majors, ...Object.values(career.skills).flat(), ...career.discoveryTags, career.grades.aiUpside.grade.startsWith("A") ? "AI artificial intelligence augmented" : ""].join(" ")) }));

export function searchCareers(filters: CareerFilters = {}) {
  const query = normalize(filters.query ?? "");
  const tokens = query.split(" ").filter((token) => token && !["high","paying","without","med","school","careers","career","jobs","job","for","with"].includes(token));
  const filtered = performanceIndex.flatMap(({ career, search: haystack }) => {
    if (tokens.length && !tokens.every((token) => haystack.includes(token))) return [];
    if (filters.category && filters.category !== "All" && career.category !== filters.category) return [];
    if (filters.salary === "100k" && (career.salary.median ?? 0) < 100000) return [];
    if (filters.salary === "150k" && (career.salary.median ?? 0) < 150000) return [];
    if (filters.hours === "45" && career.hours.maximum > 45) return [];
    if (filters.hours === "50" && career.hours.maximum > 50) return [];
    if (filters.education && filters.education !== "All" && !career.education.level.toLowerCase().includes(filters.education.toLowerCase())) return [];
    if (filters.remote && filters.remote !== "All" && career.remotePotential !== filters.remote) return [];
    if (filters.math && filters.math !== "All" && career.intensity.quantitative !== filters.math) return [];
    if (filters.coding && filters.coding !== "All" && career.intensity.coding !== filters.coding) return [];
    if (filters.people && filters.people !== "All" && career.intensity.people !== filters.people) return [];
    if (!gradeAtLeast(career.grades.longTermOutlook.grade, filters.outlook)) return [];
    if (!gradeAtLeast(career.grades.aiResilience.grade, filters.aiResilience)) return [];
    if (!gradeAtLeast(career.grades.aiUpside.grade, filters.aiUpside)) return [];
    if (!gradeAtLeast(career.grades.workLife.grade, filters.workLife)) return [];
    if (!gradeAtLeast(career.grades.entryAccessibility.grade, filters.entry)) return [];
    return [career];
  });
  const sort = /\b(high paying|highest paid|best paid)\b/i.test(filters.query ?? "") ? "salary" : filters.sort ?? "name";
  return filtered.sort((a, b) => {
    if (sort === "salary") return (b.salary.median ?? -1) - (a.salary.median ?? -1) || a.name.localeCompare(b.name);
    if (sort === "education") return gradeOrder[b.grades.entryAccessibility.grade] - gradeOrder[a.grades.entryAccessibility.grade] || a.name.localeCompare(b.name);
    const dimension = sort === "outlook" ? "longTermOutlook" : sort;
    if (dimension !== "name") return gradeOrder[b.grades[dimension].grade] - gradeOrder[a.grades[dimension].grade] || a.name.localeCompare(b.name);
    if (query) {
      const relevance = (career: CareerRecord) => normalize(career.name).startsWith(query) ? 4 : normalize(career.name).includes(query) ? 3 : career.aliases.some((alias) => normalize(alias).includes(query)) ? 2 : 1;
      const difference = relevance(b) - relevance(a);
      if (difference) return difference;
    }
    return a.name.localeCompare(b.name);
  });
}

export function careerCollections() {
  const take = (records: CareerRecord[]) => records.slice(0, 8);
  return [
    { id: "highest-paying", title: "Highest paying", description: "Representative U.S. medians, not personalized compensation forecasts.", records: take(searchCareers({ sort: "salary" })) },
    { id: "ai-upside", title: "Strong AI upside", description: "Work where AI may increase productivity while people retain responsibility.", records: take(searchCareers({ aiUpside: "A-", sort: "aiUpside" })) },
    { id: "ai-resilient", title: "Most AI-resilient", description: "Core value depends on trust, physical work, accountability, or non-routine judgment.", records: take(searchCareers({ aiResilience: "A-", sort: "aiResilience" })) },
    { id: "work-life", title: "Stronger work-life balance", description: "Broad occupational schedules tend to be more predictable; employers still vary.", records: take(searchCareers({ workLife: "B+", sort: "workLife" })) },
    { id: "math", title: "Careers that use mathematics", description: "Paths connected to quantitative reasoning.", records: take(searchCareers({ query: "mathematics" })) },
    { id: "programming", title: "Careers using programming", description: "Paths with high or very high coding intensity.", records: take(careers.filter((career) => ["High","Very High"].includes(career.intensity.coding))) },
    { id: "no-graduate-school", title: "Careers without graduate school", description: "Paths where a bachelor’s degree, apprenticeship, or technical training is a common route.", records: take(careers.filter((career) => !/Master|Doctor|professional|Law degree/.test(career.education.level))) },
    { id: "human-interaction", title: "High human interaction", description: "Work centered on clients, patients, students, teams, or the public.", records: take(careers.filter((career) => career.intensity.people === "High")) },
    { id: "research-heavy", title: "Research-heavy careers", description: "Paths centered on forming questions and evaluating evidence.", records: take(careers.filter((career) => career.intensity.research === "High")) },
    { id: "lesser-known", title: "Careers you might not know exist", description: "Legitimate analytical and specialist paths beyond the obvious titles.", records: ["operations-research-analyst","biostatistician","patent-examiner","computational-scientist","clinical-data-manager","geospatial-analyst","bioinformatics-scientist","human-factors-engineer"].map((slug) => careers.find((career) => career.slug === slug)).filter((career): career is CareerRecord => Boolean(career)) },
    { id: "writing", title: "Careers for people who like writing", description: "Work centered on explanation, reporting, editing, or persuasion.", records: take(searchCareers({ query: "writing" })) },
  ];
}

export function careersPerformanceIndex() {
  return performanceIndex;
}
