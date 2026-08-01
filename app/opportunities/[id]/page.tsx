import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { StudentActivity } from "@/data/student-activity";
import type { OpportunityAdvisorExplanation } from "@/data/advisor-brain";
import type { OpportunityLifecyclePresentation } from "@/data/opportunity-listing";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { explainOpportunityWithAdvisorBrain } from "@/data/advisor-brain";
import { inferApplicationsFromActivity, normalizeStudentProgress } from "@/data/student-progress";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import { type Opportunity } from "@/data/opportunities";
import { schools } from "@/data/seed";
import { maintenanceStatus } from "@/data/opportunity-maintenance";
import { ArrowIcon } from "@/components/icons";
import { OpportunityActivityActions, OpportunityViewTracker } from "@/components/opportunity-activity";
import { OrganizationLogo } from "@/components/organization-logo";
import { ReportOutdatedButton } from "@/components/report-outdated-button";
import { ConfidenceBadge, LifecycleBadge, StatusBadge } from "@/components/status-badge";
import { getManagedOpportunity, listPublishedOpportunities } from "@/lib/content-store";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { serializeJsonLd } from "@/lib/json-ld";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import {
  applicationSectionTitle,
  conciseOpportunityDescription,
  eligibilityScopeFacts,
  opportunityApplicationSteps,
  opportunityDetailKind,
  primaryOpportunityFacts,
  specificRequirements,
  type OpportunityDetailFact,
} from "@/lib/opportunity-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const item = await getManagedOpportunity((await params).id, { includeArchived: true });
  if (!item) return { title: "Opportunity not found" };
  const title = `${item.title} | Eligibility and Official Link`;
  const description = conciseOpportunityDescription(item);
  return { title, description, alternates: { canonical: `/opportunities/${item.id}` }, openGraph: { title, description, url: `/opportunities/${item.id}`, type: "article" } };
}

async function personalizedExplanation(item: Opportunity, catalog: readonly Opportunity[]): Promise<OpportunityAdvisorExplanation | null> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  const profile = session?.data.profile;
  if (!profile || !session.data.onboardingComplete) return null;
  const school = schools.find((candidate) => candidate.slug === profile.schoolSlug);
  if (!school) return null;
  const activity: StudentActivity = session.data.activity ?? {
    viewed: [],
    saved: session.data.savedOpportunities.map((record) => record.opportunityId),
    claimed: [],
    tracked: session.data.tracker,
  };
  const progress = inferApplicationsFromActivity(activity, catalog, normalizeStudentProgress({
    milestones: Object.fromEntries(Object.entries(session.data.journeyProgress ?? {}).map(([milestoneId, completed]) => [milestoneId, {
      milestoneId,
      status: completed ? "completed" : "not_started",
      source: "inferred",
      updatedAt: session.data.updatedAt,
    }])),
  }));
  return explainOpportunityWithAdvisorBrain({ advisorProfile: createAdvisorProfile({ profile, school, activity, progress }), opportunity: item, progress });
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireCompletedOnboarding();
  const item = await getManagedOpportunity((await params).id, { includeArchived: true });
  if (!item) notFound();
  const catalog = await listPublishedOpportunities();
  const lifecycle = resolveOpportunityLifecycle(item);
  const lifecyclePresentation: OpportunityLifecyclePresentation = {
    state: lifecycle.state,
    displayState: lifecycle.displayState,
    confidence: lifecycle.confidence,
    label: lifecycle.label,
    actionable: lifecycle.actionable,
    recommendationEligible: lifecycle.recommendationEligible,
    recurring: lifecycle.recurring,
    actionLabel: lifecycle.actionLabel,
    actionAllowed: lifecycle.actionAllowed,
  };
  const displayedStatus = maintenanceStatus(item);
  const schoolNames = item.schools.map((slug) => schools.find((school) => school.slug === slug)?.name ?? slug);
  const requirements = specificRequirements(item);
  const advisorExplanation = await personalizedExplanation(item, catalog);
  const detailKind = opportunityDetailKind(item);
  const summary = conciseOpportunityDescription(item);
  const facts = primaryOpportunityFacts(item);
  const scopeFacts = eligibilityScopeFacts(item, schoolNames);
  const steps = opportunityApplicationSteps(item);
  const eligibilityNotes = [...new Set(item.metadata.eligibilityNotes ?? [])].filter((note) => note !== item.eligibility);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: item.title,
    description: summary,
    dateModified: item.last_verified,
    author: { "@type": "Organization", name: "UnlockED" },
    publisher: { "@type": "Organization", name: "UnlockED" },
    mainEntityOfPage: `https://www.unlockededu.com/opportunities/${item.id}`,
  };

  return <>
    <OpportunityViewTracker opportunityId={item.id} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

    <header data-opportunity-detail="" data-opportunity-kind={detailKind} className="bg-white px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink/45">
          <Link href="/opportunities" className="text-forest hover:text-ink">Discover</Link><span aria-hidden="true">/</span><span>{item.category}</span>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rule-label text-forest">{item.type}</span>
              <span className="rule-label text-ink/40">{item.category}</span>
              <LifecycleBadge state={lifecycle.displayState} confidence={lifecycle.confidence} label={lifecycle.label} />
            </div>
            <div className="mt-6 flex items-center gap-4">
              <OrganizationLogo opportunity={item} size="lg" />
              <p className="text-sm font-bold text-ink/55">{item.organization}</p>
            </div>
            <h1 className="mt-5 max-w-4xl font-editorial text-4xl font-bold leading-[1.06] sm:text-6xl">{item.title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-ink/65">{summary}</p>
          </div>

          <aside aria-label="Official opportunity actions" className="rounded-lg border border-ink/10 bg-paper p-5 shadow-soft">
            <p className="rule-label text-forest">Official source</p>
            <OpportunityActivityActions opportunityId={item.id} type={item.type} officialSource={item.official_source} lifecycle={lifecyclePresentation} />
            <p className="mt-4 text-xs leading-5 text-ink/50">Applications, eligibility decisions, and final terms are handled by {item.organization}.</p>
            <div className="mt-5 border-t border-ink/10 pt-4">
              <p className="text-xs text-ink/45">Last reviewed {formatDate(item.last_verified)}</p>
              <ReportOutdatedButton opportunityId={item.id} />
            </div>
          </aside>
        </div>

        <section aria-labelledby="quick-facts" className="mt-12 border-y border-ink/10 py-6">
          <h2 id="quick-facts" className="sr-only">Key opportunity facts</h2>
          <dl className={`grid gap-x-8 gap-y-6 sm:grid-cols-2 ${facts.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {facts.map((fact) => <Fact key={fact.label} fact={fact} />)}
          </dl>
        </section>

        <section aria-labelledby="eligibility-summary" className="grid gap-5 border-b border-ink/10 py-7 md:grid-cols-[11rem_minmax(0,1fr)]">
          <div><p className="rule-label text-forest">Eligibility</p><h2 id="eligibility-summary" className="mt-2 font-editorial text-2xl font-bold">Who qualifies</h2></div>
          <div>
            <p className="max-w-3xl leading-7 text-ink/70">{item.eligibility}</p>
            {scopeFacts.length ? <dl className="mt-5 grid gap-4 sm:grid-cols-2">{scopeFacts.map((fact) => <Fact key={fact.label} fact={fact} compact />)}</dl> : null}
          </div>
        </section>
      </div>
    </header>

    <main className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <section aria-labelledby="application-process" className={`grid gap-10 ${requirements.length ? "lg:grid-cols-[minmax(0,.7fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_2fr]"}`}>
          <div>
            <p className="rule-label text-forest">Application</p>
            <h2 id="application-process" className="mt-2 font-editorial text-3xl font-bold">{applicationSectionTitle(item)}</h2>
            <p className="mt-4 text-sm leading-6 text-ink/55">Use the official provider page for the current application and final requirements.</p>
          </div>
          <div>
            {requirements.length ? <div className="mb-8 border-b border-ink/10 pb-8"><h3 className="text-sm font-bold">Requirements listed by the provider</h3><ul className="mt-4 space-y-3">{requirements.map((requirement) => <li key={requirement} className="flex gap-3 text-sm leading-6 text-ink/65"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />{requirement}</li>)}</ul></div> : null}
            <ol className="space-y-5">{steps.map((step, index) => <li key={`${index}-${step}`} className="grid grid-cols-[2rem_1fr] gap-4"><span className="font-mono text-xs font-bold text-forest">{String(index + 1).padStart(2, "0")}</span><p className="text-sm leading-6 text-ink/70">{step}</p></li>)}</ol>
            {lifecycle.actionAllowed ? <a href={item.official_source} target="_blank" rel="noreferrer" className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-bold text-white hover:bg-forest">Continue on official site <ArrowIcon /><span className="sr-only">(opens in a new tab)</span></a> : null}
          </div>
        </section>

        <details className="group mt-16 border-y border-ink/15" data-learn-more="">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 font-bold text-forest marker:content-none">
            <span><span className="block text-base">Learn More</span><span className="mt-1 block text-xs font-normal text-ink/45">Verification, detailed eligibility, timing, and personalized context</span></span>
            <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
          </summary>
          <div className="border-t border-ink/10 py-10">
            <div className="grid gap-12 lg:grid-cols-2">
              <LearnMoreSection title="Detailed eligibility">
                <DetailList facts={detailedEligibilityFacts(item, schoolNames)} />
                {eligibilityNotes.length ? <ul className="mt-5 space-y-2 text-sm leading-6 text-ink/60">{eligibilityNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
              </LearnMoreSection>
              <LearnMoreSection title="Timing and availability">
                <DetailList facts={lifecycleFacts(item, lifecycle)} />
              </LearnMoreSection>
            </div>

            {advisorExplanation ? <OpportunityAdvisorBrainSection explanation={advisorExplanation} /> : null}

            <section aria-labelledby="source-verification" className="mt-12 border-t border-ink/10 pt-8">
              <p className="rule-label text-forest">Source and verification</p>
              <h3 id="source-verification" className="mt-2 font-editorial text-2xl font-bold">What UnlockED checked</h3>
              <div className="mt-5 flex flex-wrap items-center gap-2"><StatusBadge status={displayedStatus} /><ConfidenceBadge status={displayedStatus} /></div>
              <p className="mt-5 max-w-3xl text-sm leading-6 text-ink/60">This listing was reviewed against an official provider or university source. Missing details remain unlisted rather than being inferred. UnlockED does not administer the opportunity or decide eligibility.</p>
              <a href={item.official_source} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-forest hover:text-ink">View the official source <ArrowIcon /><span className="sr-only">(opens in a new tab)</span></a>
            </section>
          </div>
        </details>
      </div>
    </main>
  </>;
}

function Fact({ fact, compact = false }: { fact: OpportunityDetailFact; compact?: boolean }) {
  return <div><dt className="rule-label text-ink/40">{fact.label}</dt><dd className={`${compact ? "mt-1 text-sm" : "mt-2 text-base"} font-bold leading-6 text-ink/75`}>{fact.value}</dd></div>;
}

function DetailList({ facts }: { facts: OpportunityDetailFact[] }) {
  return <dl className="divide-y divide-ink/10 border-y border-ink/10">{facts.map((fact) => <div key={fact.label} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><dt className="text-xs font-bold text-ink/45">{fact.label}</dt><dd className="text-sm leading-6 text-ink/65">{fact.value}</dd></div>)}</dl>;
}

function LearnMoreSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h3 className="font-editorial text-2xl font-bold">{title}</h3><div className="mt-5">{children}</div></section>;
}

function detailedEligibilityFacts(item: Opportunity, schoolNames: string[]): OpportunityDetailFact[] {
  const rules = item.metadata.eligibilityRules;
  const facts: OpportunityDetailFact[] = [
    ...(item.school_scope === "School Specific" && schoolNames.length > 3 ? [{ label: "Eligible schools", value: schoolNames.join(", ") }] : []),
    ...(!item.majors.includes("Any Major") && item.majors.length > 6 ? [{ label: "Eligible majors", value: item.majors.join(", ") }] : []),
    ...(rules?.educationLevels?.length ? [{ label: "Education level", value: rules.educationLevels.join(", ").replaceAll("_", " ") }] : []),
    ...(rules?.citizenship && rules.citizenship !== "unknown" ? [{ label: "Citizenship", value: rules.citizenship.replaceAll("_", " ") }] : []),
    ...(rules?.minimumGpa ? [{ label: "Minimum GPA", value: String(rules.minimumGpa) }] : []),
    ...(rules?.institutionTypes?.length ? [{ label: "Institution type", value: rules.institutionTypes.join(", ").replaceAll("_", " ") }] : []),
    ...(rules?.externalStudents ? [{ label: "External students", value: rules.externalStudents }] : []),
  ];
  if (!facts.length) facts.push({ label: "Scope", value: item.school_scope === "National" ? "National; confirm provider restrictions" : schoolNames.join(", ") || "School specific" });
  return facts;
}

function lifecycleFacts(item: Opportunity, lifecycle: ReturnType<typeof resolveOpportunityLifecycle>): OpportunityDetailFact[] {
  const facts: OpportunityDetailFact[] = [
    ...(lifecycle.openingDate?.normalizedValue ? [{ label: "Opens", value: formatLifecycleDate(lifecycle.openingDate.normalizedValue, lifecycle.openingDate.estimated) }] : []),
    ...(lifecycle.priorityDeadline?.normalizedValue ? [{ label: "Priority deadline", value: formatLifecycleDate(lifecycle.priorityDeadline.normalizedValue, lifecycle.priorityDeadline.estimated) }] : []),
    ...(lifecycle.decisionDate?.normalizedValue ? [{ label: "Decision timing", value: formatLifecycleDate(lifecycle.decisionDate.normalizedValue, lifecycle.decisionDate.estimated) }] : []),
    ...(item.metadata.renewalNotes ? [{ label: "Renewal", value: item.metadata.renewalNotes }] : []),
    ...(item.recurring ? [{ label: "Recurrence", value: "This opportunity recurs. Confirm the current cycle on the official source." }] : []),
  ];
  if (!facts.length) facts.push({ label: "Additional dates", value: "No additional cycle dates are listed." });
  return facts;
}

function OpportunityAdvisorBrainSection({ explanation }: { explanation: OpportunityAdvisorExplanation }) {
  return <section aria-labelledby="advisor-fit" className="mt-12 border-t border-ink/10 pt-8">
    <p className="rule-label text-forest">Personalized context</p>
    <h3 id="advisor-fit" className="mt-2 font-editorial text-2xl font-bold">Why this is recommended for you</h3>
    <ul className="mt-5 max-w-3xl space-y-2 text-sm leading-6 text-ink/65">{explanation.whyRecommended.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    <details className="mt-6 max-w-4xl border-y border-ink/10 py-4">
      <summary className="cursor-pointer text-sm font-bold text-forest">How this fit was calculated</summary>
      <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <AdvisorFact label="Skills gained" value={explanation.skillsGained.join(", ")} />
        <AdvisorFact label="Competencies strengthened" value={explanation.competenciesStrengthened.join(", ")} />
        <AdvisorFact label="Evidence generated" value={explanation.evidenceGenerated.join(" ")} />
        <AdvisorFact label="Resume impact" value={explanation.resumeImpact} />
        <AdvisorFact label="Interview value" value={explanation.interviewValue} />
        <AdvisorFact label="Estimated ROI" value={explanation.estimatedRoi} />
        <AdvisorFact label="Confidence" value={`${explanation.confidence}%`} />
        <AdvisorFact label="Estimated time" value={explanation.estimatedCompletionTime} />
        <AdvisorFact label="Evidence used" value={explanation.evidenceUsed.join(" ")} />
        <AdvisorFact label="Expected impact" value={explanation.expectedImpact} />
        <AdvisorFact label="Tradeoffs" value={explanation.tradeoffs.join(" ")} />
      </dl>
    </details>
  </section>;
}

function AdvisorFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold text-ink/45">{label}</dt><dd className="mt-1 text-sm leading-6 text-ink/65">{value}</dd></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatLifecycleDate(value: string, estimated: boolean) {
  return `${estimated ? "Estimated " : ""}${formatDate(value.slice(0, 10))}`;
}
