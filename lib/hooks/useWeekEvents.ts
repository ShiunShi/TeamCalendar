"use client";

import * as React from "react";
import { startOfToday } from "date-fns";

import { subscribeTeamYear } from "@/lib/db/events";
import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
import { eventOverlapsDay, isoWeekRange } from "@/lib/calendar/grid";
import type { Event } from "@/lib/types";

// Mirror of useTodayEvents but scoped to the current ISO Mon-Sun week.
// Fans out across teams × the 1-2 years the week spans, dedupes by eventId,
// and returns events overlapping any day in the week.
export function useWeekEvents(): { events: Event[]; loading: boolean } {
  const today = React.useMemo(() => startOfToday(), []);
  const week = React.useMemo(() => isoWeekRange(today), [today]);

  const years = React.useMemo(() => {
    const s = week.start.getFullYear();
    const e = week.end.getFullYear();
    return s === e ? [s] : [s, e];
  }, [week]);

  const { teams } = useWorkspaceTeams();
  const teamIds = React.useMemo(
    () => teams.map((t) => t.teamId).sort(),
    [teams],
  );

  const subKey = `${teamIds.join(",")}::${years.join(",")}`;

  const [byKey, setByKey] = React.useState<Record<string, Event[]>>({});

  React.useEffect(() => {
    if (teamIds.length === 0 || years.length === 0) return;
    // byKey may retain entries from removed teams; the read memos below
    // only iterate the current teamIds × years, so stale entries are ignored.
    const unsubs: Array<() => void> = [];
    for (const teamId of teamIds) {
      for (const year of years) {
        const key = `${teamId}|${year}`;
        unsubs.push(
          subscribeTeamYear(teamId, year, (events) => {
            setByKey((prev) => ({ ...prev, [key]: events }));
          }),
        );
      }
    }
    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subKey]);

  const events = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Event[] = [];
    for (const teamId of teamIds) {
      for (const year of years) {
        const key = `${teamId}|${year}`;
        for (const e of byKey[key] ?? []) {
          if (seen.has(e.eventId)) continue;
          if (!eventOverlapsAnyDayInWeek(e, week.start, week.end)) continue;
          seen.add(e.eventId);
          out.push(e);
        }
      }
    }
    return out;
  }, [byKey, teamIds, years, week]);

  const loading =
    teamIds.length > 0 &&
    teamIds.some((tid) => years.some((y) => !(`${tid}|${y}` in byKey)));

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
