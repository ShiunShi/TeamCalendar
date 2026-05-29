import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  increment,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import type { EmbeddedTeam, Member, Team, UserDoc } from "@/lib/types";

// Used by /join/[token] — the joining user writes themselves in.
// Both writes (teamMembers + own user doc) are self-actions, so isSelf rules
// hold for users/{uid} and the relaxed teamMembers update rule covers the
// roster mutation.
export async function addMemberSelf(
  teamId: string,
  self: UserDoc,
): Promise<void> {
  const db = getDb();
  const teamSnap = await getDoc(doc(db, "team", teamId));
  if (!teamSnap.exists()) throw new Error(`Team ${teamId} not found`);
  const team = teamSnap.data() as Team;

  // Idempotent: if already a member, no-op.
  if (self.teams.some((t) => t.teamId === teamId)) return;

  const now = Timestamp.now();
  const member: Member = {
    userId: self.uid,
    name: self.name,
    email: self.email,
    photoURL: self.photoURL,
    role: "member",
    joinedAt: now,
  };
  const embedded: EmbeddedTeam = {
    teamId,
    teamName: team.name,
    teamColor: team.color,
    role: "member",
    joinedAt: now,
  };

  const batch = writeBatch(db);
  batch.update(doc(db, "teamMembers", teamId), {
    members: arrayUnion(member),
  });
  batch.update(doc(db, "team", teamId), {
    memberCount: increment(1),
  });
  batch.update(doc(db, "users", self.uid), {
    teams: arrayUnion(embedded),
    ...(self.primaryTeamId == null ? { primaryTeamId: teamId } : {}),
  });
  await batch.commit();
}

// Owner-only — UI gates this. Removes the member from teamMembers and
// from their own users/{uid}.teams[]. If the removed member's primaryTeamId
// was this team, clears it.
export async function removeMember(
  teamId: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  const membersSnap = await getDoc(doc(db, "teamMembers", teamId));
  if (!membersSnap.exists()) throw new Error(`teamMembers/${teamId} not found`);
  const members = (membersSnap.data().members as Member[]) ?? [];
  const target = members.find((m) => m.userId === userId);
  if (!target) return; // already removed

  const userSnap = await getDoc(doc(db, "users", userId));
  const embedded =
    userSnap.exists()
      ? (userSnap.data() as UserDoc).teams.find((t) => t.teamId === teamId)
      : null;

  const batch = writeBatch(db);
  batch.update(doc(db, "teamMembers", teamId), {
    members: arrayRemove(target),
  });
  batch.update(doc(db, "team", teamId), {
    memberCount: increment(-1),
  });
  if (embedded) {
    const update: Record<string, unknown> = { teams: arrayRemove(embedded) };
    if ((userSnap.data() as UserDoc).primaryTeamId === teamId) {
      update.primaryTeamId = null;
    }
    batch.update(doc(db, "users", userId), update);
  }
  await batch.commit();
}
