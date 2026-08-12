"use client";

import type { JourneyCalendarAddContext } from "@/data/journey-calendar-context";
import { openJourneyCalendarAdd } from "@/data/journey-calendar-context";
import { CalendarIcon } from "./icons";

export function ContextualCalendarAction({ context, className = "", label }: { context: JourneyCalendarAddContext; className?: string; label: string }) {
  return <button type="button" className={className} onClick={(event) => openJourneyCalendarAdd(context, event.currentTarget)}><CalendarIcon />{label}</button>;
}
