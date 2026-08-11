export type ReturnBriefingKind = "deadline" | "application" | "opportunity_change" | "recommendation" | "notification" | "continuation";
export type ReturnBriefingUrgency = "critical" | "high" | "normal";

export type ReturnBriefingItem = {
  id: string;
  kind: ReturnBriefingKind;
  title: string;
  detail: string;
  meta?: string;
  href: string;
  actionLabel: string;
  urgency: ReturnBriefingUrgency;
  notificationId?: string;
  opportunityId?: string;
  applicationTargetId?: string;
  dismissible: boolean;
};

export type ReturnBriefingModel = {
  greeting: string;
  heading: string;
  items: ReturnBriefingItem[];
  allCaughtUp: boolean;
  generatedAt: string;
};
