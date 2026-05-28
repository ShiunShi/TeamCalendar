# Per-Team Event Subcollections — Design

**Date:** 2026-05-28
**Status:** Approved (pending spec review)

## Context

Today every team's events live in a single global `events/{year}` document — one array
holding the workspace's entire calendar for that year. The data model does not match
the conceptual model ("events belong to a team"), and any team member can rewrite the
whole array because rules cannot diff array writes (residual risk #1 in
`firestore.rules`).

This change relocates events into per-team subcollections so the storage shape mirrors
ownership: `team/{teamId}/teamEvents/{year}`. The top-level `teams` collection is
renamed to `team` to match the singular path. No behavior changes for the user; this
is pure schema work.

The downstream follow-up — making imported holidays belong to a team (the original
trigger for this work) — gets its own spec once this lands. See
`2026-05-26-import-taiwan-holidays-design.md` for the SYSTEM-attribution shape it
replaces.

## Trade-off accepted upfront

The calendar is public (spec §11): every authed user sees events from every team in
the workspace. Today that means 1–2 listeners per calendar render — one per visible
year doc. Under the new schema each hook fans out to **N teams × visible years**
listeners. A workspace with 10 visible teams pays roughly 10× the document-read cost
on calendar load.

The user has accepted this in exchange for physical per-team isolation. "Reduce
Firestore cost" was the stated motivation; in practice this *increases* read cost
and only saves snapshot-bandwidth on writes. We're proceeding because clean per-team
boundaries are the right shape going forward, not because it lowers the bill.

## New Schema

```
team/{teamId}                    # was teams/{teamId}; inline metadata unchanged
  teamEvents/{year}              # was events/{year}; one doc per team per year
    { year: number, events: Event[] }

teamMembers/{teamId}             # unchanged (top-level)
users/{uid}                      # unchanged
invites/{token}                  # unchanged
```

- `Team` and `Event` TypeScript interfaces are unchanged.
- `users.teams[]` field name is unchanged — it's an embedded summary array, not a
  collection reference.
- `teamMembers` stays at the top level (not nested under `team`). This matches the
  chosen target shape; nesting it would expand scope and complicate cascade writes.
- `invites` stays at the top level.

## Data Migration

**None.** Dev-only data; wipe and recreate. Manual checklist before this code is
deployed:

1. Firebase Console → Firestore → delete the `events` collection.
2. Delete the `teams` collection.
3. Delete the `teamMembers` collection.
4. Either delete `users` entirely (forcing fresh sign-in) or open each user doc and
   clear its `teams[]` array so it doesn't reference dead teamIds.

No migration script. No backward-compatibility code path. The new code reads/writes
only the new paths.

## `lib/db/events.ts`

Path helpers:

```ts
function teamEventsRef(teamId: string, year: number) {
  return doc(getDb(), "team", teamId, "teamEvents", String(year));
}
```

Helper renames:

- `mutateYear(year, fn)` → `mutateTeamYear(teamId, year, fn)`.
- `subscribeYear(year, cb)` → `subscribeTeamYear(teamId, year, cb)`.

Write helpers — each derives the team from existing creator data on the event:

- `createEvent(input)` writes to `team/{input.creatorTeamId}/teamEvents/{year}` for
  each year the event touches. No signature change.
- `updateEvent(eventId, patch, existing)` uses `existing.creatorTeamId` for the
  path. Cross-team event moves are not supported (not a feature today; the existing
  helper has no concept of changing `creatorTeamId`).
- `deleteEvent(event)` uses `event.creatorTeamId`.
- `createHolidayEventsBulk(year, holidays, creator)` uses `creator.creatorTeamId`.
  Dedupe logic inside `mutateTeamYear` is unchanged. The retry-reset block at the
  top of the transaction callback stays.

The cross-year write path inside `createEvent` and `updateEvent` is otherwise
unchanged — multi-year events still write to both year docs of the same team.

## Hooks — fan-out across teams

Each calendar hook today opens 1–2 listeners on global year docs. Under the new
schema each opens **teams × years** listeners, keyed by `${teamId}|${year}`, and
merges results by `eventId`.

### `useMonthEvents(focusedMonth)`

```ts
const { teams } = useWorkspaceTeams();
const years = gridYears(focusedMonth);

// Stable composite key so we only resubscribe when the (team, year) set changes.
const subKey = teams.map(t => t.teamId).sort().join(",") + "::" + years.join(",");

// Effect keyed on subKey:
//   for each team × year, open a subscribeTeamYear listener
//   merge results into Record<`${teamId}|${year}`, Event[]>

// Loading: every (teamId, year) tuple must have reported at least once
// (an empty list still counts).
```

Dedupe by `eventId` happens at read time — same as today's multi-year merge.

### `useTodayEvents()`

Same shape, current year only. Subscribes to one listener per visible team.

### `useWeekEvents()`

Same shape, week's years (1 or 2). Subscribes to teams × week-years.

### Loading rules

A hook is loading until **every** (teamId, year) tuple has reported. Hooks must
tolerate `teams` changing mid-render: when a team is added or removed, the subKey
changes and listeners are torn down / re-opened. Each tuple's `[]` (missing year
doc) is a valid "reported" state.

## Collection rename `teams` → `team`

Pure rename, no logic change. Sites:

- `lib/db/teams.ts` — 4 occurrences (`collection`, `doc` calls).
- `lib/db/teamMembers.ts` — 3 occurrences in `addMemberSelf` and `removeMember`.
- `lib/hooks/useWorkspaceTeams.ts` — 1 occurrence (the `onSnapshot(collection(...))`).
- `app/join/[token]/page.tsx` — 1 occurrence (the `getDoc(doc(..., "teams", id))`).

Doc comments referencing `teams/{teamId}` (e.g. `lib/db/invites.ts:19`) updated to
`team/{teamId}` in the same patch.

## `firestore.rules`

Path matchers renamed and `teamEvents` nested under `team`:

```
match /team/{teamId} {
  allow read:   if isAuth();
  allow create: if isAuth() && request.resource.data.ownerId == request.auth.uid;
  allow update, delete: if isTeamOwner(teamId);

  match /teamEvents/{year} {
    allow read: if isAuth();
    allow create, update, delete: if isAuth()
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.teams.size() > 0;
  }
}
```

- `isTeamOwner(teamId)` updated to read `/databases/$(database)/documents/team/$(teamId)`
  instead of `/teams/`.
- The blunt write gate on events (writer claims membership in ≥1 team) is preserved.
  Tightening this to actual `isTeamMember(teamId)` is still blocked by residual
  risk #2 (rules cannot extract `userId` from a list of maps) and remains Phase 9
  work.
- Residual risks #1–#3 at the top of `firestore.rules` are partially mitigated by
  the per-team path (a bad write can corrupt at most one team's year) but not
  eliminated. Update the header comments to reflect the new path shape and which
  risks are now narrower.
- Matchers for `users/{uid}`, `teamMembers/{teamId}`, `invites/{token}`, and the
  default-deny tail are unchanged.

## Files Touched

| File | Change |
|------|--------|
| `lib/db/events.ts` | Path helpers, `mutateTeamYear`, `subscribeTeamYear`, all CRUD helpers rebased on team-scoped paths |
| `lib/db/teams.ts` | `"teams"` → `"team"` (4 sites) |
| `lib/db/teamMembers.ts` | `"teams"` → `"team"` (3 sites) |
| `lib/hooks/useWorkspaceTeams.ts` | `"teams"` → `"team"` |
| `lib/hooks/useMonthEvents.ts` | Fan-out across teams × years |
| `lib/hooks/useTodayEvents.ts` | Fan-out across teams (current year) |
| `lib/hooks/useWeekEvents.ts` | Fan-out across teams × week-years |
| `app/join/[token]/page.tsx` | `"teams"` → `"team"` |
| `firestore.rules` | Path matchers; nested `teamEvents`; header comments |
| `lib/db/invites.ts` | Doc-comment fix only (`teams/{id}.ownerId` → `team/{id}.ownerId`) |
| `docs/superpowers/specs/2026-05-26-import-taiwan-holidays-design.md` | Append a top note: paths/SYSTEM-attribution superseded once schema rebases and the holiday-attribution follow-up lands |

**Not touched:**
- `lib/types.ts` — `Team`, `Event`, `EmbeddedTeam`, `UserDoc`, `YearEvents` shapes
  unchanged.
- `lib/db/users.ts`, `lib/auth/AuthProvider.tsx` — no team/event path references.
- Any UI component — all reads go through hooks.
- Retention sweep Cloud Function — out of scope; flagged below.

## Out of Scope (deferred)

- **Holiday-belongs-to-team behavior change.** The original trigger for this work
  becomes a small follow-up spec once the schema is rebased: add a team picker to
  `ImportHolidaysDialog`, drop the `SYSTEM` creator constants, remove the
  `type === "Holiday"` filter exemption in `CalendarView.tsx`. Existing
  SYSTEM-attributed holidays (if any survived the dev wipe) will not be migrated.
- **Retention sweep Cloud Function.** Currently iterates `events/*`; will need to
  walk `team/*/teamEvents/*` instead. Tracked as a separate Cloud Functions task
  before that sweep runs against the new shape.
- **Tightening event-write rules** to actual roster membership. Blocked by
  residual risk #2; awaits Phase 9 callable-function rewrite.

## Verification

No test harness in the repo. Verification is typecheck + lint + manual.

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.

Manual smoke (run after the dev Firestore wipe):

1. Fresh sign-in → land on empty calendar. No console errors.
2. Create team A → confirm `team/{idA}` doc exists in Firestore Console with
   inline metadata fields (name, color, ownerId, memberCount, createdAt).
3. Create an event under team A → confirm `team/{idA}/teamEvents/2026` exists
   with the event in its `events[]`.
4. Create team B and an event in it → confirm `team/{idB}/teamEvents/2026` is a
   separate doc and contains only B's event.
5. Sidebar filter to A → only A's events render. Switch to B → only B's. "All
   teams" → both.
6. Edit an event → mutation lands in-place in the correct team's year doc.
7. Delete an event → removed from the correct team's year doc.
8. Cross-year event (Dec 30 2026 → Jan 2 2027) under team A → writes to both
   `team/{idA}/teamEvents/2026` and `team/{idA}/teamEvents/2027`; calendar shows
   it correctly when navigating across the boundary.
9. Cascade-rename team A → metadata updates and embedded `users.teams[]`
   cascades. The team's `teamEvents/*` subcollection is untouched.
10. Cascade-delete team B → `team/{idB}` and every `team/{idB}/teamEvents/*`
    doc are gone; `teamMembers/{idB}` is gone; embedded entries in users are
    removed.
11. Sidebar "Today" and "This week" pills (driven by `useTodayEvents` /
    `useWeekEvents`) show the correct events from every team.
12. Sign in as a second user, join team A via invite link → calendar opens
    listeners on team A's `teamEvents/*` and renders A's events.

Manual edge cases:

13. Workspace with 0 teams visible → hooks return `events: []`, `loading: false`
    immediately (no listeners opened).
14. Open the calendar in two browser tabs → write in tab 1 → tab 2's listener
    fires for that team only.
