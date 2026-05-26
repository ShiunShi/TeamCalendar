import type { Event } from "@/lib/types";
import { eventOverlapsDay } from "@/lib/calendar/grid";

const OUT_RE = /pto|vacation|out|leave|sick/i;

export type PillKind = "out" | "birthdays";

export function eventMatchesPill(
  event: Event,
  kind: PillKind,
  today: Date,
  weekRange: { start: Date; end: Date },
): boolean {
  switch (kind) {
    case "out":
      return (
        event.type === "Personal" &&
        OUT_RE.test(event.title) &&
        eventOverlapsDay(event, today)
      );
    case "birthdays":
      return (
        event.type === "Birthday" &&
        dayInsideRange(event, weekRange.start, weekRange.end)
      );
  }
}

// Birthday is a single-day event — but be defensive and check the whole
// range for safety (someone could create a multi-day "Birthday" event).
function dayInsideRange(event: Event, start: Date, end: Date): boolean {
  let cursor = start;
  while (cursor <= end) {
    if (eventOverlapsDay(event, cursor)) return true;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return false;
}
