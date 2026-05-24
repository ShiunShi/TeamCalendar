import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import { INVITE_TTL_MS, type Invite } from "@/lib/types";

// Generate a tokenized invite for a team. Owner-only — UI gates this and
// the firestore rule requires request.auth.uid == teams/{teamId}.ownerId.
// Tokens are crypto.randomUUID() which yields 128 bits of entropy — safe
// to share via copy-paste link, but anyone with the link can join.
export async function createInvite(
  teamId: string,
  ownerId: string,
): Promise<string> {
  const token = crypto.randomUUID();
  // expiresAt uses client wall-clock because serverTimestamp() is a sentinel
  // and can't be summed with a duration. The Firestore TTL policy on
  // invites.expiresAt purges the doc within ~24h of expiry; the /join page
  // also rejects expired invites client-side so users see an immediate error.
  await setDoc(doc(getDb(), "invites", token), {
    token,
    teamId,
    ownerId,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
  });
  return token;
}

export async function getInvite(token: string): Promise<Invite | null> {
  const snap = await getDoc(doc(getDb(), "invites", token));
  if (!snap.exists()) return null;
  return snap.data() as Invite;
}

// Pre-feature invites lack expiresAt entirely — treat them as expired so
// they can no longer be redeemed (operator manually deletes them, since
// the TTL policy can't auto-purge docs that don't have the field).
export function isInviteExpired(invite: Invite): boolean {
  if (!invite.expiresAt) return true;
  return invite.expiresAt.toMillis() <= Date.now();
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
