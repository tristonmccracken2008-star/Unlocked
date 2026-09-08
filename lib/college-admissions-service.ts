import crypto from "node:crypto";
import { collegePriorityOptions, verifiedCollegeAdmissions, type CollegeAdmissionsJourney, type CollegeAdmissionsTask, type CollegeApplicationPlan, type CollegeDecisionOutcome, type CollegeInterestState, type CollegeListRecord, type CollegeRequirementStatus } from "@/data/college-admissions";
import { mutateCollegeAdmissions } from "./auth-store";
import { getCollege } from "./colleges";

export type CollegeAdmissionsMutation =
  | { action: "update_college"; collegeId: string; interestState?: CollegeInterestState; favorite?: boolean; plan?: CollegeApplicationPlan; notes?: string; priorities?: string[] }
  | { action: "add_task"; collegeId?: string; title: string; dueDate?: string }
  | { action: "set_task"; collegeId?: string; taskId: string; completed: boolean }
  | { action: "add_requirement"; collegeId: string; title: string }
  | { action: "set_requirement"; collegeId: string; requirementId: string; status: CollegeRequirementStatus }
  | { action: "mark_applied"; collegeId: string; submittedAt: string; notes?: string }
  | { action: "record_decision"; collegeId: string; outcome: CollegeDecisionOutcome; receivedAt: string; entryTerm?: string }
  | { action: "commit"; collegeId: string };

const now = () => new Date().toISOString();
function application(record: CollegeListRecord) {
  const timestamp = now();
  return record.application ?? { plan: "unknown" as const, status: "planning" as const, requirements: [], tasks: [], version: 0, updatedAt: timestamp };
}
function task(title: string, collegeId?: string, dueDate?: string): CollegeAdmissionsTask { const timestamp = now(); return { id: `admission-task:${crypto.randomUUID()}`, collegeId, title, dueDate, completed: false, createdAt: timestamp, updatedAt: timestamp }; }

export async function updateCollegeAdmissions(userId: string, mutation: CollegeAdmissionsMutation) {
  return await mutateCollegeAdmissions(userId, (records, journey) => {
    if ("collegeId" in mutation && mutation.collegeId && !getCollege(mutation.collegeId)) throw new Error("College not found.");
    if (mutation.action === "add_task" && !mutation.collegeId) return { records, journey: { ...journey, tasks: [...journey.tasks, task(mutation.title, undefined, mutation.dueDate)].slice(-300) } };
    if (mutation.action === "set_task" && !mutation.collegeId) return { records, journey: { ...journey, tasks: journey.tasks.map((item) => item.id === mutation.taskId ? { ...item, completed: mutation.completed, updatedAt: now() } : item) } };
    const collegeId = mutation.collegeId!;
    const index = records.findIndex((item) => item.collegeId === collegeId);
    if (index < 0) throw new Error("Save this college before planning an application.");
    const current = records[index];
    let next = current;
    const timestamp = now();
    if (mutation.action === "update_college") {
      const verified = verifiedCollegeAdmissions[collegeId];
      if (mutation.plan && mutation.plan !== "unknown" && verified && !verified.validPlans.includes(mutation.plan)) throw new Error("That application plan is not listed for the verified cycle.");
      const app = application(current);
      const requirements = mutation.plan !== undefined ? [...app.requirements] : app.requirements;
      if (mutation.plan !== undefined) for (const requirement of verified?.requirements ?? []) if (!requirements.some((item) => item.id === requirement.id)) requirements.push({ ...requirement, status: "not_started", provenance: "official_verified", cycle: verified!.cycle, verifiedAt: verified!.verifiedAt, createdAt: timestamp, updatedAt: timestamp });
      const nextApplication = mutation.plan !== undefined ? { ...app, plan: mutation.plan, requirements, status: app.status === "planning" ? "preparing" as const : app.status, version: app.version + 1, updatedAt: timestamp } : current.application;
      next = { ...current, interestState: mutation.interestState ?? current.interestState, favorite: mutation.favorite ?? current.favorite, notes: mutation.notes ?? current.notes, priorities: mutation.priorities?.filter((item) => collegePriorityOptions.includes(item as never)).slice(0, 9) ?? current.priorities, application: nextApplication, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "add_task") {
      const app = application(current); next = { ...current, application: { ...app, tasks: [...app.tasks, task(mutation.title, collegeId, mutation.dueDate)].slice(-200), status: "preparing", version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "set_task") {
      const app = application(current); next = { ...current, application: { ...app, tasks: app.tasks.map((item) => item.id === mutation.taskId ? { ...item, completed: mutation.completed, updatedAt: timestamp } : item), version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "add_requirement") {
      const app = application(current); next = { ...current, application: { ...app, requirements: [...app.requirements, { id: `college-requirement:${crypto.randomUUID()}`, type: "other", title: mutation.title, status: "needs_verification", provenance: "student_added", createdAt: timestamp, updatedAt: timestamp }], version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "set_requirement") {
      const app = application(current); next = { ...current, application: { ...app, requirements: app.requirements.map((item) => item.id === mutation.requirementId ? { ...item, status: mutation.status, updatedAt: timestamp } : item), version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "mark_applied") {
      const app = application(current); next = { ...current, interestState: "applied", application: { ...app, status: "applied", submittedAt: mutation.submittedAt, applicationNotes: mutation.notes, version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "record_decision") {
      const app = application(current); next = { ...current, interestState: "decision_received", application: { ...app, status: "decision_received", decision: { outcome: mutation.outcome, receivedAt: mutation.receivedAt, entryTerm: mutation.entryTerm }, version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    } else if (mutation.action === "commit") {
      if (current.application?.decision?.outcome !== "accepted") throw new Error("Record an acceptance before choosing where you are going.");
      records = records.map((item) => item.application?.status === "committed" ? { ...item, application: { ...item.application, status: "decision_received", committedAt: undefined, updatedAt: timestamp } } : item);
      const app = application(current); next = { ...current, application: { ...app, status: "committed", committedAt: timestamp, version: app.version + 1, updatedAt: timestamp }, version: current.version + 1, updatedAt: timestamp };
    }
    records[index] = next;
    return { records, journey };
  });
}
