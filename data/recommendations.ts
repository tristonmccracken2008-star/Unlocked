import { opportunities, type Opportunity, type OpportunityType, type OpportunityWithQuality } from "./opportunities";
import { auditOpportunity, opportunityDuplicateKey } from "./opportunity-quality";

export type RecommendationProfile = {
  schoolSlug: string;
  schoolName: string;
  schoolLocation: string;
  major: string;
  minor?: string;
  academicYear: string;
  interests?: string;
  careerGoals?: string;
  clubs?: string;
  savedOpportunityIds?: string[];
  viewedOpportunityIds?: string[];
};

export type ScoredOpportunity = {
  opportunity: Opportunity;
  score: number;
  reasons: string[];
  confidence: "High" | "Medium" | "Low";
};

const majorSignals: Record<string, string[]> = {
  accounting: ["accounting", "audit", "tax", "finance", "business"],
  architecture: ["architecture", "design", "built environment", "studio"],
  biology: ["biology", "life sciences", "research", "health", "lab"],
  chemistry: ["chemistry", "lab", "research", "materials", "science"],
  communications: ["communications", "media", "marketing", "journalism"],
  "computer science": ["computer science", "software", "coding", "developer", "ai", "technology", "cybersecurity"],
  cybersecurity: ["cybersecurity", "security", "network", "technology", "software"],
  economics: ["economics", "policy", "finance", "data", "research"],
  education: ["education", "teaching", "youth", "school", "community"],
  english: ["english", "writing", "editing", "communications", "research"],
  mathematics: ["mathematics", "math", "quantitative", "data", "research", "statistics"],
  engineering: ["engineering", "technology", "hardware", "software", "research", "manufacturing"],
  business: ["business", "finance", "leadership", "marketing", "management", "entrepreneurship"],
  finance: ["finance", "business", "investment", "quantitative", "banking"],
  "fine arts": ["fine arts", "arts", "creative", "design", "portfolio"],
  history: ["history", "archives", "research", "writing", "humanities"],
  journalism: ["journalism", "media", "writing", "communications", "news"],
  marketing: ["marketing", "communications", "brand", "business", "media"],
  "data science": ["data science", "data", "analytics", "ai", "research", "statistics"],
  nursing: ["nursing", "clinical", "health", "patient", "medicine"],
  "pre-med": ["medicine", "health", "clinical", "research", "biology", "chemistry"],
  physics: ["physics", "science", "research", "engineering", "quantitative", "astronomy"],
  "political science": ["policy", "government", "law", "public service", "international relations"],
  psychology: ["psychology", "behavioral", "health", "research", "social science"],
  statistics: ["statistics", "data", "analytics", "quantitative", "research"],
  design: ["design", "product", "creative", "technology", "portfolio"],
};

const typeSignals: Record<OpportunityType, string[]> = {
  Benefit: ["benefit", "discount", "savings", "free", "student resources"],
  AI: ["ai", "artificial intelligence", "machine learning", "automation"],
  Career: ["career", "internship", "job", "leadership", "professional", "quantitative", "software"],
  Research: ["research", "lab", "science", "academic", "quantitative"],
  Scholarship: ["scholarship", "funding", "financial aid", "award", "tuition"],
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
const unique = <T,>(values: T[]) => [...new Set(values)];
const words = (value: string) => normalize(value).split(" ").filter((term) => term.length > 2);
const isOpportunityWithQuality = (value: OpportunityWithQuality | undefined): value is OpportunityWithQuality => Boolean(value);

function profileSignals(profile: RecommendationProfile) {
  const major = normalize(`${profile.major} ${profile.minor ?? ""}`);
  const derived = Object.entries(majorSignals).flatMap(([key, signals]) => major.includes(key) || key.includes(major) || signals.some((signal) => major.includes(signal)) ? signals : []);
  const explicit = [...words(profile.interests ?? ""), ...words(profile.careerGoals ?? ""), ...words(profile.clubs ?? "")];
  return unique([...derived, ...explicit]);
}

function searchableText(item: Opportunity) {
  return normalize([item.title, item.organization, item.category, item.description, item.location, ...item.majors, ...item.tags, item.metadata.researchArea ?? "", item.metadata.department ?? ""].join(" "));
}

function locationMatch(item: Opportunity, schoolLocation: string) {
  const opportunityLocation = normalize(item.location);
  return normalize(schoolLocation).split(/,|\s+/).filter((part) => part.length > 2).some((part) => opportunityLocation.includes(part));
}

function confidenceFor(score: number, reasons: string[], item: Opportunity) {
  const quality = auditOpportunity(item);
  if (quality.contentComplete && score >= 35 && reasons.length >= 2) return "High";
  if (quality.completenessScore >= 80 && score >= 20) return "Medium";
  return "Low";
}

export function scoreOpportunity(item: Opportunity, profile: RecommendationProfile): ScoredOpportunity {
  let score = 0;
  const reasons: string[] = [];
  const major = normalize(`${profile.major} ${profile.minor ?? ""}`);
  const text = searchableText(item);
  const quality = auditOpportunity(item);
  const interacted = [...(profile.savedOpportunityIds ?? []), ...(profile.viewedOpportunityIds ?? [])].map((id) => opportunities.find((candidate) => candidate.id === id)).filter(isOpportunityWithQuality);

  if (item.school_scope === "School Specific") {
    if (item.schools.includes(profile.schoolSlug)) { score += 34; reasons.push(`${profile.schoolName} opportunity`); }
    else score -= 80;
  } else { score += 7; reasons.push("National opportunity"); }

  const matchingMajors = item.majors.filter((itemMajor) => itemMajor !== "Any Major" && (major.includes(normalize(itemMajor)) || normalize(itemMajor).includes(major)));
  if (matchingMajors.length) { score += 18; reasons.push(`${matchingMajors[0]} major`); }
  else if (item.majors.includes("Any Major")) score += 4;

  if (item.academic_years.includes(profile.academicYear)) { score += 15; reasons.push(profile.academicYear); }
  else if (item.academic_years.includes("Any Year")) score += 4;
  else score -= 10;
  if (profile.academicYear === "First year" && item.category === "Freshman Programs") { score += 15; reasons.push("Designed for first-year students"); }

  const signals = profileSignals(profile);
  const matches = signals.filter((signal) => text.includes(signal));
  score += Math.min(20, matches.length * 4);
  if (matches.length) reasons.push(`Matches your interest in ${matches[0]}`);

  const explicitGoalMatches = words(profile.careerGoals ?? "").filter((term) => text.includes(term));
  if (explicitGoalMatches.length) { score += Math.min(12, explicitGoalMatches.length * 4); reasons.push("Supports your career goals"); }

  const preferredTypes = (Object.entries(typeSignals) as [OpportunityType, string[]][]).filter(([, signalsForType]) => signalsForType.some((signal) => signals.includes(signal) || text.includes(signal) && words(`${profile.interests ?? ""} ${profile.careerGoals ?? ""}`).includes(signal))).map(([type]) => type);
  if (preferredTypes.includes(item.type)) { score += 8; reasons.push(`${item.type} opportunity matches your profile`); }

  if (locationMatch(item, profile.schoolLocation)) { score += 7; reasons.push("Near your school"); }
  if (item.remote) { score += 4; reasons.push("Remote option"); }
  const interactionMatches = interacted.filter((candidate) => candidate.id !== item.id && (candidate.type === item.type || candidate.category === item.category || candidate.tags.some((tag) => item.tags.includes(tag))));
  if (interactionMatches.length) { score += Math.min(12, interactionMatches.length * 3); reasons.push("Similar to opportunities you opened or saved"); }
  if (item.featured) score += 4;
  if (item.hidden_gem) score += 3;
  if (item.verification_status === "verified") score += 6;
  if (quality.contentComplete) score += 8;
  else score -= Math.max(4, quality.missingFields.length * 3);
  if (item.verification_status === "needs_review" || item.verification_status === "community_reported") score -= 6;
  if (item.verification_status === "expired") score -= 100;

  const finalReasons = unique(reasons).slice(0, 4);
  return { opportunity: item, score, reasons: finalReasons, confidence: confidenceFor(score, finalReasons, item) };
}

export function rankOpportunities(profile: RecommendationProfile, source: readonly Opportunity[] = opportunities) {
  const seen = new Set<string>();
  return source.map((item) => scoreOpportunity(item, profile)).sort((a, b) => b.score - a.score || a.opportunity.title.localeCompare(b.opportunity.title)).filter(({ opportunity }) => {
    const key = opportunityDuplicateKey(opportunity);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function recommendedForYou(profile: RecommendationProfile, limit = 10) {
  const ranked = rankOpportunities(profile).filter((item) => item.opportunity.verification_status !== "expired" && item.confidence !== "Low" && item.score >= 20);
  const selected: ScoredOpportunity[] = [];
  const typeCounts = new Map<OpportunityType, number>();
  for (const item of ranked) {
    const count = typeCounts.get(item.opportunity.type) ?? 0;
    if (count >= 3) continue;
    selected.push(item);
    typeCounts.set(item.opportunity.type, count + 1);
    if (selected.length === limit) break;
  }
  return selected;
}

export function trendingOpportunities(profile: RecommendationProfile, limit = 5) {
  return rankOpportunities(profile).filter(({ opportunity }) => opportunity.verification_status !== "expired").sort((a, b) => {
    const trend = (item: ScoredOpportunity) => (item.opportunity.featured ? 12 : 0) + (item.opportunity.prestige === "Very High" ? 8 : item.opportunity.prestige === "High" ? 5 : 0) + (item.opportunity.verification_status === "verified" ? 4 : 0) + item.score * .1;
    return trend(b) - trend(a);
  }).slice(0, limit);
}

export function hiddenGemOpportunities(profile: RecommendationProfile, limit = 5) {
  return rankOpportunities(profile).filter(({ opportunity, score }) => opportunity.verification_status === "verified" && score > 0 && (opportunity.hidden_gem || (!opportunity.featured && opportunity.prestige !== "Very High"))).slice(0, limit);
}

export function expiringSoonOpportunities(profile: RecommendationProfile, limit = 5, days = 60) {
  const today = new Date();
  const cutoff = new Date(today); cutoff.setUTCDate(cutoff.getUTCDate() + days);
  return rankOpportunities(profile).filter(({ opportunity }) => {
    if (!opportunity.application_deadline) return false;
    const deadline = new Date(`${opportunity.application_deadline}T23:59:59Z`);
    return deadline >= today && deadline <= cutoff;
  }).sort((a, b) => (a.opportunity.application_deadline ?? "").localeCompare(b.opportunity.application_deadline ?? "")).slice(0, limit);
}

export function recentlyAddedOpportunities(profile: RecommendationProfile, limit = 5) {
  return rankOpportunities(profile).filter(({ opportunity }) => opportunity.verification_status !== "expired").sort((a, b) => b.opportunity.date_added.localeCompare(a.opportunity.date_added) || b.score - a.score).slice(0, limit);
}
