import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import type { Invite } from "@/lib/types";

// Generate a tokenized invite for a team. Owner-only — UI gates this and
// the firestore rule requires request.auth.uid == teams/{teamId}.ownerId.
// Tokens are crypto.randomUUID() which yields 128 bits of entropy — safe
// to share via copy-paste link, but anyone with the link can join.
export async function createInvite(
  teamId: string,
  ownerId: string,
): Promise<string> {
  const token = crypto.randomUUID();
  await setDoc(doc(getDb(), "invites", token), {
    token,
    teamId,
    ownerId,
    createdAt: serverTimestamp(),
  });
  return token;
}

export async function getInvite(token: string): Promise<Invite | null> {
  const snap = await getDoc(doc(getDb(), "invites", token));
  if (!snap.exists()) return null;
  return snap.data() as Invite;
}

export async function revokeInvite(token: string): Promise<void> {
  await deleteDoc(doc(getDb(), "invites", token));
}

// Used by deleteTeam cascade.
export async function revokeAllInvitesForTeam(teamId: string): Promise<void> {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, "invites"), where("teamId", "==", teamId)),
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
