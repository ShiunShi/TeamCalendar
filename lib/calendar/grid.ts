import {
  addDays,
  endOfWeek,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { Event } from "@/lib/types";

// §7.5 — week starts Monday. We hardcode `weekStartsOn: 1` everywhere so the
// grid layout matches the spec regardless of the user's locale.
const MON = 1 as const;

export interface GridCell {
  date: Date;
  inFocusedMonth: boolean;
}

// 42-cell, Mon-first grid covering the focused month.
export function getMonthGrid(focusedMonth: Date): GridCell[] {
  const firstOfMonth = startOfMonth(focusedMonth);
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: MON });
  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    cells.push({
      date,
      inFocusedMonth: date.getMonth() === focusedMonth.getMonth(),
    });
  }
  return cells;
}

// Years (set, deduped) the 42-cell window touches. Used by useMonthEvents to
// decide whether to subscribe to one or two year docs (§8.7).
export function gridYears(focusedMonth: Date): number[] {
  const cells = getMonthGrid(focusedMonth);
  const first = cells[0].date.getFullYear();
  const last = cells[cells.length - 1].date.getFullYear();
  return first === last ? [first] : [first, last];
}

// Normalize an event's date(s) to a [start, end] interval of midnights.
// Single-day → start === end. Returns null if the event is malformed.
export function eventInterval(
  event: Event,
): { start: Date; end: Date; isMultiDay: boolean } | null {
  if (event.isSingleDay) {
    if (!event.date) return null;
    const d = startOfDay(event.date.toDate());
    return { start: d, end: d, isMultiDay: false };
  }
  if (!event.startDate || !event.endDate) return null;
  const start = startOfDay(event.startDate.toDate());
  const end = startOfDay(event.endDate.toDate());
  return { start, end, isMultiDay: !isSameDay(start, end) };
}

export function eventOverlapsDay(event: Event, day: Date): boolean {
  const interval = eventInterval(event);
  if (!interval) return false;
  return isWithinInterval(startOfDay(day), {
    start: interval.start,
    end: interval.end,
  });
}

export function eventsForDay(events: Event[], day: Date): Event[] {
  return events.filter((e) => eventOverlapsDay(e, day));
}

// §13.9 — segment a multi-day event into per-week runs so the renderer can
// draw one bar per week, with square corners at week wraps. Each segment is
// described in row/column terms relative to the 6×7 grid.
export interface BarSegment {
  event: Event;
  weekIndex: number;     // 0..5 — which row of the 6-week grid
  startCol: number;      // 0..6 — Monday=0
  span: number;          // 1..7 columns
  isLeadingSegment: boolean; // true on the segment that contains the event's true start
  isTrailingSegment: boolean; // true on the segment that contains the event's true end
}

export function splitEventToSegments(
  event: Event,
  cells: GridCell[],
): BarSegment[] {
  const interval = eventInterval(event);
  if (!interval) return [];

  const gridStart = cells[0].date;
  const gridEnd = cells[cells.length - 1].date;

  // Clamp the event's range to what the grid actually shows.
  const visibleStart = interval.start < gridStart ? gridStart : interval.start;
  const visibleEnd = interval.end > gridEnd ? gridEnd : interval.end;
  if (visibleStart > visibleEnd) return [];

  const segments: BarSegment[] = [];
  let cursor = visibleStart;
  while (cursor <= visibleEnd) {
    const weekEnd = endOfWeek(cursor, { weekStartsOn: MON });
    const segEnd = weekEnd > visibleEnd ? visibleEnd : weekEnd;

    const startIndex = cells.findIndex((c) => isSameDay(c.date, cursor));
    const endIndex = cells.findIndex((c) => isSameDay(c.date, segEnd));
    if (startIndex < 0 || endIndex < 0) break;

    segments.push({
      event,
      weekIndex: Math.floor(startIndex / 7),
      startCol: startIndex % 7,
      span: endIndex - startIndex + 1,
      isLeadingSegment: isSameDay(cursor, interval.start),
      isTrailingSegment: isSameDay(segEnd, interval.end),
    });
    cursor = addDays(segEnd, 1);
  }
  return segments;
}

// Used by §6.5 "birthdays this week" pill. Mon-Sun ISO week containing `day`.
export function isoWeekRange(day: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(day, { weekStartsOn: MON }),
    end: endOfWeek(day, { weekStartsOn: MON }),
  };
}
