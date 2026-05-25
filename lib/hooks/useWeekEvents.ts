"use client";

import * as React from "react";
import { startOfToday } from "date-fns";

import { subscribeYear } from "@/lib/db/events";
import { eventOverlapsDay, isoWeekRange } from "@/lib/calendar/grid";
import type { Event } from "@/lib/types";

// Mirror of useTodayEvents but scoped to the current ISO Mon–Sun week.
// Subscribes to the year doc(s) the week spans (1 normally, 2 across the
// Dec/Jan boundary) and returns events overlapping any day in the week,
// deduped by eventId.
export function useWeekEvents(): { events: Event[]; loading: boolean } {
  const today = React.useMemo(() => startOfToday(), []);
  const week = React.useMemo(() => isoWeekRange(today), [today]);

  const years = React.useMemo(() => {
    const s = week.start.getFullYear();
    const e = week.end.getFullYear();
    return s === e ? [s] : [s, e];
  }, [week]);
  const yearsKey = years.join(",");

  const [byYear, setByYear] = React.useState<Record<number, Event[]>>({});

  React.useEffect(() => {
    const ys = yearsKey.split(",").map(Number);
    const unsubs = ys.map((year) =>
      subscribeYear(year, (events) => {
        setByYear((prev) => ({ ...prev, [year]: events }));
      }),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [yearsKey]);

  const events = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Event[] = [];
    for (const year of years) {
      for (const e of byYear[year] ?? []) {
        if (seen.has(e.eventId)) continue;
        if (!eventOverlapsAnyDayInWeek(e, week.start, week.end)) continue;
        seen.add(e.eventId);
        out.push(e);
      }
    }
    return out;
  }, [byYear, years, week]);

  const loading = years.some((y) => !(y in byYear));

  return { events, loading };
}

function eventOverlapsAnyDayInWeek(
  event: Event,
  start: Date,
  end: Date,
): boolean {
  let cursor = start;
  while (cursor <= end) {
    if (eventOverlapsDay(event, cursor)) return true;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return false;
}
