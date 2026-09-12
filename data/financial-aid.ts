export const aidChecklistStatuses = ["need_this", "ready", "complete", "not_applicable"] as const;
export type AidChecklistStatus = (typeof aidChecklistStatuses)[number];
export const aidChecklistStatusLabels: Record<AidChecklistStatus, string> = {
  need_this: "Need this", ready: "Ready", complete: "Complete", not_applicable: "Not applicable",
};

export const waiverStatuses = ["need_to_review", "preparing", "submitted", "approved", "denied", "more_information_requested", "not_applicable"] as const;
export type WaiverStatus = (typeof waiverStatuses)[number];

export type NetPriceEstimate = {
  collegeId: string; amount: number; calculatedAt: string; academicYear?: string; privateNote?: string; updatedAt: string; version: number;
};
export type AidOffer = {
  collegeId: string; academicYear: string; costOfAttendance: number;
  grants: number; scholarships: number; workStudy: number; subsidizedLoans: number;
  unsubsidizedLoans: number; parentLoans: number; otherFinancing: number;
  renewableGiftAid: "yes" | "no" | "mixed" | "unknown"; conditions?: string;
  updatedAt: string; version: number;
};
export type CollegeAidWorkflow = {
  collegeId: string; fafsa: AidChecklistStatus; cssProfile: AidChecklistStatus;
  idoc: AidChecklistStatus; waiver: WaiverStatus; aidReview: "not_started" | "preparing" | "submitted" | "resolved";
  deadline?: string; updatedAt: string; version: number;
};
export type FinancialAidStore = {
  checklist: Record<string, AidChecklistStatus>;
  netPriceEstimates: Record<string, NetPriceEstimate>;
  offers: Record<string, AidOffer>;
  collegeWorkflows: Record<string, CollegeAidWorkflow>;
  version: number; updatedAt?: string;
};

export const emptyFinancialAidStore = (): FinancialAidStore => ({ checklist: {}, netPriceEstimates: {}, offers: {}, collegeWorkflows: {}, version: 0 });
const money = (value: unknown) => Number.isFinite(Number(value)) ? Math.min(1_000_000, Math.max(0, Math.round(Number(value)))) : 0;
const date = (value: unknown) => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value) ? value : undefined;
const text = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : undefined;

export function normalizeFinancialAidStore(value: FinancialAidStore | null | undefined): FinancialAidStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyFinancialAidStore();
  const checklist: Record<string, AidChecklistStatus> = {};
  for (const [key, status] of Object.entries(value.checklist ?? {}).slice(-30)) if (aidChecklistStatuses.includes(status)) checklist[key.slice(0, 80)] = status;
  const netPriceEstimates: Record<string, NetPriceEstimate> = {};
  for (const [collegeId, item] of Object.entries(value.netPriceEstimates ?? {}).slice(-100)) if (item?.collegeId) netPriceEstimates[collegeId] = { collegeId, amount: money(item.amount), calculatedAt: date(item.calculatedAt) ?? new Date().toISOString().slice(0,10), academicYear: text(item.academicYear, 24), privateNote: text(item.privateNote, 1000), updatedAt: item.updatedAt ?? new Date().toISOString(), version: Math.max(0, Math.floor(item.version ?? 0)) };
  const offers: Record<string, AidOffer> = {};
  for (const [collegeId, item] of Object.entries(value.offers ?? {}).slice(-100)) if (item?.collegeId) offers[collegeId] = { collegeId, academicYear: text(item.academicYear, 24) ?? "Not specified", costOfAttendance: money(item.costOfAttendance), grants: money(item.grants), scholarships: money(item.scholarships), workStudy: money(item.workStudy), subsidizedLoans: money(item.subsidizedLoans), unsubsidizedLoans: money(item.unsubsidizedLoans), parentLoans: money(item.parentLoans), otherFinancing: money(item.otherFinancing), renewableGiftAid: ["yes","no","mixed","unknown"].includes(item.renewableGiftAid) ? item.renewableGiftAid : "unknown", conditions: text(item.conditions, 1000), updatedAt: item.updatedAt ?? new Date().toISOString(), version: Math.max(0, Math.floor(item.version ?? 0)) };
  const collegeWorkflows: Record<string, CollegeAidWorkflow> = {};
  for (const [collegeId, item] of Object.entries(value.collegeWorkflows ?? {}).slice(-100)) if (item?.collegeId) collegeWorkflows[collegeId] = { collegeId, fafsa: aidChecklistStatuses.includes(item.fafsa) ? item.fafsa : "need_this", cssProfile: aidChecklistStatuses.includes(item.cssProfile) ? item.cssProfile : "need_this", idoc: aidChecklistStatuses.includes(item.idoc) ? item.idoc : "need_this", waiver: waiverStatuses.includes(item.waiver) ? item.waiver : "need_to_review", aidReview: ["not_started","preparing","submitted","resolved"].includes(item.aidReview) ? item.aidReview : "not_started", deadline: date(item.deadline), updatedAt: item.updatedAt ?? new Date().toISOString(), version: Math.max(0, Math.floor(item.version ?? 0)) };
  return { checklist, netPriceEstimates, offers, collegeWorkflows, version: Math.max(0, Math.floor(value.version ?? 0)), updatedAt: value.updatedAt };
}

export function offerMath(offer: AidOffer) {
  const giftAid = offer.grants + offer.scholarships;
  const netBeforeBorrowing = Math.max(0, offer.costOfAttendance - giftAid);
  const studentBorrowing = offer.subsidizedLoans + offer.unsubsidizedLoans;
  const remainingCost = Math.max(0, netBeforeBorrowing - studentBorrowing - offer.parentLoans - offer.workStudy - offer.otherFinancing);
  return { giftAid, netBeforeBorrowing, studentBorrowing, parentBorrowing: offer.parentLoans, workStudy: offer.workStudy, remainingCost };
}

export const financialAidChecklist = [
  { id: "student_account", label: "StudentAid.gov account", detail: "Each contributor uses their own account." },
  { id: "contributors", label: "Contributor information", detail: "Use the official parent wizard when the answer is unclear." },
  { id: "tax_information", label: "Required tax information", detail: "Keep records with you; UnlockED does not store tax returns." },
  { id: "child_support", label: "Child support records, if applicable", detail: "Only when the FAFSA asks for them." },
  { id: "assets", label: "Asset records, if applicable", detail: "UnlockED does not store account numbers or statements." },
  { id: "schools", label: "Schools to receive FAFSA", detail: "Review school and state deadlines separately." },
] as const;
