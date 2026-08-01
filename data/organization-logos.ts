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

export type OrganizationCategoryIcon = "scholarship" | "internship" | "research" | "competition" | "benefit" | "academic" | "software" | "career";
export type OrganizationMonogramTone = "forest" | "espresso" | "gold" | "blue" | "plum";

type ResolvedFallback = {
  alt: string;
  initials: string;
  categoryIcon: OrganizationCategoryIcon;
  tone: OrganizationMonogramTone;
};

export type ResolvedOrganizationLogo =
  | (ResolvedFallback & { kind: "image"; src: string; verified: boolean; source: "curated" | "source" | "domain-provider" })
  | (ResolvedFallback & { kind: "initials"; verified: false; source: "generated-fallback" })
  | (ResolvedFallback & { kind: "category"; verified: false; source: "generated-fallback" });

export type OrganizationLogoInput = {
  organization?: string | null;
  officialSource?: string | null;
  icon?: string | null;
  type?: string | null;
  category?: string | null;
};

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
const registryByDomain = new Map<string, OrganizationRegistryEntry>();
for (const entry of organizationLogoRegistry) {
  registry.set(normalizeOrganizationName(entry.displayName), entry);
  for (const alias of entry.aliases) registry.set(normalizeOrganizationName(alias), entry);
  registryByDomain.set(entry.domain, entry);
}
const registryDomains = [...registryByDomain.entries()].sort(([left], [right]) => right.length - left.length);

const cache = new Map<string, ResolvedOrganizationLogo>();

export function normalizeOrganizationName(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function domainLogoUrl(domain: string) {
  return `https://logo.clearbit.com/${domain}`;
}

export function organizationInitials(value: string) {
  const words = normalizeOrganizationName(value).split(" ").filter((word) => word && !["a", "an", "and", "at", "for", "of", "the"].includes(word));
  if (!words.length) return "";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
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

export function organizationCategoryIcon(type = "", category = ""): OrganizationCategoryIcon {
  const value = `${type} ${category}`.toLowerCase();
  if (/scholarship|grant|financial aid/.test(value)) return "scholarship";
  if (/internship|co-op|campus job/.test(value)) return "internship";
  if (/research|fellowship/.test(value)) return "research";
  if (/competition|award|challenge|hackathon/.test(value)) return "competition";
  if (/software|ai|tool|certification/.test(value)) return "software";
  if (/academic|study abroad|conference|program/.test(value)) return "academic";
  if (/career|leadership/.test(value)) return "career";
  return "benefit";
}

export function organizationMonogramTone(value: string): OrganizationMonogramTone {
  const tones: OrganizationMonogramTone[] = ["forest", "espresso", "gold", "blue", "plum"];
  let hash = 0;
  for (const character of normalizeOrganizationName(value)) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return tones[Math.abs(hash) % tones.length];
}

function registryEntry(name: string, sourceDomain: string) {
  const direct = registry.get(name);
  if (direct) return direct;
  if (!sourceDomain) return undefined;
  return registryDomains.find(([domain]) => sourceDomain === domain || sourceDomain.endsWith(`.${domain}`))?.[1];
}

export function organizationIdentity(opportunity: Opportunity): OrganizationIdentity {
  const displayName = opportunity.organization?.trim() ?? "";
  const normalizedName = normalizeOrganizationName(displayName);
  const sourceDomain = hostname(opportunity.official_source);
  const entry = registryEntry(normalizedName, sourceDomain);
  if (entry) return { displayName: entry.displayName, normalizedName, matchedAlias: normalizedName, domain: entry.domain, logoUrl: entry.logoUrl, logoSource: entry.logoUrl ? "curated" : "domain-provider", logoVerified: entry.logoVerified };
  return { displayName, normalizedName, domain: sourceDomain || undefined, logoSource: sourceDomain ? "domain-provider" : "generated-fallback", logoVerified: false };
}

export function resolveOrganizationMark(input: OrganizationLogoInput): ResolvedOrganizationLogo {
  const displayName = input.organization?.trim() ?? "";
  const officialSource = input.officialSource?.trim() ?? "";
  const sourceDomain = hostname(officialSource);
  const normalizedName = normalizeOrganizationName(displayName);
  const entry = registryEntry(normalizedName, sourceDomain);
  const identity: OrganizationIdentity = entry
    ? { displayName: entry.displayName, normalizedName, matchedAlias: normalizedName, domain: entry.domain, logoUrl: entry.logoUrl, logoSource: entry.logoUrl ? "curated" : "domain-provider", logoVerified: entry.logoVerified }
    : { displayName, normalizedName, domain: sourceDomain || undefined, logoSource: sourceDomain ? "domain-provider" : "generated-fallback", logoVerified: false };
  const key = `${displayName}|${officialSource}|${input.icon ?? ""}|${input.type ?? ""}|${input.category ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const category = organizationCategoryIcon(input.type ?? "", input.category ?? "");
  const alt = identity.displayName ? `${identity.displayName} logo` : `${input.category || input.type || "Opportunity"} icon`;
  const fallback = {
    alt,
    initials: organizationInitials(identity.displayName || identity.domain || ""),
    categoryIcon: category,
    tone: organizationMonogramTone(identity.displayName || input.category || input.type || "opportunity"),
  };
  const sourceLogo = input.icon && input.icon.startsWith("https://") && trustedSourceLogo(input.icon, officialSource) ? input.icon : "";
  let resolved: ResolvedOrganizationLogo;
  if (identity.logoUrl) resolved = { ...fallback, kind: "image", src: identity.logoUrl, verified: Boolean(identity.logoVerified), source: "curated" };
  else if (sourceLogo) resolved = { ...fallback, kind: "image", src: sourceLogo, verified: true, source: "source" };
  else if (identity.domain) resolved = { ...fallback, kind: "image", src: domainLogoUrl(identity.domain), verified: Boolean(identity.logoVerified), source: "domain-provider" };
  else if (fallback.initials) resolved = { ...fallback, kind: "initials", verified: false, source: "generated-fallback" };
  else resolved = { ...fallback, kind: "category", verified: false, source: "generated-fallback" };
  cache.set(key, resolved);
  return resolved;
}

export function resolveOrganizationLogo(opportunity: Opportunity): ResolvedOrganizationLogo {
  return resolveOrganizationMark({
    organization: opportunity.organization,
    officialSource: opportunity.official_source,
    icon: opportunity.icon,
    type: opportunity.type,
    category: opportunity.category,
  });
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
