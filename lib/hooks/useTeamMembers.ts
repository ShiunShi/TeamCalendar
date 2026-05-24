"use client";

import * as React from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import type { Member } from "@/lib/types";

// Live members for a single team. Sorted by name so the sidebar order
// stays stable as people are added/removed.
export function useTeamMembers(teamId: string | null): Member[] {
  const [members, setMembers] = React.useState<Member[]>([]);

  React.useEffect(() => {
    if (!teamId) return;
    return onSnapshot(doc(getDb(), "teamMembers", teamId), (snap) => {
      if (!snap.exists()) {
        setMembers([]);
        return;
      }
      const next = (snap.data().members as Member[]) ?? [];
      next.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(next);
    });
  }, [teamId]);

  return members;
}
