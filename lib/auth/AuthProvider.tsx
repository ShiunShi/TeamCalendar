"use client";

import * as React from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { getAuthClient, getDb } from "@/lib/firebase/client";
import { ensureUserDoc } from "@/lib/db/users";
import { ensureDefaultWorkspace } from "@/lib/db/workspace";
import type { UserDoc } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  userDoc: UserDoc | null;
  loading: boolean;
};

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  userDoc: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [userDoc, setUserDoc] = React.useState<UserDoc | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Subscribe to auth state and bootstrap user + workspace docs on first sign-in.
  React.useEffect(() => {
    return onAuthStateChanged(getAuthClient(), async (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setUserDoc(null);
        return;
      }
      try {
        await ensureUserDoc(u);
        await ensureDefaultWorkspace();
      } catch (err) {
        // Bootstrap is best-effort. Log so misconfig (e.g. blocked rules)
        // is visible without breaking the auth flow.
        console.error("Bootstrap failed:", err);
      }
    });
  }, []);

  // Live subscription to the user's Firestore doc — provides teams[] and
  // primaryTeamId to the rest of the app via context.
  React.useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(getDb(), "users", user.uid), (snap) => {
      setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null);
    });
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, userDoc, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useUser() {
  return React.useContext(AuthContext);
}
