"use client";

import * as React from "react";

import type { Event } from "@/lib/types";
import { eventOverlapsDay, isoWeekRange } from "@/lib/calendar/grid";
import { cn } from "@/lib/utils";

// §6.5 — three derived pills. The matching predicates are exported so
// CalendarView can apply the same logic when a pill is toggled to filter
// the grid.
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

export function StatPills({
  events,
  today,
  active,
  onToggle,
}: {
  events: Event[];
  today: Date;
  active: PillKind | null;
  onToggle: (kind: PillKind) => void;
}) {
  const week = React.useMemo(() => isoWeekRange(today), [today]);

  const counts = React.useMemo(() => {
    const outCreators = new Set<string>();
    let birthdayCount = 0;

    for (const e of events) {
      if (eventMatchesPill(e, "out", today, week)) outCreators.add(e.creatorId);
      if (eventMatchesPill(e, "birthdays", today, week)) birthdayCount += 1;
    }

    return {
      out: outCreators.size,
      birthdays: birthdayCount,
    };
  }, [events, today, week]);

  return (
    <div className="flex items-center gap-2">
      <Pill
        count={counts.out}
        label="out today"
        active={active === "out"}
        onClick={() => onToggle("out")}
      />
      <Pill
        count={counts.birthdays}
        label="birthdays this week"
        active={active === "birthdays"}
        onClick={() => onToggle("birthdays")}
      />
    </div>
  );
}

function Pill({
  count,
  label,
  active,
  onClick,
}: {
  count: number;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${count} ${label}`}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-input bg-card text-foreground hover:bg-muted",
      )}
    >
      <span className="font-mono font-semibold text-primary tabular">{count}</span>
      <span className="text-muted-foreground">{label}</span>
    </button>
  );
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
