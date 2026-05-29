"use client";

import * as React from "react";
import { startOfToday } from "date-fns";

import { subscribeTeamYear } from "@/lib/db/events";
import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
import { eventOverlapsDay } from "@/lib/calendar/grid";
import type { Event } from "@/lib/types";

// §6.6 — derives the sidebar member-status badge by surfacing events that
// overlap today. Subscribes to the current year doc of every visible team
// and dedupes by eventId. Multi-day events crossing the Dec/Jan boundary
// are visible from whichever year doc they were written to (createEvent
// writes to both year docs in that case).
export function useTodayEvents(): { events: Event[]; loading: boolean } {
  const today = React.useMemo(() => startOfToday(), []);
  const year = today.getFullYear();
  const { teams } = useWorkspaceTeams();
  const teamIds = React.useMemo(
    () => teams.map((t) => t.teamId).sort(),
    [teams],
  );

  const subKey = `${teamIds.join(",")}::${year}`;

  const [byTeam, setByTeam] = React.useState<Record<string, Event[]>>({});

  React.useEffect(() => {
    if (teamIds.length === 0) return;
    // byTeam may retain entries from removed teams; the read memos below
    // only iterate the current teamIds, so stale entries are ignored.
    const unsubs = teamIds.map((teamId) =>
      subscribeTeamYear(teamId, year, (events) => {
        setByTeam((prev) => ({ ...prev, [teamId]: events }));
      }),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subKey]);

  const events = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Event[] = [];
    for (const teamId of teamIds) {
      for (const e of byTeam[teamId] ?? []) {
        if (seen.has(e.eventId)) continue;
        if (!eventOverlapsDay(e, today)) continue;
        seen.add(e.eventId);
        out.push(e);
      }
    }
    return out;
  }, [byTeam, teamIds, today]);

  const loading =
    teamIds.length > 0 && teamIds.some((tid) => !(tid in byTeam));

  return { events, loading };
}
