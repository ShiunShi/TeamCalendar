"use client";

import * as React from "react";
import { startOfToday } from "date-fns";

import { subscribeYear } from "@/lib/db/events";
import { eventOverlapsDay } from "@/lib/calendar/grid";
import type { Event } from "@/lib/types";

// §6.6 — derives the sidebar member-status badge by surfacing events that
// overlap today. Subscribes to the current year doc only; multi-day events
// crossing the Dec/Jan boundary are visible from whichever year doc they
// were written to (createEvent writes to both year docs in that case).
export function useTodayEvents(): { events: Event[]; loading: boolean } {
  const today = React.useMemo(() => startOfToday(), []);
  const year = today.getFullYear();
  const [yearEvents, setYearEvents] = React.useState<Event[] | null>(null);

  React.useEffect(() => {
    return subscribeYear(year, (events) => {
      setYearEvents(events);
    });
  }, [year]);

  const events = React.useMemo(() => {
    if (!yearEvents) return [];
    return yearEvents.filter((e) => eventOverlapsDay(e, today));
  }, [yearEvents, today]);

  return { events, loading: yearEvents === null };
}
