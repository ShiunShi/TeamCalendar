"use client";

import * as React from "react";

// §7.4 — single-select active team. `null` means "All" (no team filter).
// Driven by the sidebar TEAMS section (which dims unselected teams) — the
// sidebar is the only surface that writes this; the calendar reads it to
// narrow `baseEvents`. Mirrors the ViewFilterProvider pattern in
// lib/calendar/viewFilter.tsx.
interface TeamSelectionContextValue {
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string | null) => void;
}

const TeamSelectionContext = React.createContext<TeamSelectionContextValue>({
  selectedTeamId: null,
  setSelectedTeamId: () => {},
});

export function TeamSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(
    null,
  );
  return (
    <TeamSelectionContext.Provider value={{ selectedTeamId, setSelectedTeamId }}>
      {children}
    </TeamSelectionContext.Provider>
  );
}

export function useTeamSelection() {
  return React.useContext(TeamSelectionContext);
}
