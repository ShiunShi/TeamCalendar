import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import type { Event, EventType, YearEvents } from "@/lib/types";

// §8.5 — events/{year}. One doc per year.
// Live subscription returns [] when the doc doesn't exist yet (first event of
// the year hasn't been created — the doc is created on first write below).
export function subscribeYear(
  year: number,
  cb: (events: Event[]) => void,
): Unsubscribe {
  const ref = doc(getDb(), "events", String(year));
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const data = snap.data() as YearEvents;
    cb(data.events ?? []);
  });
}

// ───────────────────────────────────────────────────────────────
// §6.4 — event create / edit / delete
// ───────────────────────────────────────────────────────────────

export interface EventInput {
  title: string;
  description: string | null;
  type: EventType;
  isSingleDay: boolean;
  date: Date | null;
  startDate: Date | null;
  endDate: Date | null;
}

export interface CreateEventInput extends EventInput {
  creatorId: string;
  creatorName: string;
  creatorTeamId: string;
}

// §6.1 — date fields are date-only. Normalize to local-midnight before writing.
function toDateOnly(d: Date): Timestamp {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  return Timestamp.fromDate(local);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// §6.3 — defense-in-depth validation. The dialog validates too, but every
// write path goes through here, so the helper is the source of truth.
function validateInput(input: EventInput): void {
  const title = input.title.trim();
  if (title.length === 0) throw new Error("Title is required.");
  if (title.length > 80) throw new Error("Title must be 80 characters or fewer.");
  if ((input.description?.length ?? 0) > 500) {
    throw new Error("Description must be 500 characters or fewer.");
  }
  if (input.isSingleDay) {
    if (!input.date) throw new Error("Date is required.");
  } else {
    if (!input.startDate || !input.endDate) {
      throw new Error("Start and end dates are required.");
    }
    const start = toDateOnly(input.startDate).toMillis();
    const end = toDateOnly(input.endDate).toMillis();
    if (end < start) throw new Error("End date must be on or after start date.");
    const spanDays = Math.round((end - start) / MS_PER_DAY) + 1;
    if (spanDays > 365) throw new Error("Event span cannot exceed 365 days.");
    const startYear = new Date(start).getFullYear();
    const endYear = new Date(end).getFullYear();
    if (endYear - startYear > 1) {
      throw new Error("Event cannot span more than 2 calendar years.");
    }
  }
}

// Years a (validated) event touches. 1 entry for single-day, 1–2 for ranges.
function yearsOf(input: EventInput): number[] {
  if (input.isSingleDay) {
    return [input.date!.getFullYear()];
  }
  const startYear = input.startDate!.getFullYear();
  const endYear = input.endDate!.getFullYear();
  return startYear === endYear ? [startYear] : [startYear, endYear];
}

// Years a stored Event touches. Mirror of yearsOf for the persisted shape.
export function eventYears(event: Event): number[] {
  if (event.isSingleDay) {
    if (!event.date) return [];
    return [event.date.toDate().getFullYear()];
  }
  if (!event.startDate || !event.endDate) return [];
  const startYear = event.startDate.toDate().getFullYear();
  const endYear = event.endDate.toDate().getFullYear();
  return startYear === endYear ? [startYear] : [startYear, endYear];
}

function yearDocRef(year: number) {
  return doc(getDb(), "events", String(year));
}

// §10 — concurrent writers use Firestore transactions on the events array
// to avoid lost updates. Each year doc is mutated independently; cross-year
// events are written to both year docs (the SAME event object), and
// useMonthEvents already dedupes by eventId.
async function mutateYear(
  year: number,
  mutate: (events: Event[]) => Event[],
): Promise<void> {
  const ref = yearDocRef(year);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists()
      ? ((snap.data() as YearEvents).events ?? [])
      : [];
    const next = mutate(existing);
    tx.set(ref, {
      year,
      events: next,
    });
  });
}

// Build the persisted Event payload from validated input. Timestamps for
// createdAt/updatedAt are passed in so create-vs-update can decide whether
// to preserve the original createdAt.
function buildEvent(
  eventId: string,
  input: CreateEventInput,
  createdAt: Timestamp,
  updatedAt: Timestamp,
): Event {
  return {
    eventId,
    creatorId: input.creatorId,
    creatorName: input.creatorName,
    creatorTeamId: input.creatorTeamId,
    title: input.title.trim(),
    description: input.description && input.description.length > 0
      ? input.description
      : null,
    type: input.type,
    isSingleDay: input.isSingleDay,
    date: input.isSingleDay ? toDateOnly(input.date!) : null,
    startDate: input.isSingleDay ? null : toDateOnly(input.startDate!),
    endDate: input.isSingleDay ? null : toDateOnly(input.endDate!),
    createdAt,
    updatedAt,
  };
}

export async function createEvent(input: CreateEventInput): Promise<string> {
  validateInput(input);
  // serverTimestamp() isn't allowed inside arrays — use Timestamp.now() for
  // the array entry. The data-retention sweep uses date fields, not these.
  const now = Timestamp.now();
  // doc(collection(...)) generates a locally-unique id without writing.
  const eventId = doc(collection(getDb(), "events")).id;
  const event = buildEvent(eventId, input, now, now);

  const years = yearsOf(input);
  for (const year of years) {
    await mutateYear(year, (events) => [...events, event]);
  }
  return eventId;
}

export async function updateEvent(
  eventId: string,
  patch: EventInput,
  existing: Event,
): Promise<void> {
  validateInput(patch);
  const updated: Event = buildEvent(
    eventId,
    {
      ...patch,
      creatorId: existing.creatorId,
      creatorName: existing.creatorName,
      creatorTeamId: existing.creatorTeamId,
    },
    existing.createdAt,
    Timestamp.now(),
  );

  const oldYears = new Set(eventYears(existing));
  const newYears = new Set(yearsOf(patch));

  // 1) Years the event left → remove.
  for (const year of oldYears) {
    if (newYears.has(year)) continue;
    await mutateYear(year, (events) =>
      events.filter((e) => e.eventId !== eventId),
    );
  }
  // 2) Years the event still touches → replace in place (or append).
  for (const year of newYears) {
    await mutateYear(year, (events) => {
      const filtered = events.filter((e) => e.eventId !== eventId);
      return [...filtered, updated];
    });
  }
}

export async function deleteEvent(event: Event): Promise<void> {
  const years = eventYears(event);
  for (const year of years) {
    await mutateYear(year, (events) =>
      events.filter((e) => e.eventId !== event.eventId),
    );
  }
}
