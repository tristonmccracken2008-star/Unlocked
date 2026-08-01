import { deadlineLabel, type Opportunity } from "@/data/opportunities";

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
  if (second && first.length < 120 && first.length + second.length <= 220) return `${first} ${second}`;
  return first;
}

export function opportunityValueLabel(item: Opportunity) {
  if (item.estimated_value) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.estimated_value);
  return item.metadata.awardAmountLabel
    ?? item.metadata.discountAmount
    ?? item.metadata.valueLabel
    ?? item.metadata.studentOffer
    ?? item.metadata.freeTier
    ?? item.metadata.pricing
    ?? "Not listed";
}

function workMode(item: Opportunity) {
  if (item.metadata.workMode) return item.metadata.workMode;
  if (item.remote === true) return "Remote";
  if (item.remote === false) return "In person";
  return "Not listed";
}

function compensation(item: Opportunity) {
  if (item.metadata.compensation) return item.metadata.compensation;
  if (item.paid === true) return "Paid";
  if (item.paid === false) return "Unpaid";
  return "Not listed";
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
  return "Not listed";
}

export function primaryOpportunityFacts(item: Opportunity): OpportunityDetailFact[] {
  const kind = opportunityDetailKind(item);
  if (kind === "benefit") return [
    { label: "Value", value: opportunityValueLabel(item) },
    { label: "Access", value: accessMethod(item) },
    { label: "Deadline", value: deadlineLabel(item) },
  ];
  if (kind === "scholarship") return [
    { label: "Award", value: opportunityValueLabel(item) },
    { label: "Deadline", value: deadlineLabel(item) },
    { label: "Application", value: applicationEffort(item) },
    { label: "Renewal", value: item.metadata.renewable === true ? "Renewable" : item.metadata.renewable === false ? "One-time" : "Varies" },
  ];
  if (kind === "internship") return [
    { label: "Location", value: item.location || "Not listed" },
    { label: "Format", value: workMode(item) },
    { label: "Compensation", value: compensation(item) },
    { label: "Deadline", value: deadlineLabel(item) },
  ];
  if (kind === "research") return [
    { label: "Research focus", value: item.metadata.researchArea ?? item.category },
    { label: "Term", value: item.metadata.semesters?.join(", ") || item.metadata.applicationSeason || "Not listed" },
    { label: "Location", value: item.location || workMode(item) },
    { label: "Funding", value: item.metadata.stipendAmount ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.metadata.stipendAmount) : compensation(item) },
  ];
  if (kind === "competition") return [
    { label: "Prize", value: opportunityValueLabel(item) },
    { label: "Deadline", value: deadlineLabel(item) },
    { label: "Format", value: workMode(item) },
    { label: "Difficulty", value: item.difficulty ?? item.metadata.estimatedCompetitiveness ?? "Not listed" },
  ];
  return [
    { label: "Location", value: item.location || "Not listed" },
    { label: "Format", value: workMode(item) },
    { label: "Compensation", value: compensation(item) },
    { label: "Deadline", value: deadlineLabel(item) },
  ];
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
  return opportunityDetailKind(item) === "benefit" ? "How to access it" : "How to apply";
}

export function eligibilityScopeFacts(item: Opportunity, schoolNames: string[]): OpportunityDetailFact[] {
  const facts: OpportunityDetailFact[] = [];
  if (item.school_scope === "School Specific") facts.push({ label: "School", value: schoolNames.length > 3 ? `${schoolNames.length} listed schools · Full list in Learn More` : schoolNames.join(", ") || "See official eligibility" });
  if (!item.majors.includes("Any Major")) facts.push({ label: "Majors", value: item.majors.length > 6 ? `${item.majors.length} listed majors · Full list in Learn More` : item.majors.join(", ") });
  if (!item.academic_years.includes("Any Year")) facts.push({ label: "Class years", value: item.academic_years.join(", ") });
  return facts;
}
