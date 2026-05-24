import type { Timestamp } from "firebase/firestore";

// ───────────────────────────────────────────────────────────────
// §13.3 — Team color palette. Owners pick from these eight.
// The Tailwind utility name (`team-blue`) maps to the CSS var
// `--color-team-blue` declared in app/globals.css.
// ───────────────────────────────────────────────────────────────
export const TEAM_COLORS = [
  { name: "Blue",   hex: "#3B82F6", token: "team-blue" },
  { name: "Purple", hex: "#A855F7", token: "team-purple" },
  { name: "Green",  hex: "#22C55E", token: "team-green" },
  { name: "Red",    hex: "#EF4444", token: "team-red" },
  { name: "Orange", hex: "#F97316", token: "team-orange" },
  { name: "Pink",   hex: "#EC4899", token: "team-pink" },
  { name: "Teal",   hex: "#14B8A6", token: "team-teal" },
  { name: "Amber",  hex: "#F59E0B", token: "team-amber" },
] as const;
export type TeamColorHex = (typeof TEAM_COLORS)[number]["hex"];

// ───────────────────────────────────────────────────────────────
// §6.2 — Event types. Drives chip body color (§13.8).
// ───────────────────────────────────────────────────────────────
export const EVENT_TYPES = [
  "Personal",
  "Birthday",
  "Holiday",
  "Travel",
  "Other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// ───────────────────────────────────────────────────────────────
// Firestore models — match spec §8.
// ───────────────────────────────────────────────────────────────

export type Role = "owner" | "member";

// §8.3
export interface Team {
  teamId: string;
  workspaceId: string;
  name: string;
  color: TeamColorHex;
  ownerId: string;
  memberCount: number;
  createdAt: Timestamp;
}

// §8.4 — one entry in teamMembers/{teamId}.members[]
export interface Member {
  userId: string;
  name: string;
  email: string;
  photoURL: string;
  role: Role;
  joinedAt: Timestamp;
}

// §8.2 — slim form embedded in users/{uid}.teams[]
export interface EmbeddedTeam {
  teamId: string;
  teamName: string;
  teamColor: TeamColorHex;
  role: Role;
  joinedAt: Timestamp;
}

// §8.2 — users/{uid}
export interface UserDoc {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  primaryTeamId: string | null;
  createdAt: Timestamp;
  teams: EmbeddedTeam[];
}

// invites/{token} — Phase 3 invite-link onboarding.
// Not in v1.1 spec §8 explicitly; introduced under the resolved invite-link decision.
export interface Invite {
  token: string;
  teamId: string;
  ownerId: string;
  createdAt: Timestamp;
}

// §6.1 — one entry in workspaceEvents/{wid}_{year}.events[]
export interface Event {
  eventId: string;
  creatorId: string;
  creatorName: string;
  creatorTeamId: string;
  title: string;
  description: string | null;
  type: EventType;
  isSingleDay: boolean;
  date: Timestamp | null;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// §8.5 — workspaceEvents/{wid}_{year}
export interface WorkspaceEvents {
  workspaceId: string;
  year: number;
  events: Event[];
}
