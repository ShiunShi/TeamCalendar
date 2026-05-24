"use client";

import * as React from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { getDb, WORKSPACE_ID } from "@/lib/firebase/client";
import type { Team } from "@/lib/types";

// Live list of all teams in the workspace, sorted by name. Drives the
// sidebar's TEAMS section. Spec §8.7 notes this can be cached client-side;
// in v1.0 we just resubscribe per shell mount — small N keeps it cheap.
export function useWorkspaceTeams(): { teams: Team[]; loading: boolean } {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    return onSnapshot(
      query(collection(getDb(), "teams"), where("workspaceId", "==", WORKSPACE_ID)),
      (snap) => {
        const next = snap.docs.map((d) => d.data() as Team);
        next.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(next);
        setLoading(false);
      },
    );
  }, []);

  return { teams, loading };
}
