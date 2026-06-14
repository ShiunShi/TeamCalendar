"use client";

import { useSearchParams } from "next/navigation";

import {
  parseCalendarDisplayMode,
  type CalendarDisplayMode,
} from "@/lib/calendar/displayMode";

export function useCalendarDisplayMode(): CalendarDisplayMode {
  const searchParams = useSearchParams();
  return parseCalendarDisplayMode(searchParams.get("calendar"));
}
