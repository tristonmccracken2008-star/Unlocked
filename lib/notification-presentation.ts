import type { NotificationRecord } from "./notification-types";

export const notificationGroupLabels = ["Today", "Yesterday", "Earlier This Week", "Earlier"] as const;
export type NotificationGroupLabel = (typeof notificationGroupLabels)[number];

function localDayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

export function notificationGroupLabel(timestamp: string, now = new Date()): NotificationGroupLabel {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Earlier";
  const dayDifference = localDayNumber(now) - localDayNumber(date);
  if (dayDifference <= 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return dayDifference <= daysSinceMonday ? "Earlier This Week" : "Earlier";
}

export function groupNotifications(items: NotificationRecord[], now = new Date()) {
  const grouped = new Map<NotificationGroupLabel, NotificationRecord[]>(
    notificationGroupLabels.map((label) => [label, []]),
  );
  for (const item of items) grouped.get(notificationGroupLabel(item.createdAt, now))!.push(item);
  return notificationGroupLabels
    .map((label) => ({ label, items: grouped.get(label)! }))
    .filter((group) => group.items.length > 0);
}

export function notificationTimestamp(timestamp: string, now = new Date()) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const dayDifference = localDayNumber(now) - localDayNumber(date);
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  if (dayDifference <= 0) {
    if (elapsed < 60_000) return "Just now";
    if (elapsed < 3_600_000) {
      const minutes = Math.max(1, Math.floor(elapsed / 60_000));
      return `${minutes} min ago`;
    }
    const hours = Math.max(1, Math.floor(elapsed / 3_600_000));
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (dayDifference === 1) return "Yesterday";
  if (dayDifference < 7) return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}
