import { aidChecklistStatuses, normalizeFinancialAidStore, waiverStatuses, type AidOffer } from "@/data/financial-aid";
import { mutateFinancialAid } from "./auth-store";

export type FinancialAidMutation =
  | { action: "set_checklist"; expectedVersion: number; itemId: string; status: typeof aidChecklistStatuses[number] }
  | { action: "save_npc"; expectedVersion: number; collegeId: string; amount: number; calculatedAt: string; academicYear?: string; privateNote?: string }
  | { action: "save_offer"; expectedVersion: number; offer: Omit<AidOffer, "updatedAt" | "version"> }
  | { action: "set_workflow"; expectedVersion: number; collegeId: string; field: "fafsa" | "cssProfile" | "idoc" | "waiver" | "aidReview"; value: string; deadline?: string };

export async function updateFinancialAid(userId: string, mutation: FinancialAidMutation) {
  return mutateFinancialAid(userId, { expectedVersion: mutation.expectedVersion, mutate(current) {
    const store = normalizeFinancialAidStore(current), now = new Date().toISOString();
    if (mutation.action === "set_checklist") return { ...store, checklist: { ...store.checklist, [mutation.itemId]: mutation.status }, version: store.version + 1, updatedAt: now };
    if (mutation.action === "save_npc") {
      const previous = store.netPriceEstimates[mutation.collegeId];
      return { ...store, netPriceEstimates: { ...store.netPriceEstimates, [mutation.collegeId]: { collegeId: mutation.collegeId, amount: mutation.amount, calculatedAt: mutation.calculatedAt, academicYear: mutation.academicYear, privateNote: mutation.privateNote, updatedAt: now, version: (previous?.version ?? -1) + 1 } }, version: store.version + 1, updatedAt: now };
    }
    if (mutation.action === "save_offer") {
      const previous = store.offers[mutation.offer.collegeId];
      return { ...store, offers: { ...store.offers, [mutation.offer.collegeId]: { ...mutation.offer, updatedAt: now, version: (previous?.version ?? -1) + 1 } }, version: store.version + 1, updatedAt: now };
    }
    const previous = store.collegeWorkflows[mutation.collegeId];
    const base = previous ?? { collegeId: mutation.collegeId, fafsa: "need_this", cssProfile: "need_this", idoc: "need_this", waiver: "need_to_review", aidReview: "not_started", updatedAt: now, version: -1 };
    if (["fafsa","cssProfile","idoc"].includes(mutation.field) && !aidChecklistStatuses.includes(mutation.value as never)) throw new Error("Choose a valid form status.");
    if (mutation.field === "waiver" && !waiverStatuses.includes(mutation.value as never)) throw new Error("Choose a valid waiver status.");
    if (mutation.field === "aidReview" && !["not_started","preparing","submitted","resolved"].includes(mutation.value)) throw new Error("Choose a valid review status.");
    return { ...store, collegeWorkflows: { ...store.collegeWorkflows, [mutation.collegeId]: { ...base, [mutation.field]: mutation.value, deadline: mutation.deadline ?? base.deadline, updatedAt: now, version: base.version + 1 } }, version: store.version + 1, updatedAt: now };
  }});
}
