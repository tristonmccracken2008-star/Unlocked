import type { Opportunity } from "@/data/opportunities";
import type { StudentProfile } from "@/data/student-profile";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "@/data/student-activity";
import type { JourneyProgressTransition } from "@/data/student-activity";

export type JourneyElementDecision =
  | "essential_now"
  | "supporting"
  | "progressive_disclosure"
  | "application_management"
  | "duplicate"
  | "remove";

export type JourneyElementAuditRecord = {
  id: string;
  decision: JourneyElementDecision;
  userQuestion: string;
  permanentSpace: boolean;
  confusionRisk: string;
  renderCost: "none" | "low" | "medium" | "high";
};

export const journeyElementAudit: readonly JourneyElementAuditRecord[] = [
  { id: "identity-statement", decision: "essential_now", userQuestion: "Who am I becoming?", permanentSpace: true, confusionRisk: "None when sourced from the current profile and progress.", renderCost: "none" },
  { id: "identity-context", decision: "supporting", userQuestion: "What context is this based on?", permanentSpace: true, confusionRisk: "Low when limited to major, year, and school.", renderCost: "none" },
  { id: "responsive-line-variants", decision: "duplicate", userQuestion: "How has my path moved?", permanentSpace: false, confusionRisk: "Six mounted SVG renderers made one visual feel like infrastructure.", renderCost: "high" },
  { id: "current-waypoint", decision: "essential_now", userQuestion: "What should I do now?", permanentSpace: true, confusionRisk: "High if its action belongs to a different opportunity.", renderCost: "low" },
  { id: "waypoint-reason", decision: "supporting", userQuestion: "Why does this matter?", permanentSpace: true, confusionRisk: "Low when stated once.", renderCost: "none" },
  { id: "waypoint-evidence", decision: "progressive_disclosure", userQuestion: "How was this selected?", permanentSpace: false, confusionRisk: "Technical source language competes with the action.", renderCost: "low" },
  { id: "status-management", decision: "application_management", userQuestion: "How do I update an application?", permanentSpace: false, confusionRisk: "Operational controls dilute the emotional page.", renderCost: "low" },
  { id: "history-heading", decision: "supporting", userQuestion: "How has my effort changed my path?", permanentSpace: true, confusionRisk: "Low after shortening its explanation.", renderCost: "none" },
  { id: "meaningful-moments", decision: "essential_now", userQuestion: "What real progress have I made?", permanentSpace: true, confusionRisk: "High when profile interests or saved items appear as accomplishments.", renderCost: "medium" },
  { id: "moment-details", decision: "progressive_disclosure", userQuestion: "What changed because of this?", permanentSpace: false, confusionRisk: "Dense when every evidence field is visible.", renderCost: "medium" },
  { id: "earlier-history", decision: "progressive_disclosure", userQuestion: "What happened before these moments?", permanentSpace: false, confusionRisk: "Large hidden histories inflate the page without helping first comprehension.", renderCost: "high" },
  { id: "journey-tools", decision: "duplicate", userQuestion: "Where do I manage applications?", permanentSpace: false, confusionRisk: "Repeated an entry point already available from the waypoint.", renderCost: "low" },
  { id: "horizon-line-renderer", decision: "remove", userQuestion: "What may become possible?", permanentSpace: false, confusionRisk: "A second full Open Line looked like another product diagram.", renderCost: "high" },
  { id: "primary-horizon", decision: "supporting", userQuestion: "What may become possible afterward?", permanentSpace: true, confusionRisk: "Low when framed as a possibility, not a promise.", renderCost: "low" },
  { id: "additional-horizon", decision: "progressive_disclosure", userQuestion: "What other direction could I explore?", permanentSpace: false, confusionRisk: "Multiple full dossiers created competing next actions.", renderCost: "medium" },
  { id: "diagnostics", decision: "remove", userQuestion: "None for a student.", permanentSpace: false, confusionRisk: "Exposes implementation vocabulary.", renderCost: "low" },
] as const;

export type JourneyClarityStage = "empty" | "sparse" | "active" | "validated";

const meaningfulStatuses = new Set<OpportunityTrackerStatus>(["Interested", "Applying", "Submitted", "Interview", "Accepted", "Paused", "Rejected", "Completed"]);
const validatedStatuses = new Set<OpportunityTrackerStatus>(["Interview", "Accepted", "Completed"]);

export function journeyClarityStage(records: readonly TrackedOpportunity[]): JourneyClarityStage {
  if (records.length === 0) return "empty";
  if (records.some((record) => validatedStatuses.has(record.status))) return "validated";
  if (records.some((record) => meaningfulStatuses.has(record.status))) return "active";
  return "sparse";
}

function cleaned(value: string | undefined) {
  return value?.trim() || "";
}

export function canonicalJourneyStatement(profile: StudentProfile, stage: JourneyClarityStage) {
  if (stage === "empty") return "Every path begins with one meaningful choice.";
  const goal = cleaned(profile.careerGoal);
  const major = cleaned(profile.major);
  const direction = goal && !/^explor/i.test(goal) ? goal : major;
  if (stage === "sparse") return direction
    ? `You’re deciding where to begin in ${direction}.`
    : "Your direction is beginning to take shape.";
  if (stage === "validated") return direction
    ? `You’re turning your work toward ${direction} into real experience.`
    : "Your work is becoming experience you can build on.";
  return direction
    ? `You’re beginning to turn an interest in ${direction} into action.`
    : "You’re turning a direction into real action.";
}

export function opportunitySupportsApplicationProgress(opportunity: Opportunity) {
  if (["Career", "Research", "Scholarship"].includes(opportunity.type)) return true;
  const text = `${opportunity.category} ${opportunity.tags.join(" ")}`.toLowerCase();
  return /intern|fellow|research|scholar|grant|competition|job|co-op|leadership|study abroad/.test(text);
}

export function recordSupportsEditorialAction(record: TrackedOpportunity, opportunity: Opportunity) {
  if (record.status === "Saved") return true;
  return opportunitySupportsApplicationProgress(opportunity);
}

const transitionWaypointCopy: Record<JourneyProgressTransition, {
  title: (opportunity: string) => string;
  why: string;
  minutes: number;
  impact: "low" | "medium" | "high";
}> = {
  choose: { title: (opportunity) => `Choose ${opportunity} as a direction.`, why: "Choosing it makes this opportunity part of your active Journey.", minutes: 5, impact: "medium" },
  start: { title: (opportunity) => `Start your application for ${opportunity}.`, why: "A clear first work session turns this direction into active preparation.", minutes: 30, impact: "medium" },
  submit: { title: (opportunity) => `Finish and submit ${opportunity}.`, why: "You have already started. Submitting is the next confirmed step in this application.", minutes: 45, impact: "high" },
  interview: { title: (opportunity) => `Record your interview for ${opportunity}.`, why: "Recording an external response keeps your Journey accurate and changes what should come next.", minutes: 5, impact: "high" },
  accept: { title: (opportunity) => `Record your acceptance for ${opportunity}.`, why: "A confirmed acceptance changes this direction from possibility into experience you can begin.", minutes: 5, impact: "high" },
  complete: { title: (opportunity) => `Complete your experience with ${opportunity}.`, why: "Completed work can become evidence for future applications and interviews.", minutes: 10, impact: "high" },
  pause: { title: (opportunity) => `Pause ${opportunity}.`, why: "Pausing keeps the history without asking this direction to remain active.", minutes: 5, impact: "low" },
  resume: { title: (opportunity) => `Return to ${opportunity}.`, why: "Resuming restores the application to the stage where you left it.", minutes: 5, impact: "medium" },
  close: { title: (opportunity) => `Close ${opportunity}.`, why: "Closing one opportunity keeps your current Journey focused without treating the broader direction as a failure.", minutes: 5, impact: "low" },
};

export function canonicalTransitionWaypoint(transition: JourneyProgressTransition, opportunityTitle: string) {
  const copy = transitionWaypointCopy[transition];
  return { title: copy.title(opportunityTitle), whyItMatters: copy.why, estimatedMinutes: copy.minutes, impact: copy.impact };
}

export const journeyClarityLimits = {
  visibleHistoryMoments: 4,
  retainedEarlierMoments: 8,
  visibleHorizonItems: 1,
  retainedHorizonItems: 2,
} as const;

export const journeyEditorialAuditVersion = "journey-clarity-v1";
