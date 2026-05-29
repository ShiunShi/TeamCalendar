"use client";

import * as React from "react";

import { subscribeTeamYear } from "@/lib/db/events";
import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
import { gridYears } from "@/lib/calendar/grid";
import type { Event } from "@/lib/types";

// Subscribes to the team-year docs for every visible team and every year the
// 42-cell month grid spans (1 or 2 per §8.7). Fans out across
// teams × years, dedupes by eventId. Loading is true until each (teamId,
// year) tuple has reported at least once (an empty list still counts).
export function useMonthEvents(focusedMonth: Date): {
  events: Event[];
  loading: boolean;
} {
  const { teams } = useWorkspaceTeams();

  // Sort teamIds so a stable order survives reorder churn in the
  // workspace-teams snapshot.
  const teamIds = React.useMemo(
    () => teams.map((t) => t.teamId).sort(),
    [teams],
  );
  const years = React.useMemo(() => gridYears(focusedMonth), [focusedMonth]);

  // Composite key — effect only resubscribes when the actual set of
  // (team, year) tuples changes.
  const subKey = `${teamIds.join(",")}::${years.join(",")}`;

  const [byKey, setByKey] = React.useState<Record<string, Event[]>>({});

  React.useEffect(() => {
    if (teamIds.length === 0 || years.length === 0) return;
    // byKey may retain entries from removed teams; the read memos below
    // only iterate the current teamIds × years, so stale entries are
    // ignored rather than reset (avoids a synchronous setState in effect).
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
          seen.add(e.eventId);
          out.push(e);
        }
      }
    }
    return out;
  }, [byKey, teamIds, years]);

  const loading =
    teamIds.length > 0 &&
    teamIds.some((tid) => years.some((y) => !(`${tid}|${y}` in byKey)));

  return { events, loading };
}
