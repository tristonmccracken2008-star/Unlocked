import type { Opportunity } from "./opportunities";
import type { JourneyProgressTransition, OpportunityTrackerStatus, TrackedOpportunity } from "./student-activity";

export type JourneyWorkflowKind = "career" | "scholarship" | "research" | "competition" | "resource";

export type JourneyProfessionalStage = {
  id: string;
  label: string;
  actionLabel: string;
  milestoneTitle: string;
  description: string;
  status: OpportunityTrackerStatus;
  transition: JourneyProgressTransition;
  major: boolean;
};

export type JourneyProfessionalWorkflow = {
  id: JourneyWorkflowKind;
  label: string;
  stages: JourneyProfessionalStage[];
};

export type JourneyProfessionalAction = {
  id: string;
  label: string;
  transition: JourneyProgressTransition;
  resultingStatus: OpportunityTrackerStatus;
  destructive?: boolean;
  correction?: boolean;
  stage?: JourneyProfessionalStage;
};

const stage = (
  id: string,
  label: string,
  actionLabel: string,
  milestoneTitle: string,
  description: string,
  status: OpportunityTrackerStatus,
  transition: JourneyProgressTransition,
  major = false,
): JourneyProfessionalStage => ({ id, label, actionLabel, milestoneTitle, description, status, transition, major });

const workflows: Record<JourneyWorkflowKind, JourneyProfessionalWorkflow> = {
  career: {
    id: "career",
    label: "Professional opportunity",
    stages: [
      stage("saved", "Saved", "Keep saved", "Saved to Journey", "This opportunity is part of your private Journey.", "Saved", "choose"),
      stage("preparing_application", "Preparing application", "Begin preparing", "Began preparing an application", "A possibility became active work.", "Applying", "start"),
      stage("application_submitted", "Application submitted", "Record submission", "Submitted an application", "You recorded a completed application submission.", "Submitted", "submit", true),
      stage("interview_received", "Interview received", "Record interview", "Received an interview", "The organization invited you to continue the process.", "Interview", "interview", true),
      stage("final_round_interview", "Final round interview", "Record final round", "Reached a final round interview", "Your application advanced to a final interview stage.", "Interview", "interview", true),
      stage("offer_received", "Offer received", "Record offer", "Received an offer", "The organization offered you the opportunity.", "Accepted", "accept", true),
      stage("accepted", "Offer accepted", "Record acceptance", "Accepted the offer", "You chose to accept this opportunity.", "Accepted", "accept", true),
      stage("participating", "Experience underway", "Mark experience underway", "Began the experience", "You reported that the experience is underway.", "Accepted", "accept"),
      stage("completed_program", "Experience completed", "Record completion", "Completed the experience", "This experience is now part of your professional record.", "Completed", "complete", true),
      stage("not_selected", "Not selected", "Record outcome: not selected", "Recorded the application outcome", "The application remains part of your Journey history.", "Rejected", "close"),
      stage("withdrawn", "Withdrawn", "Record withdrawal", "Withdrew the application", "You stopped pursuing this application. The broader direction remains open.", "Rejected", "close"),
      stage("declined_offer", "Offer declined", "Record declined offer", "Declined the offer", "You chose not to continue with this offer. The history remains available.", "Rejected", "close"),
      stage("archived", "Archived", "Archive opportunity", "Archived the opportunity", "The opportunity remains in your Journey history.", "Rejected", "close"),
    ],
  },
  scholarship: {
    id: "scholarship",
    label: "Scholarship",
    stages: [
      stage("saved", "Saved", "Keep saved", "Saved to Journey", "This scholarship is part of your private Journey.", "Saved", "choose"),
      stage("preparing_submission", "Preparing submission", "Begin preparing", "Began preparing a scholarship submission", "You started assembling the scholarship materials.", "Applying", "start"),
      stage("submitted", "Application submitted", "Record submission", "Submitted a scholarship application", "You recorded a completed scholarship submission.", "Submitted", "submit", true),
      stage("waitlisted", "Waitlisted", "Record waitlist", "Joined the scholarship waitlist", "You reported that the scholarship decision is still pending.", "Interview", "interview"),
      stage("finalist", "Finalist", "Record finalist status", "Became a scholarship finalist", "The scholarship organization advanced your application.", "Interview", "interview", true),
      stage("awarded", "Awarded", "Record award", "Received a scholarship award", "You reported that the scholarship was awarded.", "Accepted", "accept", true),
      stage("funds_received", "Funds received", "Record funds received", "Received scholarship funds", "You recorded that the scholarship funds were received.", "Completed", "complete", true),
      stage("not_selected", "Not selected", "Record outcome: not selected", "Recorded the scholarship outcome", "The application remains part of your Journey history.", "Rejected", "close"),
      stage("withdrawn", "Withdrawn", "Record withdrawal", "Withdrew the scholarship application", "You stopped pursuing this application. The history remains available.", "Rejected", "close"),
      stage("declined_award", "Award declined", "Record declined award", "Declined the scholarship award", "You chose not to accept the award. The history remains available.", "Rejected", "close"),
      stage("archived", "Archived", "Archive scholarship", "Archived the scholarship", "The scholarship remains in your Journey history.", "Rejected", "close"),
    ],
  },
  research: {
    id: "research",
    label: "Research opportunity",
    stages: [
      stage("saved", "Saved", "Keep saved", "Saved to Journey", "This research opportunity is part of your private Journey.", "Saved", "choose"),
      stage("contacted_lab", "Contacted lab", "Record lab contact", "Contacted the research team", "You reached out about joining the research work.", "Applying", "start"),
      stage("research_application_submitted", "Application submitted", "Record submission", "Submitted a research application", "You recorded a completed research application submission.", "Submitted", "submit", true),
      stage("waitlisted", "Waitlisted", "Record waitlist", "Joined the research waitlist", "You reported that the research decision is still pending.", "Interview", "interview"),
      stage("research_interview", "Research interview", "Record interview", "Interviewed with the research team", "The research team invited you to discuss the opportunity.", "Interview", "interview", true),
      stage("research_accepted", "Research position accepted", "Record acceptance", "Accepted a research opportunity", "You reported that you were accepted into the research opportunity.", "Accepted", "accept", true),
      stage("research_active", "Research underway", "Mark research active", "Began the research experience", "The research opportunity became active work.", "Accepted", "accept", true),
      stage("research_completed", "Research completed", "Record completion", "Completed the research experience", "This research experience is now part of your professional record.", "Completed", "complete", true),
      stage("not_selected", "Not selected", "Record outcome: not selected", "Recorded the research outcome", "The application remains part of your Journey history.", "Rejected", "close"),
      stage("withdrawn", "Withdrawn", "Record withdrawal", "Withdrew from the research opportunity", "You stopped pursuing this opportunity. The broader direction remains open.", "Rejected", "close"),
      stage("declined_position", "Position declined", "Record declined position", "Declined the research position", "You chose not to continue with this position. The history remains available.", "Rejected", "close"),
      stage("archived", "Archived", "Archive research opportunity", "Archived the research opportunity", "The opportunity remains in your Journey history.", "Rejected", "close"),
    ],
  },
  competition: {
    id: "competition",
    label: "Competition",
    stages: [
      stage("saved", "Saved", "Keep saved", "Saved to Journey", "This competition is part of your private Journey.", "Saved", "choose"),
      stage("registered", "Registered", "Record registration", "Registered for the competition", "You recorded your place in the competition.", "Applying", "start"),
      stage("participated", "Competition entered", "Record participation", "Participated in the competition", "You took part and created a new experience to reference.", "Submitted", "submit", true),
      stage("competition_finalist", "Finalist", "Record finalist status", "Became a competition finalist", "Your work advanced to the finalist stage.", "Interview", "interview", true),
      stage("placed", "Placed", "Record placement", "Placed in the competition", "You reported a competition placement.", "Accepted", "accept", true),
      stage("winner", "Competition won", "Record result", "Won the competition", "You reported a winning competition result.", "Accepted", "accept", true),
      stage("competition_completed", "Competition completed", "Record completion", "Completed the competition", "The competition is now part of your professional record.", "Completed", "complete", true),
      stage("withdrawn", "Withdrawn", "Record withdrawal", "Withdrew from the competition", "You stopped participating. The competition remains in Journey history.", "Rejected", "close"),
      stage("archived", "Archived", "Archive competition", "Archived the competition", "The competition remains in your Journey history.", "Rejected", "close"),
    ],
  },
  resource: {
    id: "resource",
    label: "Student resource",
    stages: [
      stage("saved", "Saved", "Keep saved", "Saved to Journey", "This resource is part of your private Journey.", "Saved", "choose"),
      stage("activated", "Resource activated", "Record activation", "Activated the resource", "You began using this student resource.", "Applying", "start"),
      stage("resource_completed", "Resource completed", "Record completion", "Recorded the resource", "This resource is now part of your Journey record.", "Completed", "complete", true),
      stage("archived", "Archived", "Archive resource", "Archived the resource", "The resource remains in your Journey history.", "Rejected", "close"),
    ],
  },
};

const terminalOutcomeIds: Record<JourneyWorkflowKind, ReadonlySet<string>> = {
  career: new Set(["not_selected", "withdrawn", "declined_offer"]),
  scholarship: new Set(["not_selected", "withdrawn", "declined_award"]),
  research: new Set(["not_selected", "withdrawn", "declined_position"]),
  competition: new Set(["withdrawn"]),
  resource: new Set(),
};

function terminalOutcomeAvailable(record: TrackedOpportunity, workflow: JourneyProfessionalWorkflow, stage: JourneyProfessionalStage) {
  if (record.status === "Completed" || record.status === "Rejected") return false;
  if (stage.id === "withdrawn") return record.status !== "Saved";
  if (stage.id === "not_selected") return record.status === "Submitted" || record.status === "Interview";
  if (stage.id === "declined_offer" || stage.id === "declined_award" || stage.id === "declined_position") return record.status === "Accepted";
  return false;
}

export function journeyWorkflowKind(opportunity: Pick<Opportunity, "type" | "category">): JourneyWorkflowKind {
  if (opportunity.type === "Scholarship") return "scholarship";
  if (opportunity.type === "Research") return "research";
  if (/competition|challenge|hackathon|case competition/i.test(`${opportunity.category} ${opportunity.type}`)) return "competition";
  if (opportunity.type === "Career") return "career";
  return "resource";
}

export function getJourneyProfessionalWorkflow(opportunity: Pick<Opportunity, "type" | "category">) {
  return workflows[journeyWorkflowKind(opportunity)];
}

function fallbackStageForStatus(workflow: JourneyProfessionalWorkflow, status: OpportunityTrackerStatus) {
  if (status === "Interested" || status === "Applying") return workflow.stages.find((item) => item.status === "Applying");
  if (status === "Paused") return undefined;
  return workflow.stages.find((item) => item.status === status);
}

export function resolveJourneyProfessionalStage(record: TrackedOpportunity, workflow: JourneyProfessionalWorkflow) {
  const explicit = workflow.stages.find((item) => item.id === record.professionalStageId);
  if (explicit && (explicit.status === record.status || record.status === "Paused")) return explicit;
  return fallbackStageForStatus(workflow, record.status) ?? workflow.stages[0];
}

export function getJourneyProfessionalActions(record: TrackedOpportunity, workflow: JourneyProfessionalWorkflow): JourneyProfessionalAction[] {
  if (record.status === "Rejected") {
    const priorStageId = [...(record.history ?? [])].reverse().find((item) => item.professionalStageId && item.professionalStageId !== "archived")?.professionalStageId;
    const restoreStage = workflow.stages.find((item) => item.id === priorStageId) ?? workflow.stages[0];
    return [{ id: restoreStage.id, label: `Restore to ${restoreStage.label}`, transition: restoreStage.transition, resultingStatus: restoreStage.status, stage: restoreStage, correction: true }];
  }
  if (record.status === "Paused") {
    const resumeId = record.pausedFromProfessionalStageId;
    const resumeStage = workflow.stages.find((item) => item.id === resumeId)
      ?? fallbackStageForStatus(workflow, record.pausedFrom ?? "Applying")
      ?? workflow.stages[1];
    return [{ id: "resume", label: `Resume at ${resumeStage.label}`, transition: "resume", resultingStatus: resumeStage.status, stage: resumeStage }];
  }
  const current = resolveJourneyProfessionalStage(record, workflow);
  const index = workflow.stages.findIndex((item) => item.id === current.id);
  const terminalIds = terminalOutcomeIds[workflow.id];
  const nextStages = workflow.stages.slice(index + 1).filter((item) => item.id !== "archived" && !terminalIds.has(item.id));
  const actions: JourneyProfessionalAction[] = [];
  for (const next of nextStages) actions.push({ id: next.id, label: next.actionLabel, transition: next.transition, resultingStatus: next.status, stage: next });
  for (const terminal of workflow.stages.filter((item) => terminalIds.has(item.id) && terminalOutcomeAvailable(record, workflow, item))) {
    actions.push({ id: terminal.id, label: terminal.actionLabel, transition: terminal.transition, resultingStatus: terminal.status, stage: terminal, destructive: true });
  }
  for (const correction of workflow.stages.slice(0, Math.max(0, index))) {
    actions.push({ id: correction.id, label: `Correct to ${correction.label}`, transition: correction.transition, resultingStatus: correction.status, stage: correction, correction: true });
  }
  if (index > 0 && record.status !== "Completed") actions.push({ id: "paused", label: "Pause this opportunity", transition: "pause", resultingStatus: "Paused" });
  if (record.status !== "Completed") actions.push({ id: "archived", label: "Archive", transition: "close", resultingStatus: "Rejected", destructive: true, stage: workflow.stages.at(-1) });
  return actions;
}

export function isJourneyProfessionalStageId(value: string) {
  return Object.values(workflows).some((workflow) => workflow.stages.some((item) => item.id === value)) || value === "paused" || value === "resume";
}

export function professionalStageById(workflow: JourneyProfessionalWorkflow, id: string) {
  return workflow.stages.find((item) => item.id === id);
}

export const journeyProfessionalWorkflows = workflows;
