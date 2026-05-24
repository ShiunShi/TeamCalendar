import {
  addDays,
  differenceInCalendarDays,
  isSameDay,
  startOfDay,
} from "date-fns";
import { Timestamp } from "firebase/firestore";

import type { Event } from "@/lib/types";
import type { EventInput } from "@/lib/db/events";

// Droppable id format for day cells. Stable, local-date based.
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Drag-id format: chips are `${eventId}:single`, bar segments are
// `${eventId}:wk${weekIndex}`. Both resolve to the same event in onDragEnd.
export function dragIdForChip(eventId: string): string {
  return `${eventId}:single`;
}
export function dragIdForBar(eventId: string, weekIndex: number): string {
  return `${eventId}:wk${weekIndex}`;
}

// Build a new Event reflecting a drag-move. Returns null when the drop is a
// no-op (same day as origin). Single-day → set date. Multi-day → shift start
// + end by delta = dropDay - oldStart so span is preserved.
export function shiftEvent(event: Event, dropDay: Date): Event | null {
  const drop = startOfDay(dropDay);
  if (event.isSingleDay) {
    if (!event.date) return null;
    if (isSameDay(event.date.toDate(), drop)) return null;
    return { ...event, date: Timestamp.fromDate(drop) };
  }
  if (!event.startDate || !event.endDate) return null;
  const oldStart = event.startDate.toDate();
  if (isSameDay(oldStart, drop)) return null;
  const delta = differenceInCalendarDays(drop, oldStart);
  const newStart = addDays(oldStart, delta);
  const newEnd = addDays(event.endDate.toDate(), delta);
  return {
    ...event,
    startDate: Timestamp.fromDate(startOfDay(newStart)),
    endDate: Timestamp.fromDate(startOfDay(newEnd)),
  };
}

// Pack an Event into the EventInput shape that lib/db/events.ts#updateEvent
// expects. Only the date fields actually differ during a drag-move; the rest
// is passed through unchanged.
export function eventToInput(event: Event): EventInput {
  return {
    title: event.title,
    description: event.description,
    type: event.type,
    isSingleDay: event.isSingleDay,
    date: event.date ? event.date.toDate() : null,
    startDate: event.startDate ? event.startDate.toDate() : null,
    endDate: event.endDate ? event.endDate.toDate() : null,
  };
}
