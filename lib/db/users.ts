import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";

// Idempotent first-touch create of users/{uid}. Subsequent sign-ins are no-ops
// so we don't trample mutable profile fields (name/photoURL/primaryTeamId/teams).
// Profile sync on later sign-ins is the responsibility of Phase 10 / §10 rules.
export async function ensureUserDoc(authUser: User): Promise<void> {
  const ref = doc(getDb(), "users", authUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    uid: authUser.uid,
    name:
      authUser.displayName ??
      authUser.email?.split("@")[0] ??
      "New member",
    email: authUser.email ?? "",
    photoURL: authUser.photoURL ?? "",
    primaryTeamId: null,
    teams: [],
    createdAt: serverTimestamp(),
  });
}
