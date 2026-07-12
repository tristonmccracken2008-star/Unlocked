import type { Opportunity } from "./opportunities";

export type OrganizationIdentity = {
  displayName: string;
  normalizedName: string;
  matchedAlias?: string;
  domain?: string;
  logoUrl?: string;
  logoSource?: "curated" | "source" | "domain-provider" | "generated-fallback";
  logoVerified?: boolean;
};

export type ResolvedOrganizationLogo =
  | { kind: "image"; src: string; alt: string; initials: string; verified: boolean; source: "curated" | "source" | "domain-provider" }
  | { kind: "initials"; alt: string; initials: string; verified: false; source: "generated-fallback" }
  | { kind: "category"; alt: string; categoryIcon: string; verified: false; source: "generated-fallback" };

type OrganizationRegistryEntry = {
  displayName: string;
  aliases: string[];
  domain: string;
  logoUrl?: string;
  logoVerified: boolean;
};

const approvedLogoHosts = new Set(["logo.clearbit.com"]);
export const organizationLogoRegistry: OrganizationRegistryEntry[] = [
  { displayName: "GitHub", aliases: ["github", "github education", "github student developer pack"], domain: "github.com", logoUrl: "/logos/org/github.svg", logoVerified: true },
  { displayName: "OpenAI", aliases: ["openai", "chatgpt"], domain: "openai.com", logoUrl: "/logos/org/openai.svg", logoVerified: true },
  { displayName: "University of Chicago", aliases: ["university of chicago", "uchicago", "uchicago undergraduate scholarships"], domain: "uchicago.edu", logoUrl: "/logos/org/uchicago.svg", logoVerified: true },
  { displayName: "MIT", aliases: ["mit", "massachusetts institute of technology"], domain: "mit.edu", logoVerified: true },
  { displayName: "Apple", aliases: ["apple", "apple inc", "apple careers", "apple music"], domain: "apple.com", logoUrl: "/logos/org/apple.svg", logoVerified: true },
  { displayName: "Adobe", aliases: ["adobe", "adobe careers"], domain: "adobe.com", logoUrl: "/logos/org/adobe.svg", logoVerified: true },
  { displayName: "Amazon", aliases: ["amazon", "amazon future engineer"], domain: "amazon.com", logoUrl: "/logos/org/amazon.svg", logoVerified: true },
  { displayName: "Google", aliases: ["google", "google careers"], domain: "google.com", logoUrl: "/logos/org/google.svg", logoVerified: true },
  { displayName: "Microsoft", aliases: ["microsoft", "microsoft azure", "azure for students"], domain: "microsoft.com", logoUrl: "/logos/org/microsoft.svg", logoVerified: true },
  { displayName: "Meta", aliases: ["meta", "facebook"], domain: "meta.com", logoUrl: "/logos/org/meta.svg", logoVerified: true },
  { displayName: "Notion", aliases: ["notion", "notion labs"], domain: "notion.com", logoVerified: true },
  { displayName: "Figma", aliases: ["figma"], domain: "figma.com", logoVerified: true },
  { displayName: "JetBrains", aliases: ["jetbrains"], domain: "jetbrains.com", logoVerified: true },
  { displayName: "NASA", aliases: ["nasa"], domain: "nasa.gov", logoVerified: true },
  { displayName: "Jane Street", aliases: ["jane street"], domain: "janestreet.com", logoUrl: "/logos/org/jane-street.svg", logoVerified: true },
  { displayName: "AFCEA", aliases: ["afcea", "afcea educational foundation"], domain: "afcea.org", logoUrl: "/logos/org/afcea.svg", logoVerified: true },
  { displayName: "ASA", aliases: ["asa", "american statistical association"], domain: "amstat.org", logoVerified: true },
  { displayName: "8VC", aliases: ["8vc"], domain: "8vc.com", logoUrl: "/logos/org/8vc.svg", logoVerified: true },
  { displayName: "Coca-Cola", aliases: ["coca-cola", "coca cola", "coca-cola foundation"], domain: "coca-cola.com", logoVerified: true },
  { displayName: "QuestBridge", aliases: ["questbridge"], domain: "questbridge.org", logoVerified: true },
  { displayName: "UNiDAYS", aliases: ["unidays"], domain: "myunidays.com", logoVerified: true },
  { displayName: "Spotify", aliases: ["spotify"], domain: "spotify.com", logoVerified: true },
  { displayName: "Palantir", aliases: ["palantir"], domain: "palantir.com", logoVerified: true },
  { displayName: "HubSpot", aliases: ["hubspot"], domain: "hubspot.com", logoVerified: true },
  { displayName: "NVIDIA", aliases: ["nvidia"], domain: "nvidia.com", logoVerified: true },
  { displayName: "IBM", aliases: ["ibm"], domain: "ibm.com", logoVerified: true },
];

const registry = new Map<string, OrganizationRegistryEntry>();
for (const entry of organizationLogoRegistry) {
  registry.set(normalizeOrganizationName(entry.displayName), entry);
  for (const alias of entry.aliases) registry.set(normalizeOrganizationName(alias), entry);
}

const cache = new Map<string, ResolvedOrganizationLogo>();

export function normalizeOrganizationName(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function domainLogoUrl(domain: string) {
  return `https://logo.clearbit.com/${domain}`;
}

function initials(value: string) {
  const words = normalizeOrganizationName(value).split(" ").filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function trustedSourceLogo(url: string, officialSource: string) {
  const logoHost = hostname(url);
  const sourceHost = hostname(officialSource);
  return Boolean(url.startsWith("https://") && (approvedLogoHosts.has(logoHost) || (sourceHost && (logoHost === sourceHost || logoHost.endsWith(`.${sourceHost}`)))));
}

function categoryIcon(opportunity: Opportunity) {
  if (opportunity.type === "Research") return "R";
  if (opportunity.type === "Scholarship") return "$";
  if (opportunity.type === "AI") return "AI";
  if (opportunity.type === "Career") return "C";
  return "B";
}

export function organizationIdentity(opportunity: Opportunity): OrganizationIdentity {
  const displayName = opportunity.organization?.trim() ?? "";
  const normalizedName = normalizeOrganizationName(displayName);
  const entry = registry.get(normalizedName);
  const sourceDomain = hostname(opportunity.official_source);
  if (entry) return { displayName: entry.displayName, normalizedName, matchedAlias: normalizedName, domain: entry.domain, logoUrl: entry.logoUrl, logoSource: entry.logoUrl ? "curated" : "domain-provider", logoVerified: entry.logoVerified };
  return { displayName, normalizedName, domain: sourceDomain || undefined, logoSource: sourceDomain ? "domain-provider" : "generated-fallback", logoVerified: false };
}

export function resolveOrganizationLogo(opportunity: Opportunity): ResolvedOrganizationLogo {
  const key = `${opportunity.organization}|${opportunity.official_source}|${opportunity.icon ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const identity = organizationIdentity(opportunity);
  const alt = identity.displayName ? `${identity.displayName} logo` : `${opportunity.type} opportunity`;
  const sourceLogo = opportunity.icon && opportunity.icon.startsWith("https://") && trustedSourceLogo(opportunity.icon, opportunity.official_source) ? opportunity.icon : "";
  let resolved: ResolvedOrganizationLogo;
  if (identity.logoUrl) resolved = { kind: "image", src: identity.logoUrl, alt, initials: initials(identity.displayName), verified: Boolean(identity.logoVerified), source: "curated" };
  else if (sourceLogo) resolved = { kind: "image", src: sourceLogo, alt, initials: initials(identity.displayName), verified: true, source: "source" };
  else if (identity.domain) resolved = { kind: "image", src: domainLogoUrl(identity.domain), alt, initials: initials(identity.displayName || identity.domain), verified: Boolean(identity.logoVerified), source: "domain-provider" };
  else if (identity.displayName) resolved = { kind: "initials", alt, initials: initials(identity.displayName), verified: false, source: "generated-fallback" };
  else resolved = { kind: "category", alt, categoryIcon: categoryIcon(opportunity), verified: false, source: "generated-fallback" };
  cache.set(key, resolved);
  return resolved;
}

export function organizationLogoAudit(opportunities: readonly Opportunity[]) {
  const organizations = new Map<string, number>();
  const missingOrganization = opportunities.filter((item) => !item.organization?.trim()).map((item) => item.id);
  const unresolved = opportunities.filter((item) => resolveOrganizationLogo(item).kind !== "image").map((item) => ({ id: item.id, organization: item.organization }));
  const invalidDomains = opportunities.filter((item) => item.official_source && !hostname(item.official_source)).map((item) => item.id);
  for (const item of opportunities) {
    const normalized = normalizeOrganizationName(item.organization ?? "");
    if (normalized) organizations.set(normalized, (organizations.get(normalized) ?? 0) + 1);
  }
  return { missingOrganization, unresolved, invalidDomains, duplicateNormalizedOrganizations: [...organizations.entries()].filter(([, count]) => count > 1) };
}
