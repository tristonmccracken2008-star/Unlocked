import { deadlineLabel, type Opportunity } from "@/data/opportunities";
import { projectOpportunityTrust } from "@/data/opportunity-trust";

export type OpportunityDetailKind = "benefit" | "scholarship" | "internship" | "research" | "competition" | "career";

export type OpportunityDetailFact = {
  label: string;
  value: string;
};

const genericDescriptionPatterns = [
  /^this matters because\b/i,
  /students? who meet the eligibility rules should review\b/i,
  /^use .+ official website as the starting point\b/i,
];

const genericRequirementPatterns = [
  /^start at .+ official website/i,
  /^search for the current office/i,
  /^confirm eligibility, deadlines, and application/i,
];

export function opportunityDetailKind(item: Opportunity): OpportunityDetailKind {
  if (item.type === "Benefit" || item.type === "AI") return "benefit";
  if (item.type === "Scholarship") return "scholarship";
  if (item.type === "Research") return "research";
  const taxonomy = `${item.category} ${item.title} ${item.tags.join(" ")}`.toLowerCase();
  if (/competition|challenge|hackathon|case contest|datathon/.test(taxonomy)) return "competition";
  if (/internship|co-op|campus job|student employment/.test(taxonomy)) return "internship";
  return "career";
}

export function conciseOpportunityDescription(item: Opportunity) {
  const sentences = item.description
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .filter((sentence) => !genericDescriptionPatterns.some((pattern) => pattern.test(sentence)));
  const first = sentences[0] || `${item.title} from ${item.organization}.`;
  const second = sentences[1];
  const description = second && first.length < 120 && first.length + second.length <= 220 ? `${first} ${second}` : first;
  if (description.length <= 220) return description;
  const clipped = description.slice(0, 217).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "");
  return `${clipped}…`;
}

export function opportunityValueLabel(item: Opportunity) {
  if (item.estimated_value) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.estimated_value);
  return item.metadata.awardAmountLabel
    ?? item.metadata.discountAmount
    ?? item.metadata.valueLabel
    ?? item.metadata.studentOffer
    ?? item.metadata.freeTier
    ?? item.metadata.pricing
    ?? "Not published by the provider";
}

function workMode(item: Opportunity) {
  if (item.metadata.workMode) return item.metadata.workMode;
  if (item.remote === true) return "Remote";
  if (item.remote === false) return "In person";
  return null;
}

function compensation(item: Opportunity) {
  if (item.metadata.compensation) return item.metadata.compensation;
  if (item.paid === true) return "Paid";
  if (item.paid === false) return "Unpaid";
  return null;
}

function accessMethod(item: Opportunity) {
  return item.metadata.verificationMethod
    ?? item.metadata.verificationRequired
    ?? (item.type === "AI" ? "Provider account" : "Student verification may be required");
}

function applicationEffort(item: Opportunity) {
  if (item.metadata.estimatedApplicationTime && item.metadata.estimatedApplicationTime !== "Unknown") return item.metadata.estimatedApplicationTime;
  const count = specificRequirements(item).length;
  if (count) return `${count} listed requirement${count === 1 ? "" : "s"}`;
  return null;
}

function applicationDeadline(item: Opportunity) {
  const trust = projectOpportunityTrust(item);
  if (trust.deadline.state !== "verified") return trust.deadline.displayValue;
  return deadlineLabel(item);
}

function meaningfulValue(item: Opportunity) {
  const value = opportunityValueLabel(item);
  return /^(unknown|n\/a|not available|not published by the provider)$/i.test(value.trim()) ? null : value;
}

function fact(label: string, value: string | null | undefined): OpportunityDetailFact | null {
  const normalized = value?.trim();
  return normalized ? { label, value: normalized } : null;
}

function compactFacts(facts: Array<OpportunityDetailFact | null>) {
  return facts.filter((entry): entry is OpportunityDetailFact => Boolean(entry));
}

export function primaryOpportunityFacts(item: Opportunity): OpportunityDetailFact[] {
  const kind = opportunityDetailKind(item);
  if (kind === "benefit") return compactFacts([
    fact("Value", meaningfulValue(item)),
    fact("Access", accessMethod(item)),
    fact("Deadline", applicationDeadline(item)),
  ]);
  if (kind === "scholarship") return compactFacts([
    fact("Award", meaningfulValue(item) ?? "Not published by the provider"),
    fact("Deadline", applicationDeadline(item)),
    fact("Application", applicationEffort(item)),
    fact("Renewal", item.metadata.renewable === true ? "Renewable" : item.metadata.renewable === false ? "One-time" : null),
  ]);
  if (kind === "internship") return compactFacts([
    fact("Location", item.location),
    fact("Format", workMode(item)),
    fact("Compensation", compensation(item)),
    fact("Duration", item.metadata.internshipDuration),
    fact("Deadline", applicationDeadline(item)),
  ]);
  if (kind === "research") return compactFacts([
    fact("Research focus", item.metadata.researchArea ?? item.category),
    fact("Term", item.metadata.semesters?.join(", ") || item.metadata.applicationSeason),
    fact("Location", item.location || workMode(item)),
    fact("Funding", item.metadata.stipendAmount ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.metadata.stipendAmount) : compensation(item)),
    fact("Deadline", applicationDeadline(item)),
  ]);
  if (kind === "competition") return compactFacts([
    fact("Prize", meaningfulValue(item)),
    fact("Deadline", applicationDeadline(item)),
    fact("Format", workMode(item)),
    fact("Difficulty", item.difficulty ?? item.metadata.estimatedCompetitiveness),
  ]);
  return compactFacts([
    fact("Location", item.location),
    fact("Format", workMode(item)),
    fact("Compensation", compensation(item)),
    fact("Duration", item.metadata.internshipDuration),
    fact("Deadline", applicationDeadline(item)),
  ]);
}

export function specificRequirements(item: Opportunity) {
  return [...new Set(item.metadata.applicationRequirements ?? [])]
    .filter((requirement) => !genericRequirementPatterns.some((pattern) => pattern.test(requirement)));
}

export function opportunityApplicationSteps(item: Opportunity) {
  if (item.metadata.claimSteps?.length) return item.metadata.claimSteps.slice(0, 4);
  const kind = opportunityDetailKind(item);
  const opening = kind === "benefit"
    ? "Confirm the current student offer and eligibility on the official page."
    : "Confirm the current eligibility rules and application window on the official page.";
  const middle = specificRequirements(item).length
    ? "Prepare the materials listed by the provider."
    : "Review the provider’s current instructions and required materials.";
  const ending = kind === "benefit"
    ? `Claim or activate the offer through ${item.organization}.`
    : `Submit through ${item.organization}’s official application.`;
  return [opening, middle, ending];
}

export function applicationSectionTitle(item: Opportunity) {
  return opportunityDetailKind(item) === "benefit" ? "How to claim it" : "How to apply";
}

export function eligibilityScopeFacts(item: Opportunity, schoolNames: string[]): OpportunityDetailFact[] {
  const facts: OpportunityDetailFact[] = [];
  if (item.school_scope === "School Specific") facts.push({ label: "School", value: schoolNames.length > 3 ? `${schoolNames.length} listed schools · Full list in details` : schoolNames.join(", ") || "See official eligibility" });
  if (!item.majors.includes("Any Major")) facts.push({ label: "Majors", value: item.majors.length > 6 ? `${item.majors.length} listed majors · Full list in details` : item.majors.join(", ") });
  if (!item.academic_years.includes("Any Year")) facts.push({ label: "Class years", value: item.academic_years.join(", ") });
  return facts;
}

function humanize(values: string[]) {
  return values.map((value) => value.replaceAll("_", " ")).join(", ");
}

export function opportunityEligibilityCriteria(item: Opportunity, schoolNames: string[]): OpportunityDetailFact[] {
  const rules = item.metadata.eligibilityRules;
  const criteria = [...eligibilityScopeFacts(item, schoolNames)];
  if (rules?.educationLevels?.length) criteria.push({ label: "Education level", value: humanize(rules.educationLevels) });
  if (rules?.enrollmentStatuses?.length) criteria.push({ label: "Enrollment", value: humanize(rules.enrollmentStatuses) });
  if (rules?.citizenship && rules.citizenship !== "unknown") criteria.push({ label: "Citizenship", value: rules.citizenship.replaceAll("_", " ") });
  if (rules?.minimumGpa) criteria.push({ label: "Minimum GPA", value: `${rules.minimumGpa}+` });
  if (rules?.residency?.length) criteria.push({ label: "Residency", value: rules.residency.join(", ") });
  return criteria.filter((entry, index) => criteria.findIndex((candidate) => candidate.label === entry.label && candidate.value === entry.value) === index);
}

export function opportunityOfficialActionLabel(item: Opportunity, actionable: boolean) {
  if (!actionable) return "View official source";
  const kind = opportunityDetailKind(item);
  if (kind === "benefit") return item.type === "AI" ? "View official tool" : "Claim student benefit";
  if (kind === "scholarship") return "View scholarship";
  if (kind === "research") return "View research program";
  if (kind === "competition") return "View competition";
  if (kind === "internship" && item.organization.length <= 28) return `Apply on ${item.organization}`;
  return "Visit official program";
}
