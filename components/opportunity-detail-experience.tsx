import Link from "next/link";
import type { ReactNode } from "react";
import {
  opportunityChangeLabel,
  opportunityChangeSummary,
} from "@/data/opportunity-changelog";
import type { OpportunityFieldTrust } from "@/data/opportunity-trust";
import type { OpportunityDetailProjection } from "@/lib/opportunity-detail-projection";
import { ArrowIcon } from "./icons";
import { LifecycleBadge } from "./status-badge";
import { OpportunityDecisionActions } from "./opportunity-decision-actions";
import { OrganizationLogo } from "./organization-logo";
import { ReportOutdatedButton } from "./report-outdated-button";

export function OpportunityDetailExperience({
  model,
}: {
  model: OpportunityDetailProjection;
}) {
  const { opportunity, lifecycle, trust } = model;
  const lifecyclePresentation = {
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
  return (
    <>
      <header
        data-opportunity-detail=""
        data-visual-hero="opportunity"
        data-opportunity-kind={model.kind}
        className="border-b border-ink/10 bg-white px-5 py-9 sm:px-8 sm:py-14"
      >
        <div className="mx-auto max-w-6xl">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink/45"
          >
            <Link href="/opportunities" className="text-forest hover:text-ink">
              Discover
            </Link>
            <span aria-hidden="true">/</span>
            <span>{opportunity.category}</span>
          </nav>
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rule-label text-forest">
                  {opportunity.type}
                </span>
                <span className="rule-label text-ink/40">
                  {opportunity.category}
                </span>
                <LifecycleBadge
                  state={lifecyclePresentation.displayState}
                  confidence={lifecyclePresentation.confidence}
                  label={lifecyclePresentation.label}
                />
              </div>
              <div className="mt-6 flex items-center gap-4">
                <OrganizationLogo opportunity={opportunity} size="lg" />
                <p className="text-sm font-bold text-ink/55">
                  {opportunity.organization}
                </p>
              </div>
              <h1 className="mt-5 max-w-4xl font-editorial text-4xl font-bold leading-[1.06] sm:text-6xl">
                {opportunity.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-ink/65 sm:text-lg sm:leading-8">
                {model.summary}
              </p>
            </div>
            <aside
              aria-label="Opportunity decision"
              data-visual-focus-surface=""
              className="rounded-lg border border-ink/10 bg-paper p-5 shadow-soft lg:sticky lg:top-24"
            >
              <p className="rule-label text-forest">Your next action</p>
              {model.account.status ? (
                <p className="mt-2 text-sm leading-6 text-ink/60">
                  This opportunity is in Journey as{" "}
                  <strong className="text-ink/75">
                    {model.account.status}
                  </strong>
                  .
                </p>
              ) : (
                <p className="mt-2 text-sm leading-6 text-ink/60">
                  Review the facts, then add it to Journey if you plan to pursue
                  it.
                </p>
              )}
              <div className="mt-5">
                <OpportunityDecisionActions
                  opportunityId={opportunity.id}
                  action={model.account.action}
                  initialAdded={model.account.inJourney}
                  initialWatched={model.account.watched}
                  pro={model.account.pro}
                  officialSource={opportunity.official_source}
                  officialLabel={model.officialActionLabel}
                  officialActionAllowed={lifecycle.actionAllowed}
                />
              </div>
            </aside>
          </div>
        <section
            aria-labelledby="opportunity-at-a-glance"
            className="mt-11 border-y border-ink/10 py-6"
          >
            <h2 id="opportunity-at-a-glance" className="sr-only">
              At a glance
            </h2>
            <dl
              className={`grid gap-x-8 gap-y-6 sm:grid-cols-2 ${model.facts.length > 4 ? "lg:grid-cols-5" : model.facts.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
            >
              {model.facts.map((fact) => (
                <Fact
                  key={fact.label}
                  label={fact.label}
                  value={fact.value}
                  trust={fact.label === "Deadline" ? trust.deadline : undefined}
                />
              ))}
          </dl>
        </section>
        {model.context.forYou ? (
          <div
            className="mt-6 max-w-3xl border-l-2 border-gold/70 pl-4"
            data-for-you-context=""
          >
            <p className="rule-label text-forest">
              In For You · {model.context.forYou.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              {model.context.forYou.reasons[0]}
            </p>
          </div>
        ) : null}
        {model.context.strategy?.line ? (
          <div className="mt-6 max-w-3xl border-l-2 border-forest/35 pl-4" data-strategy-context="">
            <p className="rule-label text-forest">What this adds</p>
            <p className="mt-2 text-sm leading-6 text-ink/60">{model.context.strategy.line}</p>
            {model.context.strategy.details.length > 1 ? <details className="mt-2 group"><summary className="min-h-11 cursor-pointer list-none py-3 text-xs font-bold text-forest marker:content-none">Your current mix</summary><ul className="space-y-2 pb-2 text-xs leading-5 text-ink/55">{model.context.strategy.details.slice(1).map((detail) => <li key={detail}>{detail}</li>)}</ul></details> : null}
          </div>
        ) : null}
        </div>
      </header>

      <main data-visual-reading-surface="" className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl space-y-14">
          <EligibilitySection model={model} />
          <ApplicationSection model={model} />
          <ContextSection model={model} />
          <UpdatesSection model={model} />
          <RelatedSection model={model} />
          <SourceSection model={model} />
        </div>
      </main>
    </>
  );
}

function EligibilitySection({ model }: { model: OpportunityDetailProjection }) {
  const personal = model.eligibility.personal;
  return (
    <section
      aria-labelledby="eligibility-title"
      data-eligibility-state={personal?.state ?? "not_personalized"}
    >
      <SectionHeading
        id="eligibility-title"
        eyebrow="Eligibility"
        title="Who qualifies"
        description={model.opportunity.eligibility}
      />
      {personal ? (
        <div
          className={`mt-7 rounded-lg border p-5 ${personal.state === "meets_recorded" ? "border-forest/20 bg-forest/[.04]" : personal.state === "does_not_meet" ? "border-red-800/20 bg-red-50/60" : "border-gold/30 bg-gold/[.06]"}`}
        >
          <p className="text-sm font-bold text-ink/80">{personal.label}</p>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            {personal.explanation}
          </p>
          <details
            className="group mt-4 border-t border-ink/10 pt-4"
            data-learn-more="eligibility-comparison"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-forest marker:content-none">
              <span>See your comparison</span>
              <span
                aria-hidden="true"
                className="transition-transform group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <p className="mt-2 text-xs leading-5 text-ink/45">
              {personal.recordedProfileNote}
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {personal.checks.map((check) => (
                <li
                  key={check.key}
                  className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 text-sm leading-6 text-ink/65"
                >
                  <span aria-hidden="true" className="font-bold text-forest">
                    {check.state === "met"
                      ? "✓"
                      : check.state === "not_met"
                        ? "×"
                        : "?"}
                  </span>
                  <span>
                    <strong className="text-ink/70">{check.label}:</strong>{" "}
                    {check.reason}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
      {model.eligibility.criteria.length ? (
        <ul className="mt-7 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {model.eligibility.criteria.map((criterion) => (
            <li
              key={`${criterion.label}-${criterion.value}`}
              className="border-t border-ink/10 pt-3"
            >
              <span className="text-xs font-bold text-ink/40">
                {criterion.label}
              </span>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                {criterion.value}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <TrustCue trust={model.trust.eligibility} />
    </section>
  );
}

function ApplicationSection({ model }: { model: OpportunityDetailProjection }) {
  const workspace = model.application.workspace;
  return (
    <section
      aria-labelledby="application-title"
      className="border-t border-ink/15 pt-10"
    >
      <SectionHeading
        id="application-title"
        eyebrow={model.kind === "benefit" ? "Access" : "Application"}
        title={model.application.sectionTitle}
        description={
          model.application.requirements.length
            ? "These requirements are supported by the provider source."
            : "The provider has not supplied a complete verified checklist. Review the official source before preparing materials."
        }
      />
      {workspace ? (
        <div
          className="mt-7 grid gap-5 border-y border-ink/10 py-6 sm:grid-cols-3"
          data-application-context=""
        >
          <Fact
            label="Journey status"
            value={model.account.status ?? "Saved"}
          />
          <Fact
            label="Application work"
            value={
              workspace.totalCount
                ? `${workspace.completedCount} of ${workspace.totalCount} tasks complete`
                : "No verified task list"
            }
          />
          <Fact label="Materials" value={workspace.materials.summary} />
        </div>
      ) : null}
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className="font-editorial text-2xl font-bold">
            What the provider asks for
          </h3>
          {model.application.requirements.length ? (
            <ul className="mt-5 space-y-3">
              {model.application.requirements.map((requirement) => (
                <li
                  key={requirement}
                  className="flex gap-3 text-sm leading-6 text-ink/65"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest"
                  />
                  {requirement}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-ink/55">
              No complete verified materials list is available. UnlockED will
              not turn an uncertain source into a checklist.
            </p>
          )}
        </div>
        <div>
          <h3 className="font-editorial text-2xl font-bold">How to proceed</h3>
          <ol className="mt-5 space-y-4">
            {model.application.steps.map((step, index) => (
              <li
                key={`${index}-${step}`}
                className="grid grid-cols-[2rem_1fr] gap-3"
              >
                <span className="font-mono text-xs font-bold text-forest">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-6 text-ink/65">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {model.application.eligible ? (
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-ink/10 pt-5 text-sm">
          <Link
            href={
              model.account.inJourney
                ? `/applications/${encodeURIComponent(model.opportunity.id)}`
                : "/materials"
            }
            className="font-bold text-forest hover:text-ink"
          >
            {model.account.inJourney
              ? "Open application workspace"
              : "Review application materials"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/resume-lab"
            className="font-bold text-forest hover:text-ink"
          >
            {model.application.targetedResume
              ? `Open ${model.application.targetedResume.title}`
              : model.application.resumeCount
                ? "Review your resumes"
                : "Start your resume"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
          {!model.account.inJourney ? (
            <p className="w-full text-xs leading-5 text-ink/45">
              Materials and resume context are shown without creating an
              application. Add to Journey when you decide to pursue it.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ContextSection({ model }: { model: OpportunityDetailProjection }) {
  const hasContext =
    model.context.forYou ||
    model.context.paths.length ||
    model.context.collections.length ||
    model.advisorExplanation;
  if (!hasContext) return null;
  return (
    <section
      aria-labelledby="context-title"
      className="border-t border-ink/15 pt-10"
    >
      <SectionHeading
        id="context-title"
        eyebrow="UnlockED context"
        title="How this connects"
        description="This context comes from existing recommendations, Paths, and curated collections. It does not change the opportunity itself."
      />
      <div className="mt-7 grid gap-8 md:grid-cols-2">
        {model.context.paths.length ? (
          <ContextList title="Opportunity Paths">
            {model.context.paths.map((path) => (
              <Link
                key={path.id}
                href={path.href}
                className="block border-t border-ink/10 py-3 text-sm font-bold text-ink/70 hover:text-forest"
              >
                {path.name}
                <span className="block text-xs font-normal text-ink/45">
                  {path.stage}
                </span>
              </Link>
            ))}
          </ContextList>
        ) : null}
        {model.context.collections.length ? (
          <ContextList title="Curated collections">
            {model.context.collections.map((collection) => (
              <Link
                key={collection.id}
                href={collection.href}
                className="block border-t border-ink/10 py-3 text-sm font-bold text-ink/70 hover:text-forest"
              >
                {collection.title}
              </Link>
            ))}
          </ContextList>
        ) : null}
      </div>
      {model.advisorExplanation ? (
        <details
          className="group mt-8 border-y border-ink/10 py-4"
          data-learn-more="advisor-explanation"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold text-forest marker:content-none">
            <span>Why UnlockED connected this opportunity to you</span>
            <span
              aria-hidden="true"
              className="transition-transform group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <AdvisorFact
              label="Why it fits"
              value={model.advisorExplanation.whyRecommended.join(" ")}
            />
            <AdvisorFact
              label="Evidence used"
              value={model.advisorExplanation.evidenceUsed.join(" ")}
            />
            <AdvisorFact
              label="What it could build"
              value={model.advisorExplanation.skillsGained.join(", ")}
            />
            <AdvisorFact
              label="Tradeoffs"
              value={model.advisorExplanation.tradeoffs.join(" ")}
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}

function UpdatesSection({ model }: { model: OpportunityDetailProjection }) {
  if (!model.changes.length) return null;
  return (
    <section
      aria-labelledby="what-changed"
      className="border-t border-ink/15 pt-10"
    >
      <SectionHeading
        eyebrow="Verified changes"
        title="What changed"
        description="Only meaningful changes supported by trusted source evidence appear here."
      />
      <ol className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
        {model.changes.map((change) => (
          <li
            key={change.id}
            className="grid gap-2 py-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6"
          >
            <time
              dateTime={change.detectedAt}
              className="text-xs font-bold text-ink/40"
            >
              {formatTimestamp(change.detectedAt)}
            </time>
            <div>
              <h3 className="text-sm font-bold text-ink/75">
                {opportunityChangeLabel(change)}
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink/55">
                {opportunityChangeSummary(change)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RelatedSection({ model }: { model: OpportunityDetailProjection }) {
  if (!model.related.length) return null;
  return (
    <section
      aria-labelledby="related-opportunities"
      className="border-t border-ink/15 pt-10"
    >
      <SectionHeading
        eyebrow="Keep exploring"
        title="Related opportunities"
        description="Related by structured category, subject, and career-path signals. Archived, expired, and unsafe records are excluded."
      />
      <div className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
        {model.related.map((candidate) => (
          <Link
            key={candidate.id}
            href={`/opportunities/${candidate.id}`}
            className="group grid min-h-20 gap-3 py-4 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
          >
            <OrganizationLogo opportunity={candidate} size="sm" />
            <span className="min-w-0">
              <span className="block font-editorial text-lg font-bold group-hover:text-forest">
                {candidate.title}
              </span>
              <span className="mt-1 block text-xs text-ink/45">
                {candidate.organization} ·{" "}
                {candidate.type === "Career"
                  ? candidate.category
                  : candidate.type}
              </span>
            </span>
            <span className="text-xs font-bold text-forest">
              View <ArrowIcon />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SourceSection({ model }: { model: OpportunityDetailProjection }) {
  const { trust, lifecycle, opportunity } = model;
  const verifiedFields = [
    trust.deadline.state === "verified" ? "Deadline" : "",
    trust.eligibility.state === "verified" ? "Eligibility" : "",
    trust.requirements.state === "verified" ? "Requirements" : "",
  ].filter(Boolean);
  return (
    <section
      aria-labelledby="checked-against-the-provider"
      className="border-t border-ink/15 pt-10"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end">
        <div>
          <SectionHeading
            eyebrow="Source and verification"
            title="Checked against the provider"
            description="UnlockED separates confirmed fields from details that still need review."
          />
          <dl className="mt-6 grid gap-5 sm:grid-cols-3">
            <Fact label="Source" value={trust.source.label} />
            <Fact
              label="Last checked"
              value={
                trust.source.checkedAt
                  ? formatDate(trust.source.checkedAt.slice(0, 10))
                  : "Not confirmed"
              }
            />
            <Fact label="Current status" value={lifecycle.label} />
          </dl>
          {verifiedFields.length ? (
            <p className="mt-5 text-xs leading-5 text-ink/50">
              <strong className="text-ink/65">Verified fields:</strong>{" "}
              {verifiedFields.join(", ")}.
            </p>
          ) : (
            <p className="mt-5 text-xs leading-5 text-ink/50">
              No key decision field is currently marked verified. Use the
              provider source as the authority.
            </p>
          )}
        </div>
        <div>
          {trust.source.sourceUrl ? (
            <a
              href={trust.source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest hover:text-ink"
            >
              {model.sourceIsOfficial
                ? "View official source"
                : "View provider source"}{" "}
              <ArrowIcon />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <p className="text-sm font-bold text-ink/55">
              Official source needs review
            </p>
          )}
          <ReportOutdatedButton opportunityId={opportunity.id} />
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="rule-label text-forest">{eyebrow}</p>
      <h2
        id={id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
        className="mt-2 font-editorial text-3xl font-bold"
      >
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-ink/55">{description}</p>
    </div>
  );
}

function Fact({
  label,
  value,
  trust,
}: {
  label: string;
  value: string;
  trust?: OpportunityFieldTrust;
}) {
  return (
    <div>
      <dt className="rule-label text-ink/40">{label}</dt>
      <dd className="mt-2 text-base font-bold leading-6 text-ink/75">
        {value}
      </dd>
      {trust ? (
        <p className="mt-1 text-xs leading-5 text-ink/45">
          {trust.label}
          {trust.state === "verified" && trust.checkedAt
            ? ` · ${formatDate(trust.checkedAt.slice(0, 10))}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

function TrustCue({ trust }: { trust: OpportunityFieldTrust }) {
  return (
    <p className="mt-5 max-w-3xl text-xs leading-5 text-ink/50">
      <strong className="font-bold text-ink/60">{trust.label}.</strong>{" "}
      {trust.detail}
      {trust.sourceUrl && trust.state !== "verified" ? (
        <>
          {" "}
          <a
            href={trust.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-forest hover:text-ink"
          >
            Check provider source <span aria-hidden="true">↗</span>
          </a>
        </>
      ) : null}
    </p>
  );
}

function ContextList({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="font-editorial text-xl font-bold">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}
function AdvisorFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-ink/40">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-ink/60">
        {value || "No additional detail available."}
      </dd>
    </div>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
