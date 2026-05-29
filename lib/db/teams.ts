import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import type {
  EmbeddedTeam,
  Member,
  Team,
  TeamColorHex,
  UserDoc,
} from "@/lib/types";

// Create a team. The caller becomes the owner and sole initial member.
// Batch writes: teams/{id}, teamMembers/{id}, users/{creator}.teams[] + primaryTeamId.
// Embedded array entries use Timestamp.now() because serverTimestamp() is not
// permitted inside arrayUnion payloads.
export async function createTeam(
  creator: UserDoc,
  input: { name: string; color: TeamColorHex },
): Promise<string> {
  const db = getDb();
  const teamRef = doc(collection(db, "team"));
  const teamId = teamRef.id;
  const now = Timestamp.now();

  const team: Omit<Team, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    teamId,
    name: input.name,
    color: input.color,
    ownerId: creator.uid,
    memberCount: 1,
    createdAt: serverTimestamp(),
  };

  const member: Member = {
    userId: creator.uid,
    name: creator.name,
    email: creator.email,
    photoURL: creator.photoURL,
    role: "owner",
    joinedAt: now,
  };

  const embedded: EmbeddedTeam = {
    teamId,
    teamName: input.name,
    teamColor: input.color,
    role: "owner",
    joinedAt: now,
  };

  const batch = writeBatch(db);
  batch.set(teamRef, team);
  batch.set(doc(db, "teamMembers", teamId), {
    teamId,
    members: [member],
  });
  batch.update(doc(db, "users", creator.uid), {
    teams: arrayUnion(embedded),
    ...(creator.primaryTeamId == null ? { primaryTeamId: teamId } : {}),
  });

  await batch.commit();
  return teamId;
}

// Cascade rename / recolor per §10: mutate teams/{id} AND every affected
// users/{uid}.teams[] entry. arrayRemove + arrayUnion is the only way to
// modify an embedded object without reading the full users doc, but it
// requires the EXACT existing entry (including its joinedAt timestamp).
// So we read each member's user doc to find their embedded entry, then
// remove-and-readd in one batch.
async function cascadeTeamPatch(
  teamId: string,
  patch: Partial<Pick<Team, "name" | "color">>,
): Promise<void> {
  const db = getDb();
  const teamSnap = await getDoc(doc(db, "team", teamId));
  if (!teamSnap.exists()) throw new Error(`Team ${teamId} not found`);

  const membersSnap = await getDoc(doc(db, "teamMembers", teamId));
  if (!membersSnap.exists()) throw new Error(`teamMembers/${teamId} not found`);
  const members = (membersSnap.data().members as Member[]) ?? [];

  // Read every member's user doc so we know their EmbeddedTeam entry exactly.
  const userSnaps = await Promise.all(
    members.map((m) => getDoc(doc(db, "users", m.userId))),
  );

  const batch = writeBatch(db);
  batch.update(doc(db, "team", teamId), patch);

  userSnaps.forEach((snap, i) => {
    if (!snap.exists()) return;
    const data = snap.data() as UserDoc;
    const oldEmbedded = data.teams.find((t) => t.teamId === teamId);
    if (!oldEmbedded) return;
    const newEmbedded: EmbeddedTeam = {
      ...oldEmbedded,
      ...(patch.name != null ? { teamName: patch.name } : {}),
      ...(patch.color != null ? { teamColor: patch.color } : {}),
    };
    batch.update(doc(db, "users", members[i].userId), {
      teams: arrayRemove(oldEmbedded),
    });
    batch.update(doc(db, "users", members[i].userId), {
      teams: arrayUnion(newEmbedded),
    });
  });

  await batch.commit();
}

export const renameTeam = (teamId: string, name: string) =>
  cascadeTeamPatch(teamId, { name });

export const recolorTeam = (teamId: string, color: TeamColorHex) =>
  cascadeTeamPatch(teamId, { color });

// Cascade delete: remove the team, its roster, every member's embedded entry,
// and every invite token issued for this team. Members keep their existing
// events even if creatorTeamId points here — spec §10 snapshot rule.
export async function deleteTeam(teamId: string): Promise<void> {
  const db = getDb();
  const membersSnap = await getDoc(doc(db, "teamMembers", teamId));
  const members = membersSnap.exists()
    ? ((membersSnap.data().members as Member[]) ?? [])
    : [];

  const userSnaps = await Promise.all(
    members.map((m) => getDoc(doc(db, "users", m.userId))),
  );

  const inviteSnap = await getDocs(
    query(collection(db, "invites"), where("teamId", "==", teamId)),
  );

  const batch = writeBatch(db);
  batch.delete(doc(db, "team", teamId));
  batch.delete(doc(db, "teamMembers", teamId));
  inviteSnap.forEach((d) => batch.delete(d.ref));

  userSnaps.forEach((snap, i) => {
    if (!snap.exists()) return;
    const data = snap.data() as UserDoc;
    const oldEmbedded = data.teams.find((t) => t.teamId === teamId);
    if (!oldEmbedded) return;
    const update: Record<string, unknown> = {
      teams: arrayRemove(oldEmbedded),
    };
    if (data.primaryTeamId === teamId) update.primaryTeamId = null;
    batch.update(doc(db, "users", members[i].userId), update);
  });

  await batch.commit();
}
