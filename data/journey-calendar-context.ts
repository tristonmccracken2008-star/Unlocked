import type { JourneyCalendarEventType } from "@/lib/account-types";

export const journeyCalendarAddEvent = "unlocked-journey-calendar-add";

export type JourneyCalendarAddContext = {
  opportunityId: string;
  opportunityTitle: string;
  type: JourneyCalendarEventType;
  title: string;
  reminderMinutesBefore?: number;
  trigger?: HTMLButtonElement;
};

export function openJourneyCalendarAdd(context: JourneyCalendarAddContext, trigger?: HTMLButtonElement) {
  window.dispatchEvent(new CustomEvent<JourneyCalendarAddContext>(journeyCalendarAddEvent, { detail: { ...context, trigger } }));
}
