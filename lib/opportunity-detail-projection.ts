import "server-only";

import { createAdvisorProfile } from "@/data/advisor-engine";
import { normalizeAccomplishmentStore } from "@/data/accomplishments";
import {
  evaluateOpportunityEligibility,
  type EligibilityProof,
} from "@/data/opportunity-eligibility";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import { opportunityCollections } from "@/data/opportunity-collections";
import {
  opportunityPaths,
  type OpportunityPathDefinition,
} from "@/data/opportunity-paths";
import type { Opportunity } from "@/data/opportunities";
import { buildOpportunityStudentContext } from "@/data/recommendation-engine";
import { schools } from "@/data/seed";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import { recentOpportunityChanges } from "@/data/opportunity-changelog";
import { projectOpportunityTrust } from "@/data/opportunity-trust";
import type {
  OpportunityTrackerStatus,
  TrackedOpportunity,
} from "@/data/student-activity";
import type { OpportunityAdvisorExplanation } from "@/data/advisor-brain";
import type { AccountData } from "./account-types";
import { createApplicationMaterialProjectionContext } from "./application-materials";
import {
  applicationWorkspaceEligible,
  projectApplicationWorkspace,
} from "./application-workspace";
import { isProUser } from "./billing";
import { buildOpportunityCollectionIndex } from "./opportunity-collections";
import {
  applicationSectionTitle,
  conciseOpportunityDescription,
  opportunityApplicationSteps,
  opportunityDetailKind,
  opportunityEligibilityCriteria,
  opportunityOfficialActionLabel,
  primaryOpportunityFacts,
  type OpportunityDetailFact,
} from "./opportunity-detail";
import { opportunityMatchesPathStage } from "./opportunity-paths";
import { createOpportunityStrategyContext, projectOpportunityStrategyContribution, type OpportunityStrategyContribution } from "./personal-opportunity-strategy";

export type PersonalEligibilityState =
  "meets_recorded" | "does_not_meet" | "cannot_determine";

export type OpportunityPrimaryAction = {
  kind:
    | "add_to_journey"
    | "open_journey"
    | "continue_application"
    | "view_application"
    | "view_accomplishment";
  label: string;
  href?: string;
};

export type OpportunityDetailProjection = {
  opportunity: Opportunity;
  kind: ReturnType<typeof opportunityDetailKind>;
  summary: string;
  facts: OpportunityDetailFact[];
  lifecycle: ReturnType<typeof resolveOpportunityLifecycle>;
  trust: ReturnType<typeof projectOpportunityTrust>;
  officialActionLabel: string;
  sourceIsOfficial: boolean;
  eligibility: {
    criteria: OpportunityDetailFact[];
    personal: {
      state: PersonalEligibilityState;
      label: string;
      explanation: string;
      checks: Array<
        EligibilityProof & {
          label: string;
          state: "met" | "not_met" | "unknown";
        }
      >;
      recordedProfileNote: string;
    } | null;
  };
  application: {
    eligible: boolean;
    sectionTitle: string;
    steps: string[];
    requirements: string[];
    workspace: ReturnType<typeof projectApplicationWorkspace> | null;
    targetedResume: { id: string; title: string } | null;
    resumeCount: number;
  };
  account: {
    inJourney: boolean;
    watched: boolean;
    pro: boolean;
    status: OpportunityTrackerStatus | null;
    action: OpportunityPrimaryAction;
    accomplishment: { id: string; outcome: string; outcomeDate: string } | null;
  };
  context: {
    forYou: { label: string; reasons: string[] } | null;
    paths: Array<{ id: string; name: string; stage: string; href: string }>;
    collections: Array<{ id: string; title: string; href: string }>;
    strategy: OpportunityStrategyContribution | null;
  };
  advisorExplanation: OpportunityAdvisorExplanation | null;
  changes: ReturnType<typeof recentOpportunityChanges>;
  related: Opportunity[];
};

const eligibilityLabels: Record<EligibilityProof["key"], string> = {
  institution_type: "Institution type",
  enrollment_status: "Enrollment",
  school_restrictions: "School",
  host_institution: "Host institution",
  class_year: "Class year",
  degree_level: "Degree level",
  citizenship: "Citizenship",
  work_authorization: "Work authorization",
  gpa: "GPA",
  major_requirements: "Major",
  external_student_eligibility: "External students",
  age: "Age",
  residency: "Residency",
  transfer_status: "Transfer status",
  invitation_status: "Invitation",
  financial_need: "Financial need",
  merit_status: "Merit",
  demographic_eligibility: "Additional eligibility",
  critical_metadata: "Eligibility details",
  application_cycle: "Application cycle",
  availability: "Availability",
};

function accountTrackedRecord(
  account: AccountData,
  opportunityId: string,
): TrackedOpportunity | undefined {
  return (
    account.activity?.tracked?.[opportunityId] ?? account.tracker[opportunityId]
  );
}

function primaryAction(
  opportunityId: string,
  status: OpportunityTrackerStatus | null,
  accomplishmentId?: string,
): OpportunityPrimaryAction {
  if (accomplishmentId)
    return {
      kind: "view_accomplishment",
      label: "View accomplishment",
      href: `/profile?tab=accomplishments#accomplishment-${encodeURIComponent(accomplishmentId)}`,
    };
  if (!status) return { kind: "add_to_journey", label: "Add to Journey" };
  if (status === "Applying")
    return {
      kind: "continue_application",
      label: "Continue application",
      href: `/applications/${encodeURIComponent(opportunityId)}`,
    };
  if (["Submitted", "Interview", "Accepted"].includes(status))
    return {
      kind: "view_application",
      label: "View application",
      href: `/applications/${encodeURIComponent(opportunityId)}`,
    };
  return {
    kind: "open_journey",
    label: "View in Journey",
    href: `/#journey-record-${encodeURIComponent(opportunityId)}`,
  };
}

function personalizedEligibility(
  opportunity: Opportunity,
  account: AccountData,
) {
  const profile = account.profile;
  if (!profile) return null;
  const school = schools.find(
    (candidate) => candidate.slug === profile.schoolSlug,
  );
  if (!school) return null;
  const activity = account.activity ?? {
    viewed: [],
    saved: account.savedOpportunities.map((item) => item.opportunityId),
    claimed: [],
    tracked: account.tracker,
  };
  const context = buildOpportunityStudentContext(
    createAdvisorProfile({ profile, school, activity }),
  );
  const evaluation = evaluateOpportunityEligibility(opportunity, context);
  const meaningful = evaluation.checks.filter(
    (check) =>
      check.applicable &&
      !["application_cycle", "availability"].includes(check.key),
  );
  const definitiveFailure = meaningful.some(
    (check) =>
      !check.proven &&
      !/not known|not positively proven|unresolved|cannot be proven|not documented/i.test(
        check.reason,
      ),
  );
  const unknown = meaningful.some(
    (check) => !check.proven && !definitiveFailure,
  );
  const state: PersonalEligibilityState =
    evaluation.eligible && evaluation.confidence > 0
      ? "meets_recorded"
      : definitiveFailure
        ? "does_not_meet"
        : "cannot_determine";
  const label =
    state === "meets_recorded"
      ? "Your recorded profile meets the listed requirements"
      : state === "does_not_meet"
        ? "Your recorded profile does not meet a listed requirement"
        : "Eligibility cannot be confirmed from the available information";
  const explanation =
    state === "meets_recorded"
      ? "UnlockED found positive support for the applicable requirements using your saved profile. Confirm the current rules with the provider before applying."
      : state === "does_not_meet"
        ? (evaluation.failures[0] ??
          "A listed requirement conflicts with your saved profile.")
        : unknown || evaluation.canonical.criticalUnknowns.length
          ? "At least one required detail is missing from the opportunity record or your profile. Unknown information is never treated as eligible."
          : "The provider has not supplied enough structured information for a reliable comparison.";
  return {
    state,
    label,
    explanation,
    checks: meaningful.slice(0, 8).map((check) => ({
      ...check,
      label: eligibilityLabels[check.key],
      state: check.proven
        ? ("met" as const)
        : /not known|not positively proven|unresolved|cannot be proven|not documented/i.test(
              check.reason,
            )
          ? ("unknown" as const)
          : ("not_met" as const),
    })),
    recordedProfileNote:
      "Compared with your saved school, major, class year, degree, citizenship, GPA, and other eligibility details when available.",
  };
}

function opportunityContext(
  opportunity: Opportunity,
  account: AccountData,
  catalog?: readonly Opportunity[],
) {
  const paths = opportunityPaths.flatMap((path) => {
    const stages = path.stages as OpportunityPathDefinition["stages"];
    const stage = [...stages]
      .sort(
        (left, right) =>
          (right.mappingPriority ?? 0) - (left.mappingPriority ?? 0),
      )
      .find((candidate) => opportunityMatchesPathStage(opportunity, candidate));
    return stage
      ? [
          {
            id: path.id,
            name: path.name,
            stage: stage.name,
            href: `/paths/${path.id}`,
          },
        ]
      : [];
  });
  const collectionIndex = catalog
    ? buildOpportunityCollectionIndex(catalog)
    : null;
  const collections = collectionIndex
    ? opportunityCollections.flatMap((collection) => {
        const launched =
          collectionIndex.coverage.get(collection.id)?.readiness === "launched";
        const member = (collectionIndex.members.get(collection.id) ?? []).some(
          (item) => item.id === opportunity.id,
        );
        return launched && member
          ? [
              {
                id: collection.id,
                title: collection.title,
                href: `/collections/${collection.id}`,
              },
            ]
          : [];
      })
    : [];
  const snapshot = account.advisor?.forYouSnapshots?.at(-1);
  const recommendation = snapshot?.recommendations.find(
    (item) =>
      item.opportunity?.id === opportunity.id ||
      item.recommendation.relatedOpportunityId === opportunity.id,
  );
  return {
    paths: paths.slice(0, 3),
    collections: collections.slice(0, 3),
    forYou: recommendation
      ? {
          label: recommendation.label,
          reasons: recommendation.reasons.slice(0, 3),
        }
      : null,
  };
}

export function buildOpportunityDetailProjection(input: {
  opportunity: Opportunity;
  account: AccountData;
  catalog?: readonly Opportunity[];
  related: Opportunity[];
  advisorExplanation?: OpportunityAdvisorExplanation | null;
  now?: Date;
}): OpportunityDetailProjection {
  const { opportunity, account } = input;
  const now = input.now ?? new Date();
  const lifecycle = resolveOpportunityLifecycle(opportunity, now);
  const trust = projectOpportunityTrust(opportunity, now);
  const schoolNames = opportunity.schools.map(
    (slug) => schools.find((school) => school.slug === slug)?.name ?? slug,
  );
  const tracked = accountTrackedRecord(account, opportunity.id);
  const accomplishment = Object.values(
    normalizeAccomplishmentStore(account.accomplishments),
  ).find(
    (record) =>
      !record.hidden &&
      (record.canonicalOpportunityId === opportunity.id ||
        record.journeyOpportunityId === opportunity.id),
  );
  const materialContext = createApplicationMaterialProjectionContext(
    account.applicationMaterials,
  );
  const workspace =
    tracked && applicationWorkspaceEligible(opportunity)
      ? projectApplicationWorkspace({
          opportunity,
          record: tracked,
          workspace: account.applicationWorkspaces?.[opportunity.id],
          materials: account.applicationMaterials,
          materialContext,
          now,
        })
      : null;
  const resumes = Object.values(
    normalizeResumeLabStore(account.resumeLab).resumes,
  ).filter((resume) => !resume.archivedAt);
  const targetedResume =
    resumes.find(
      (resume) =>
        resume.target.type === "opportunity" &&
        resume.target.id === opportunity.id,
    ) ?? null;
  const watched = (account.watchedOpportunities ?? []).some(
    (record) => record.opportunityId === opportunity.id,
  );
  const sourceIsOfficial = trust.source.state === "official_source";
  return {
    opportunity,
    kind: opportunityDetailKind(opportunity),
    summary: conciseOpportunityDescription(opportunity),
    facts: primaryOpportunityFacts(opportunity),
    lifecycle,
    trust,
    officialActionLabel: sourceIsOfficial
      ? opportunityOfficialActionLabel(
          opportunity,
          lifecycle.actionable &&
            opportunity.metadata.verification?.applicationUrlVerified === true,
        )
      : "View provider source",
    sourceIsOfficial,
    eligibility: {
      criteria: opportunityEligibilityCriteria(opportunity, schoolNames),
      personal: personalizedEligibility(opportunity, account),
    },
    application: {
      eligible: applicationWorkspaceEligible(opportunity),
      sectionTitle: applicationSectionTitle(opportunity),
      steps: opportunityApplicationSteps(opportunity),
      requirements: trust.verifiedRequirements,
      workspace,
      targetedResume: targetedResume
        ? { id: targetedResume.id, title: targetedResume.title }
        : null,
      resumeCount: resumes.length,
    },
    account: {
      inJourney: Boolean(
        tracked ||
        account.savedOpportunities.some(
          (record) => record.opportunityId === opportunity.id,
        ),
      ),
      watched,
      pro: isProUser(account.billing),
      status: tracked?.status ?? null,
      action: primaryAction(
        opportunity.id,
        tracked?.status ?? null,
        accomplishment?.id,
      ),
      accomplishment: accomplishment
        ? {
            id: accomplishment.id,
            outcome: accomplishment.outcome,
            outcomeDate: accomplishment.outcomeDate,
          }
        : null,
    },
    context: {
      ...opportunityContext(opportunity, account, input.catalog),
      strategy: isProUser(account.billing) && input.catalog
        ? (() => {
            const projected = projectOpportunityStrategyContribution(
              createOpportunityStrategyContext({ account, opportunities: input.catalog, now }),
              opportunity,
            );
            return projected.details.length ? projected : null;
          })()
        : null,
    },
    advisorExplanation: input.advisorExplanation ?? null,
    changes: recentOpportunityChanges(opportunity, 4),
    related: input.related,
  };
}
