import { organizationIdentity, resolveOrganizationLogo } from "./organization-logos";
import type { Opportunity } from "./opportunities";

export type CanonicalOpportunityCategory =
  | "Internship"
  | "Research"
  | "Scholarship"
  | "Fellowship"
  | "Competition"
  | "Campus Job"
  | "Student Benefit"
  | "Software"
  | "Conference"
  | "Mentorship"
  | "Program"
  | "Certification"
  | "Workshop";

export type StructuredEligibility = {
  freshmanEligible: boolean | null;
  sophomoreEligible: boolean | null;
  juniorEligible: boolean | null;
  seniorEligible: boolean | null;
  graduateEligible: boolean | null;
  internationalEligible: boolean | null;
  transferEligible: boolean | null;
  minimumGPA: number | null;
  preferredMajors: string[];
  requiredMajors: string[];
  schoolRestrictions: string[];
};

export type LinkValidationState = "unchecked" | "valid_format" | "missing" | "non_https" | "invalid_url";

export type CanonicalOpportunity = {
  id: string;
  title: string;
  organization: string;
  organizationDomain: string | null;
  normalizedOrganization: string;
  logo: string | null;
  category: CanonicalOpportunityCategory;
  subcategory: string;
  opportunityType: Opportunity["type"];
  description: string;
  deadline: string | null;
  rollingDeadline: boolean | null;
  verified: boolean;
  location: string;
  remote: boolean | null;
  paid: boolean | null;
  compensation: "Paid" | "Unpaid" | "Varies" | "Unknown";
  currency: "USD" | null;
  applicationURL: string | null;
  officialWebsite: string | null;
  eligibility: StructuredEligibility;
  careerFields: string[];
  tags: string[];
  difficulty: Opportunity["difficulty"];
  estimatedTimeCommitment: string;
  lastVerified: string;
  verificationSource: string;
  verificationState: Opportunity["verification_status"];
  linkStatus: LinkValidationState;
  dataQualityScore: number;
  duplicateKey: string;
  searchText: string;
};

export type DuplicateOpportunityGroup = {
  key: string;
  ids: string[];
  titles: string[];
};

const normalize = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
const unique = <T,>(values: T[]) => [...new Set(values.filter(Boolean))];

function hostname(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function canonicalCategory(item: Opportunity): CanonicalOpportunityCategory {
  if (item.type === "Scholarship") return "Scholarship";
  if (item.type === "Research") return "Research";
  if (item.type === "AI") return "Software";
  if (item.type === "Benefit") return item.category === "Software" ? "Software" : "Student Benefit";
  const category = item.category.toLowerCase();
  if (category.includes("internship") || category.includes("co-op")) return "Internship";
  if (category.includes("fellowship")) return "Fellowship";
  if (category.includes("competition") || category.includes("hackathon")) return "Competition";
  if (category.includes("campus job")) return "Campus Job";
  if (category.includes("conference") || category.includes("event")) return "Conference";
  if (category.includes("mentor")) return "Mentorship";
  if (category.includes("certification")) return "Certification";
  if (category.includes("workshop")) return "Workshop";
  return "Program";
}

function minimumGPA(item: Opportunity) {
  const text = `${item.eligibility} ${(item.metadata.applicationRequirements ?? []).join(" ")} ${(item.metadata.eligibilityNotes ?? []).join(" ")}`;
  const matches = [...text.matchAll(/\b([2-4](?:\.\d{1,2})?)\s*(?:minimum\s*)?gpa\b|\bgpa\s*(?:of|minimum|required|at least)?\s*([2-4](?:\.\d{1,2})?)/gi)]
    .map((match) => Number(match[1] ?? match[2]))
    .filter((value) => Number.isFinite(value) && value >= 2 && value <= 4);
  return matches.length ? Math.max(...matches) : null;
}

function internationalEligible(item: Opportunity) {
  const text = normalize(item.eligibility);
  if (/international students? (are )?(eligible|welcome|may apply)/i.test(item.eligibility)) return true;
  if (text.includes("u s citizen") || text.includes("us citizen") || text.includes("permanent resident")) return false;
  return null;
}

function transferEligible(item: Opportunity) {
  const text = normalize(item.eligibility);
  if (text.includes("transfer student")) return true;
  return null;
}

function yearEligible(item: Opportunity, year: string) {
  if (item.academic_years.includes("Any Year")) return true;
  return item.academic_years.includes(year);
}

export function structuredEligibility(item: Opportunity): StructuredEligibility {
  const requiredMajors = item.majors.includes("Any Major") ? [] : item.majors;
  const preferredMajors = item.majors.includes("Any Major") ? ["Any Major"] : item.majors;
  return {
    freshmanEligible: yearEligible(item, "First year"),
    sophomoreEligible: yearEligible(item, "Second year"),
    juniorEligible: yearEligible(item, "Third year"),
    seniorEligible: yearEligible(item, "Fourth year"),
    graduateEligible: yearEligible(item, "Graduate student"),
    internationalEligible: internationalEligible(item),
    transferEligible: transferEligible(item),
    minimumGPA: minimumGPA(item),
    preferredMajors,
    requiredMajors,
    schoolRestrictions: item.school_scope === "School Specific" ? item.schools : [],
  };
}

function linkStatus(url: string | null | undefined): LinkValidationState {
  if (!url) return "missing";
  if (!url.startsWith("https://")) return "non_https";
  return hostname(url) ? "valid_format" : "invalid_url";
}

function careerFields(item: Opportunity) {
  const text = normalize([item.title, item.organization, item.category, item.description, item.eligibility, ...item.tags, ...item.majors].join(" "));
  const fields: string[] = [];
  const add = (field: string, terms: string[]) => { if (terms.some((term) => text.includes(normalize(term)))) fields.push(field); };
  add("Software Engineering", ["software", "developer", "programming", "computer science", "github"]);
  add("AI / Machine Learning", ["ai", "machine learning", "artificial intelligence", "deep learning"]);
  add("Data Science", ["data", "analytics", "statistics", "quantitative"]);
  add("Quantitative Finance", ["quant", "trading", "investment", "finance", "markets"]);
  add("Research", ["research", "lab", "faculty", "paper"]);
  add("Healthcare", ["health", "medicine", "clinical", "biology", "pre med"]);
  add("Law / Public Policy", ["law", "policy", "government", "public"]);
  add("Business", ["business", "marketing", "management", "entrepreneurship"]);
  add("Design", ["design", "ux", "portfolio", "creative"]);
  return unique(fields.length ? fields : [item.type === "Benefit" ? "Student Support" : canonicalCategory(item)]);
}

function enrichedTags(item: Opportunity, fields: string[]) {
  const seasonal = item.metadata.semesters ?? [];
  const mode = item.remote === true ? ["Remote"] : item.remote === false ? ["In Person"] : [];
  const compensation = item.paid === true ? ["Paid"] : item.paid === false ? ["Unpaid"] : [];
  return unique([
    ...item.tags,
    ...item.majors.filter((major) => major !== "Any Major"),
    ...fields,
    item.type,
    item.category,
    canonicalCategory(item),
    ...seasonal,
    ...mode,
    ...compensation,
  ]).slice(0, 36);
}

function estimatedTimeCommitment(item: Opportunity) {
  if (item.metadata.applicationRequirements && item.metadata.applicationRequirements.length >= 3) return "3-5 hours";
  if (item.difficulty === "Highly Competitive" || item.category === "Fellowships") return "1-2 weeks";
  if (["Scholarship", "Research", "Career"].includes(item.type)) return "1-2 hours";
  if (item.type === "Benefit" || item.type === "AI") return "15-30 minutes";
  return "Unknown";
}

export function opportunityDuplicateKey(item: Opportunity) {
  return normalize([item.title, item.organization, item.official_source_url, item.application_deadline ?? item.metadata.deadlineType ?? ""].join(" "));
}

export function canonicalOpportunity(item: Opportunity): CanonicalOpportunity {
  const org = organizationIdentity(item);
  const logo = resolveOrganizationLogo(item);
  const fields = careerFields(item);
  const tags = enrichedTags(item, fields);
  const officialWebsite = item.official_source_url || item.official_source || null;
  const quality = dataQualityScore(item);
  return {
    id: item.id,
    title: item.title.trim(),
    organization: org.displayName || item.organization.trim(),
    organizationDomain: org.domain ?? hostname(officialWebsite),
    normalizedOrganization: org.normalizedName || normalize(item.organization),
    logo: logo.kind === "image" ? logo.src : null,
    category: canonicalCategory(item),
    subcategory: item.metadata.researchArea ?? item.metadata.department ?? item.metadata.offerType ?? item.category,
    opportunityType: item.type,
    description: item.description.replace(/\s+/g, " ").trim(),
    deadline: item.application_deadline,
    rollingDeadline: item.metadata.deadlineType === "rolling" ? true : item.metadata.deadlineType === "fixed" ? false : null,
    verified: item.verification_status === "verified",
    location: item.location,
    remote: item.remote,
    paid: item.paid,
    compensation: item.metadata.compensation ?? (item.paid === true ? "Paid" : item.paid === false ? "Unpaid" : "Unknown"),
    currency: item.estimated_value !== null ? "USD" : null,
    applicationURL: item.metadata.claimUrl ?? officialWebsite,
    officialWebsite,
    eligibility: structuredEligibility(item),
    careerFields: fields,
    tags,
    difficulty: item.difficulty,
    estimatedTimeCommitment: estimatedTimeCommitment(item),
    lastVerified: item.last_verified,
    verificationSource: item.official_source_url,
    verificationState: item.verification_status,
    linkStatus: linkStatus(officialWebsite),
    dataQualityScore: quality,
    duplicateKey: opportunityDuplicateKey(item),
    searchText: normalize([item.title, org.displayName, item.organization, item.type, item.category, canonicalCategory(item), item.description, item.eligibility, item.location, ...item.majors, ...tags, ...fields].join(" ")),
  };
}

export function dataQualityScore(item: Opportunity) {
  const org = organizationIdentity(item);
  const logo = resolveOrganizationLogo(item);
  let score = 0;
  if (item.verification_status === "verified") score += 18;
  if (item.official_source_url?.startsWith("https://")) score += 12;
  if (hostname(item.official_source_url)) score += 8;
  if (item.organization?.trim()) score += 8;
  if (org.domain) score += 6;
  if (logo.kind === "image") score += 6;
  if (item.description.trim().length >= 80) score += 10;
  if (item.eligibility.trim().length >= 30) score += 10;
  if (item.application_deadline || ["rolling", "varies", "not_announced"].includes(item.metadata.deadlineType ?? "")) score += 7;
  if (item.tags.length >= 3) score += 6;
  if (item.majors.length) score += 5;
  if (item.academic_years.length) score += 5;
  if (item.estimated_value !== null || /unknown|not documented|not published/i.test(item.estimated_value_note)) score += 4;
  if (item.verification_status === "expired") score = Math.min(score, 20);
  if (linkStatus(item.official_source_url) !== "valid_format") score = Math.min(score, 55);
  return Math.max(0, Math.min(100, score));
}

export function detectDuplicateOpportunities(items: readonly Opportunity[]): DuplicateOpportunityGroup[] {
  const groups = new Map<string, Opportunity[]>();
  for (const item of items) groups.set(opportunityDuplicateKey(item), [...(groups.get(opportunityDuplicateKey(item)) ?? []), item]);
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, ids: group.map((item) => item.id), titles: group.map((item) => item.title) }));
}

export function opportunityEnrichmentAudit(items: readonly Opportunity[]) {
  const canonical = items.map(canonicalOpportunity);
  const duplicates = detectDuplicateOpportunities(items);
  const brokenLinks = canonical.filter((item) => item.linkStatus !== "valid_format").map((item) => ({ id: item.id, status: item.linkStatus, url: item.officialWebsite }));
  const missingLogos = canonical.filter((item) => !item.logo).map((item) => ({ id: item.id, organization: item.organization }));
  const lowQuality = canonical.filter((item) => item.dataQualityScore < 70).map((item) => ({ id: item.id, score: item.dataQualityScore }));
  const organizationMap = new Map<string, string[]>();
  for (const item of canonical) organizationMap.set(item.normalizedOrganization, [...(organizationMap.get(item.normalizedOrganization) ?? []), item.organization]);
  const duplicateOrganizations = [...organizationMap.entries()].filter(([, names]) => new Set(names).size > 1).map(([normalizedName, names]) => ({ normalizedName, names: [...new Set(names)] }));
  return {
    total: items.length,
    canonical,
    duplicates,
    brokenLinks,
    missingLogos,
    lowQuality,
    duplicateOrganizations,
    averageDataQualityScore: Math.round(canonical.reduce((sum, item) => sum + item.dataQualityScore, 0) / Math.max(1, canonical.length)),
  };
}
