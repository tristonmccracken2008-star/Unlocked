import type { OpportunityTrackerStatus } from "@/data/student-activity";

export const notificationTypes = [
  "deadline_reminder",
  "journey_reminder",
  "opportunity_change",
  "journey_follow_up",
  "milestone",
  "weekly_digest",
  "recommendation_update",
  "account",
  "product_announcement",
] as const;

export type NotificationType = (typeof notificationTypes)[number];
export type NotificationPriority = "critical" | "high" | "normal" | "low";
export type NotificationState = "generated" | "delivered" | "read" | "dismissed" | "archived" | "acted_on" | "expired" | "canceled" | "failed" | "suppressed";
export type NotificationChannelState = "not_requested" | "scheduled" | "sent" | "delivered" | "failed" | "suppressed";

export type NotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  deadlineReminders: boolean;
  journeyReminders: boolean;
  opportunityChanges: boolean;
  personalizedOpportunities: boolean;
  milestoneUpdates: boolean;
  accountUpdates: boolean;
  productAnnouncements: boolean;
  weeklyDigest: boolean;
  /** Retained so previously saved preference payloads continue to normalize safely. */
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
  calendarEventId?: string;
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
  calendarEventId?: string;
  opportunityTitle?: string;
  organization?: string;
  scheduledFor: string;
  contentVersion: string;
  offsetDays?: number;
  followUpKind?: "saved_check_in" | "deadline_passed";
  customReminderText?: string;
  change?: OpportunityMaterialChange;
  changes?: OpportunityMaterialChange[];
};

export type OpportunityMaterialChangeField =
  | "deadline"
  | "opening_date"
  | "application_status"
  | "application_url"
  | "eligibility"
  | "award"
  | "compensation"
  | "location"
  | "work_mode"
  | "program_dates"
  | "cycle"
  | "requirements"
  | "application_process";

export type OpportunityMaterialChange = {
  field: OpportunityMaterialChangeField;
  before: string;
  after: string;
  label: string;
  contentVersion: string;
  message?: string;
  eventId?: string;
  importance?: "critical" | "important" | "informational";
};

export const defaultNotificationPreferences = (updatedAt = new Date().toISOString()): NotificationPreferences => ({
  inAppEnabled: true,
  emailEnabled: true,
  deadlineReminders: true,
  journeyReminders: true,
  opportunityChanges: true,
  personalizedOpportunities: true,
  milestoneUpdates: true,
  accountUpdates: true,
  productAnnouncements: false,
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
