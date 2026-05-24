"use client";

import * as React from "react";
import { collection, onSnapshot } from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import type { Team } from "@/lib/types";

// Live list of all teams, sorted by name. Drives the sidebar's TEAMS section.
// Spec §8.7 notes this can be cached client-side; in v1.0 we just resubscribe
// per shell mount — small N keeps it cheap.
export function useWorkspaceTeams(): { teams: Team[]; loading: boolean } {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    return onSnapshot(collection(getDb(), "teams"), (snap) => {
      const next = snap.docs.map((d) => d.data() as Team);
      next.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(next);
      setLoading(false);
    });
  }, []);

  return { teams, loading };
}
