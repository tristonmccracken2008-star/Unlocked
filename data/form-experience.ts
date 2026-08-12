export const dateShortcutOptions = [
  { id: "today", label: "Today", days: 0 },
  { id: "tomorrow", label: "Tomorrow", days: 1 },
  { id: "next-week", label: "Next week", days: 7 },
] as const;

export function explicitDateFromShortcut(days: number, now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateAfterOfficialDeadline(date: string, officialDeadline?: string) {
  return Boolean(date && officialDeadline && date > officialDeadline.slice(0, 10));
}
