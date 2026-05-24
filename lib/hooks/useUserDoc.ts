"use client";

import * as React from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import type { UserDoc } from "@/lib/types";

// Live subscription to users/{uid}. Returns null while loading or if the
// caller has no uid. The Sidebar leans on this to know which teams the
// current user belongs to and whether they're owner of each.
export function useUserDoc(uid: string | null): UserDoc | null {
  const [data, setData] = React.useState<UserDoc | null>(null);

  React.useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(getDb(), "users", uid), (snap) => {
      setData(snap.exists() ? (snap.data() as UserDoc) : null);
    });
  }, [uid]);

  return data;
}
