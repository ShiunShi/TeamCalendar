"use client";

import * as React from "react";

import { subscribeYear } from "@/lib/db/events";
import { gridYears } from "@/lib/calendar/grid";
import type { Event } from "@/lib/types";

// Subscribes to the year doc(s) that the visible 42-cell window spans (1 or 2
// per §8.7). Dedupes by eventId in case the same event somehow appears in
// both years (shouldn't, but cheap insurance — §6.3 forbids spanning years).
export function useMonthEvents(focusedMonth: Date): {
  events: Event[];
  loading: boolean;
} {
  // Stable key so we only re-subscribe when the set of years actually changes.
  const yearsKey = gridYears(focusedMonth).join(",");

  const [byYear, setByYear] = React.useState<Record<number, Event[]>>({});

  React.useEffect(() => {
    const years = yearsKey.split(",").map(Number);
    const unsubs = years.map((year) =>
      subscribeYear(year, (events) => {
        setByYear((prev) => ({ ...prev, [year]: events }));
      }),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [yearsKey]);

  const years = React.useMemo(
    () => yearsKey.split(",").map(Number),
    [yearsKey],
  );

  const events = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Event[] = [];
    for (const year of years) {
      for (const e of byYear[year] ?? []) {
        if (seen.has(e.eventId)) continue;
        seen.add(e.eventId);
        out.push(e);
      }
    }
    return out;
  }, [byYear, years]);

  // Derived: we're loading until each active year has reported at least once
  // (an empty list still counts — subscribeYear() emits [] for a missing doc).
  const loading = years.some((y) => !(y in byYear));

  return { events, loading };
}
