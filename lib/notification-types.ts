import type { OpportunityTrackerStatus } from "@/data/student-activity";

export const notificationTypes = [
  "deadline_reminder",
  "journey_reminder",
  "opportunity_change",
  "journey_follow_up",
  "weekly_digest",
  "recommendation_update",
  "account",
] as const;

export type NotificationType = (typeof notificationTypes)[number];
export type NotificationPriority = "critical" | "high" | "normal" | "low";
export type NotificationState = "generated" | "delivered" | "read" | "dismissed" | "acted_on" | "expired" | "canceled" | "failed" | "suppressed";
export type NotificationChannelState = "not_requested" | "scheduled" | "sent" | "delivered" | "failed" | "suppressed";

export type NotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  deadlineReminders: boolean;
  journeyReminders: boolean;
  opportunityChanges: boolean;
  weeklyDigest: boolean;
  recommendationUpdates: boolean;
  frequency: "important_only" | "balanced";
  timezone: string;
  quietHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
  };
  updatedAt: string;
};

export type NotificationChannelDelivery = {
  state: NotificationChannelState;
  attemptedAt?: string;
  deliveredAt?: string;
  providerId?: string;
  failureCode?: string;
};

export type NotificationRecord = {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  state: NotificationState;
  title: string;
  body: string;
  organization?: string;
  opportunityId?: string;
  journeyStatus?: OpportunityTrackerStatus;
  actionLabel: string;
  actionHref: string;
  createdAt: string;
  relevantAt?: string;
  expiresAt: string;
  readAt?: string;
  dismissedAt?: string;
  actedAt?: string;
  idempotencyKey: string;
  contentVersion: string;
  bundledCount?: number;
  channels: {
    inApp: NotificationChannelDelivery;
    email: NotificationChannelDelivery;
  };
};

export type NotificationSchedule = {
  id: string;
  userId: string;
  type: "deadline" | "journey_reminder" | "follow_up" | "opportunity_change" | "weekly_digest" | "email_delivery";
  notificationId?: string;
  attempt?: number;
  opportunityId?: string;
  opportunityTitle?: string;
  organization?: string;
  scheduledFor: string;
  contentVersion: string;
  offsetDays?: number;
  customReminderText?: string;
  change?: OpportunityMaterialChange;
};

export type OpportunityMaterialChangeField =
  | "deadline"
  | "application_status"
  | "application_url"
  | "eligibility"
  | "award"
  | "location"
  | "program_dates";

export type OpportunityMaterialChange = {
  field: OpportunityMaterialChangeField;
  before: string;
  after: string;
  label: string;
  contentVersion: string;
};

export const defaultNotificationPreferences = (updatedAt = new Date().toISOString()): NotificationPreferences => ({
  inAppEnabled: true,
  emailEnabled: true,
  deadlineReminders: true,
  journeyReminders: true,
  opportunityChanges: true,
  weeklyDigest: false,
  recommendationUpdates: false,
  frequency: "important_only",
  timezone: "America/New_York",
  quietHours: {
    enabled: true,
    startHour: 22,
    endHour: 8,
  },
  updatedAt,
});
