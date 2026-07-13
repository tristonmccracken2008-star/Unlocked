import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(root, "data/db/opportunities.json");
const reportPath = path.join(root, "docs/OPPORTUNITY_VERIFICATION_PERFORMANCE_REPORT.md");
const opportunities = JSON.parse(fs.readFileSync(dbPath, "utf8"));
const today = "2026-07-13";
const prefix = "national-curated-2026--";

const finalStates = {
  "national-curated-2026--nasa--nasa-ostem-internships": { status: "verified", deadlineType: "fixed", verifiedCycle: "Summer 2027", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official NASA internship page lists OSTEM internships as paid and publishes 2027 term dates/deadlines and baseline eligibility." },
  "national-curated-2026--nasa--nasa-pathways-internships": { status: "needs_review", deadlineType: "varies", verifiedCycle: "USAJOBS posting-dependent", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: true, notes: "NASA describes Pathways as a paid internship-to-employment pathway, but active postings and deadlines vary by USAJOBS cycle." },
  "national-curated-2026--u-s-department-of-energy-office-of-science--doe-science-undergraduate-laboratory-internships": { status: "verified", deadlineType: "fixed", verifiedCycle: "Spring 2027", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official DOE SULI page lists the Spring 2027 deadline and undergraduate national laboratory research program details." },
  "national-curated-2026--u-s-department-of-state--gilman-international-scholarship": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "cycle-specific", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official provider page exists, but the current application cycle and deadline were not confirmed in the curated record." },
  "national-curated-2026--u-s-department-of-defense--smart-scholarship-for-service-program": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "cycle-specific", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official program page exists; cycle, award terms, and service requirements need fresh review before recommendation." },
  "national-curated-2026--udall-foundation--udall-undergraduate-scholarship": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "cycle-specific", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official foundation page exists; annual nomination deadline and eligibility need current-cycle review." },
  "national-curated-2026--institute-of-international-education--boren-awards": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "cycle-specific", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official Boren Awards page exists; award cycle, destination rules, and deadline require current-cycle verification." },
  "national-curated-2026--jack-kent-cooke-foundation--jack-kent-cooke-undergraduate-transfer-scholarship": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "cycle-specific", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official foundation page exists; current application window and transfer-specific eligibility need review." },
  "national-curated-2026--hispanic-scholarship-fund--hispanic-scholarship-fund-scholar-program": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "cycle-specific", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official HSF page exists; current award cycle, amount, and eligibility require review." },
  "national-curated-2026--uncf--uncf-scholarships": { status: "verified", deadlineType: "varies", verifiedCycle: "evergreen scholarship portal", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: true, notes: "Official UNCF scholarship portal is a live multi-scholarship source; deadlines and eligibility vary by listing." },
  "national-curated-2026--google--google-generation-google-scholarship": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "cycle-specific", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official Google scholarship page exists; regional status and deadline require current-cycle confirmation." },
  "national-curated-2026--aicpa--aicpa-legacy-scholarships": { status: "verified", deadlineType: "varies", verifiedCycle: "evergreen scholarship portal", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: true, notes: "Official AICPA scholarship landing page hosts multiple accounting scholarships; deadlines vary by award." },
  "national-curated-2026--microsoft--microsoft-explore-internship": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "role-posting dependent", applicationUrlVerified: false, deadlineVerified: false, eligibilityVerified: false, notes: "Student careers URL is official, but the specific Explore program page and active cycle require manual verification." },
  "national-curated-2026--google--google-step-internship": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "role-posting dependent", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official Google program page exists; active locations, year eligibility, and deadlines vary by region/cycle." },
  "national-curated-2026--meta--meta-university-engineering-internship": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "role-posting dependent", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official Meta careers program page exists, but active role availability is posting-dependent." },
  "national-curated-2026--jane-street--jane-street-insight-program": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "event-cycle dependent", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official Jane Street program page exists; event tracks, dates, and eligibility require cycle review." },
  "national-curated-2026--goldman-sachs--goldman-sachs-summer-analyst-program": { status: "verified", sourceUrl: "https://www.goldmansachs.com/careers/students/", deadlineType: "varies", verifiedCycle: "2026 internship program", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: true, notes: "Official Goldman Sachs students page documents the current internship program; specific Summer Analyst roles and deadlines vary by division and posting." },
  "national-curated-2026--mckinsey-company--mckinsey-sophomore-summer-business-analyst": { status: "needs_review", deadlineType: "varies", verifiedCycle: "office-dependent", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official student careers page exists; specific sophomore program availability varies by office and cycle." },
  "national-curated-2026--nvidia--nvidia-internships": { status: "verified", deadlineType: "varies", verifiedCycle: "role-posting dependent", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: true, notes: "Official NVIDIA university recruiting page is current; individual internship deadlines vary by role." },
  "national-curated-2026--palantir--palantir-path-internship": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "role-posting dependent", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official student careers page exists; Path availability and class-year restrictions need cycle review." },
  "national-curated-2026--mayo-clinic--mayo-clinic-summer-undergraduate-research-fellowship": { status: "needs_review", deadlineType: "unknown", verifiedCycle: "cycle-specific", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official Mayo page exists; current SURF deadline and eligibility need cycle-specific review." },
  "national-curated-2026--icpc-foundation--icpc-programming-contest": { status: "verified", deadlineType: "varies", verifiedCycle: "regional contest cycle", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: true, notes: "Official ICPC site supports the collegiate programming contest; registration dates vary by region." },
  "national-curated-2026--air-space-forces-association--cyberpatriot-national-youth-cyber-defense-competition": { status: "archived", deadlineType: "unknown", verifiedCycle: "not college-focused", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official source is legitimate, but this listing is not a strong undergraduate college opportunity and is excluded from recommendations." },
  "national-curated-2026--kaggle--kaggle-competitions": { status: "verified", deadlineType: "varies", verifiedCycle: "evergreen competition platform", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: true, notes: "Official Kaggle competitions page is an active competition portal; deadlines vary by competition." },
  "national-curated-2026--anitab-org--grace-hopper-celebration": { status: "temporarily_closed", deadlineType: "current_cycle_closed", verifiedCycle: "annual conference", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official conference page is recurring, but current registration/scholarship windows need review before it is treated as actionable." },
  "national-curated-2026--national-society-of-black-engineers--national-society-of-black-engineers-convention": { status: "temporarily_closed", deadlineType: "current_cycle_closed", verifiedCycle: "annual convention", applicationUrlVerified: true, deadlineVerified: false, eligibilityVerified: false, notes: "Official convention page is recurring, but current registration and deadlines require annual review." },
  "national-curated-2026--openai--openai-chatgpt-for-students": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen tool", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official ChatGPT entry point is valid for tool access; pricing and student-specific promotions may vary." },
  "national-curated-2026--perplexity--perplexity-ai": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen tool", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Perplexity product page is valid for tool access; plan terms may vary." },
  "national-curated-2026--elicit--elicit-research-assistant": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen tool", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Elicit product page is valid for research tool access; plan terms may vary." },
  "national-curated-2026--wolfram--wolfram-alpha": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen tool", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Wolfram Alpha product page is valid for computational tool access." },
  "national-curated-2026--canva--canva-for-education": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen education access", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Canva Education page documents education access; eligibility verification applies." },
  "national-curated-2026--github--github-copilot-for-students": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen student benefit", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official GitHub Education Pack page documents student developer benefits; current included offers may change." },
  "national-curated-2026--google--google-career-certificates": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen training", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Google Certificates page is valid; pricing and platform availability vary." },
  "national-curated-2026--amazon-web-services--aws-educate": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen training", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official AWS Educate page is valid for student cloud learning access." },
  "national-curated-2026--microsoft--microsoft-learn-certifications": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen training", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Microsoft Learn credentials page is valid; exam requirements vary by credential." },
  "national-curated-2026--cisco--cisco-networking-academy": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen training", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Cisco Networking Academy page is valid; course access varies by region and program." },
  "national-curated-2026--databricks--databricks-academy": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen training", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Databricks training page is valid; course and certification terms vary." },
  "national-curated-2026--nvidia--nvidia-deep-learning-institute": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen training", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official NVIDIA training page is valid; course pricing and certificates vary." },
  "national-curated-2026--adobe--adobe-creative-cloud-student-plan": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen student discount", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Adobe student pricing page is valid; current price and verification terms may change." },
  "national-curated-2026--jetbrains--jetbrains-student-license": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen student license", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official JetBrains education page documents student licenses and verification." },
  "national-curated-2026--amazon--amazon-prime-student": { status: "verified", deadlineType: "no_deadline", verifiedCycle: "evergreen student discount", applicationUrlVerified: true, deadlineVerified: true, eligibilityVerified: true, notes: "Official Amazon Prime Student page is valid; pricing and bundle terms may change." },
};

const statusCounts = {};
const nationalRecords = [];
for (const item of opportunities) {
  item.metadata = item.metadata ?? {};
  if (!item.metadata.deadlineType || item.metadata.deadlineType === "ongoing") {
    item.metadata.deadlineType = item.application_deadline ? "fixed" : ["AI", "Benefit"].includes(item.type) ? "no_deadline" : "not_announced";
  }
  const state = finalStates[item.id];
  if (!state) continue;
  item.verification_status = state.status;
  if (state.sourceUrl) {
    item.official_source = state.sourceUrl;
    item.official_source_url = state.sourceUrl;
  }
  item.last_verified = today;
  item.application_deadline = state.deadlineType === "fixed" ? item.application_deadline : null;
  item.deadline = item.application_deadline;
  item.metadata = {
    ...item.metadata,
    deadlineType: state.deadlineType,
    verification: {
      status: state.status,
      lastVerifiedAt: today,
      verifiedCycle: state.verifiedCycle,
      officialSourceUrl: item.official_source_url,
      applicationUrlVerified: state.applicationUrlVerified,
      deadlineVerified: state.deadlineVerified,
      eligibilityVerified: state.eligibilityVerified,
      notes: state.notes,
    },
  };
  item.reviewer_notes = state.notes;
  statusCounts[state.status] = (statusCounts[state.status] ?? 0) + 1;
  nationalRecords.push(item);
}

const missing = opportunities.filter((item) => item.id.startsWith(prefix) && !finalStates[item.id]);
if (missing.length) {
  console.error(`Missing final verification state for ${missing.length} national records:\n${missing.map((item) => item.id).join("\n")}`);
  process.exit(1);
}

fs.writeFileSync(dbPath, `${JSON.stringify(opportunities, null, 2)}\n`);

const totalCounts = opportunities.reduce((acc, item) => {
  acc[item.verification_status] = (acc[item.verification_status] ?? 0) + 1;
  return acc;
}, {});
const uncertainDeadlines = nationalRecords.filter((item) => ["unknown", "varies", "current_cycle_closed"].includes(item.metadata.deadlineType));
const suppressed = nationalRecords.filter((item) => ["needs_review", "temporarily_closed", "expired", "archived", "broken_source"].includes(item.verification_status));
const report = `# Opportunity Verification and Performance Report

Generated: ${today}

## Verification Summary

- Total opportunities: ${opportunities.length}
- Verified: ${totalCounts.verified ?? 0}
- Needs review: ${totalCounts.needs_review ?? 0}
- Temporarily closed: ${totalCounts.temporarily_closed ?? 0}
- Expired: ${totalCounts.expired ?? 0}
- Broken source: ${totalCounts.broken_source ?? 0}
- Archived: ${totalCounts.archived ?? 0}
- Recently added national records audited: ${nationalRecords.length}

## Final State of the 41 National Records

${nationalRecords.map((item) => `- ${item.title} — ${item.verification_status.replaceAll("_", " ")} — ${item.metadata.deadlineType}; ${item.metadata.verification.notes}`).join("\n")}

## Deadline Integrity

- Exact deadlines are only used when the official cycle is documented in the record.
- Unknown deadlines remain \`unknown\`, not \`varies\`.
- Role-dependent deadlines use \`varies\`.
- Evergreen tools, benefits, and certification pages use \`no_deadline\`.
- Recurring events without a currently actionable cycle use \`current_cycle_closed\`.

## Suppressed From Recommendation Priority

${suppressed.map((item) => `- ${item.title} — ${item.verification_status.replaceAll("_", " ")}`).join("\n") || "- None"}

## Records With Uncertain Deadlines

${uncertainDeadlines.map((item) => `- ${item.title} — ${item.metadata.deadlineType}`).join("\n") || "- None"}

## Static Generation Strategy

- \`/schools/[slug]\`: pre-render only 12 high-traffic seed schools; all other school hubs render on demand with 24-hour ISR.
- \`/benefits/[slug]\`: pre-render the first 24 national benefits; long-tail benefit detail pages render on demand with 24-hour ISR.
- \`/opportunities/[id]\`: remains dynamic because opportunity details participate in authenticated activity tracking and advisor explanations.

## Build Timeout Finding

The previous build retried during static generation because it attempted to generate 339 school pages and 717 benefit pages. Those route families repeatedly read and filtered large opportunity/benefit collections per page. The new rendering strategy removes the long-tail static sweep while preserving the pages through dynamic params and ISR.

## Future Manual Review

- Cycle-based scholarships, internships, conferences, and company programs need review before each recruiting season.
- Link reachability should be checked with \`npm run check:national-links -- --live\` during controlled data-maintenance workflows, not during production rendering or normal builds.
- Records marked \`needs_review\` are legitimate official-source leads but should not dominate paid recommendation surfaces.
`;

fs.writeFileSync(reportPath, report);
console.log(report);
