"use client";

import * as React from "react";

import type { Event } from "@/lib/types";
import { eventMatchesPill } from "@/components/calendar/StatPills";

// §7.3 — built-in views in v1.0. "cross-team" is deferred until Phase 9 can
// denormalize creatorTeamCount onto events (otherwise we'd need a workspace-
// wide users/* subscription just for one view).
export type ViewKind = "all" | "out" | "birthdays";

interface ViewFilterContextValue {
  activeView: ViewKind;
  setActiveView: (v: ViewKind) => void;
}

const ViewFilterContext = React.createContext<ViewFilterContextValue>({
  activeView: "all",
  setActiveView: () => {},
});

export function ViewFilterProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = React.useState<ViewKind>("all");
  return (
    <ViewFilterContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </ViewFilterContext.Provider>
  );
}

export function useViewFilter() {
  return React.useContext(ViewFilterContext);
}

// §7.3 — "Out today" and "Birthdays this week" share their predicate with the
// matching stat pill, so we delegate rather than reimplementing the regex.
export function eventMatchesView(
  event: Event,
  view: ViewKind,
  today: Date,
  weekRange: { start: Date; end: Date },
): boolean {
  switch (view) {
    case "all":
      return true;
    case "out":
      return eventMatchesPill(event, "out", today, weekRange);
    case "birthdays":
      return eventMatchesPill(event, "birthdays", today, weekRange);
  }
}
