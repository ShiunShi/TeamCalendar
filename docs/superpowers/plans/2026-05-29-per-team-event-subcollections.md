# Per-Team Event Subcollections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move events from a single global `events/{year}` doc into per-team `team/{teamId}/teamEvents/{year}` subcollections, and rename the `teams` collection to `team`. No user-facing behavior changes.

**Architecture:** Two-phase refactor. Phase 1 renames the top-level collection (`teams` → `team`) with no logic change — pure path rename across db helpers, hooks, the join page, and `firestore.rules`. Phase 2 relocates the event docs into a subcollection under each team and fans out the read hooks across `teams × years`. Verification is `npx tsc --noEmit` + `npm run lint` + manual smoke (no test harness exists in the repo per spec).

**Tech Stack:** Next.js App Router, Firebase Web SDK (client-side), Firestore security rules.

**Reference spec:** `docs/superpowers/specs/2026-05-28-per-team-event-subcollections-design.md`

---

## File Structure

All changes are modifications to existing files. No new source files. One new spec note appended.

| File | Responsibility | Touched in |
|------|----------------|------------|
| `lib/db/events.ts` | All event CRUD + subscriptions, rebased on team-scoped paths | Task 2 |
| `lib/db/teams.ts` | Team CRUD; collection name | Task 1 |
| `lib/db/teamMembers.ts` | Roster mutations; `team` collection refs | Task 1 |
| `lib/db/invites.ts` | Doc-comment fix only | Task 1 |
| `lib/hooks/useWorkspaceTeams.ts` | Subscribes to `team` collection | Task 1 |
| `lib/hooks/useMonthEvents.ts` | Fan-out across teams × visible years | Task 2 |
| `lib/hooks/useTodayEvents.ts` | Fan-out across teams (current year) | Task 2 |
| `lib/hooks/useWeekEvents.ts` | Fan-out across teams × week-years | Task 2 |
| `app/join/[token]/page.tsx` | Resolves team doc by token; collection rename | Task 1 |
| `firestore.rules` | Top-level matcher rename + nested `teamEvents` matcher | Task 1 + Task 2 |
| `docs/superpowers/specs/2026-05-26-import-taiwan-holidays-design.md` | Append "schema rebased" note | Task 3 |

---

## Prerequisite: Wipe dev Firestore

**Before starting Task 1**, clear dev data so the renamed collection doesn't fight stale `teams/*` and `events/*` docs:

- [ ] **Step 0.1: Open Firebase Console → Firestore for the dev project.**

- [ ] **Step 0.2: Delete the `events` collection** (all year docs).

- [ ] **Step 0.3: Delete the `teams` collection** (all team docs).

- [ ] **Step 0.4: Delete the `teamMembers` collection** (all roster docs).

- [ ] **Step 0.5: Delete the `users` collection** (or open each user doc and clear its `teams[]` array). Easiest: delete the whole collection and re-sign in.

- [ ] **Step 0.6: Optionally delete `invites/*`** (tokens reference team IDs that no longer exist).

Expected result: empty Firestore in the dev project.

---

## Task 1: Rename `teams` collection to `team`

**Files:**
- Modify: `lib/db/teams.ts` (4 sites)
- Modify: `lib/db/teamMembers.ts` (3 sites)
- Modify: `lib/db/invites.ts` (1 doc comment)
- Modify: `lib/hooks/useWorkspaceTeams.ts` (1 site)
- Modify: `app/join/[token]/page.tsx` (1 site)
- Modify: `firestore.rules` (the `isTeamOwner` helper + the `match /teams/{teamId}` block path only; `teamEvents` nested matcher added in Task 2)

- [ ] **Step 1.1: Update `lib/db/teams.ts`** — replace every `"teams"` literal with `"team"`. The sites are:
  - Line ~33: `const teamRef = doc(collection(db, "teams"));` → `... collection(db, "team") ...`
  - Line ~89: `getDoc(doc(db, "teams", teamId))` → `... "team", teamId ...`
  - Line ~102: `batch.update(doc(db, "teams", teamId), patch);` → `... "team", teamId ...`
  - Line ~150: `batch.delete(doc(db, "teams", teamId));` → `... "team", teamId ...`

  Use Edit with `replace_all: true` against the string `doc(db, "teams"` if convenient, but verify all replacements are intentional.

- [ ] **Step 1.2: Update `lib/db/teamMembers.ts`** — replace `"teams"` with `"team"`:
  - Line ~23: `getDoc(doc(db, "teams", teamId))` → `... "team", teamId ...`
  - Line ~51: `batch.update(doc(db, "teams", teamId), { memberCount: increment(1) });` → `... "team", teamId ...`
  - Line ~85: `batch.update(doc(db, "teams", teamId), { memberCount: increment(-1) });` → `... "team", teamId ...`

- [ ] **Step 1.3: Update `lib/db/invites.ts`** doc-comment on `createInvite` (around line 19):

  Old:
  ```ts
  // Generate a tokenized invite for a team. Owner-only — UI gates this and
  // the firestore rule requires request.auth.uid == teams/{teamId}.ownerId.
  ```

  New:
  ```ts
  // Generate a tokenized invite for a team. Owner-only — UI gates this and
  // the firestore rule requires request.auth.uid == team/{teamId}.ownerId.
  ```

- [ ] **Step 1.4: Update `lib/hooks/useWorkspaceTeams.ts`** (line 17):

  Old:
  ```ts
  return onSnapshot(collection(getDb(), "teams"), (snap) => {
  ```

  New:
  ```ts
  return onSnapshot(collection(getDb(), "team"), (snap) => {
  ```

- [ ] **Step 1.5: Update `app/join/[token]/page.tsx`** (line 68):

  Old:
  ```ts
  const teamSnap = await getDoc(doc(getDb(), "teams", invite.teamId));
  ```

  New:
  ```ts
  const teamSnap = await getDoc(doc(getDb(), "team", invite.teamId));
  ```

- [ ] **Step 1.6: Update `firestore.rules`** — rename the top-level matcher and the `isTeamOwner` helper. Do NOT add the `teamEvents` nested matcher yet (that lands in Task 2).

  Replace the `isTeamOwner` function body:

  Old:
  ```
  function isTeamOwner(teamId) {
    return isAuth()
      && exists(/databases/$(database)/documents/teams/$(teamId))
      && get(/databases/$(database)/documents/teams/$(teamId)).data.ownerId == request.auth.uid;
  }
  ```

  New:
  ```
  function isTeamOwner(teamId) {
    return isAuth()
      && exists(/databases/$(database)/documents/team/$(teamId))
      && get(/databases/$(database)/documents/team/$(teamId)).data.ownerId == request.auth.uid;
  }
  ```

  Replace the matcher header:

  Old:
  ```
  match /teams/{teamId} {
    allow read:   if isAuth();
    allow create: if isAuth()
                  && request.resource.data.ownerId == request.auth.uid;
    allow update, delete: if isTeamOwner(teamId);
  }
  ```

  New:
  ```
  match /team/{teamId} {
    allow read:   if isAuth();
    allow create: if isAuth()
                  && request.resource.data.ownerId == request.auth.uid;
    allow update, delete: if isTeamOwner(teamId);
  }
  ```

- [ ] **Step 1.7: Deploy updated rules to the dev Firebase project.** Either via `firebase deploy --only firestore:rules` (if firebase CLI is set up) or by pasting the new file into Firebase Console → Firestore → Rules. The app will not work otherwise — writes to `team/*` will be denied by the default-deny tail.

- [ ] **Step 1.8: Verify typecheck.**

  Run: `npx tsc --noEmit`
  Expected: clean (no errors).

- [ ] **Step 1.9: Verify lint.**

  Run: `npm run lint`
  Expected: clean.

- [ ] **Step 1.10: Manual smoke — collection rename works end to end.**

  Run: `npm run dev` → open `http://localhost:3000`.

  - Sign in fresh (Google SSO or email/password).
  - Create a team via the UI.
  - Open Firebase Console → confirm a doc exists at `team/{newId}` (and NOT at `teams/{newId}`).
  - Confirm the sidebar lists the new team.
  - Open the invite link flow (`/join/[token]`) for a second account → join succeeds.

- [ ] **Step 1.11: Commit.**

  ```bash
  git add lib/db/teams.ts lib/db/teamMembers.ts lib/db/invites.ts \
          lib/hooks/useWorkspaceTeams.ts app/join/[token]/page.tsx \
          firestore.rules
  git commit -m "Rename teams collection to team

  Pure path rename: teams/{teamId} -> team/{teamId} across db helpers,
  hooks, the join page, and firestore rules. No logic changes; events
  still live in the global events/{year} doc (relocated next)."
  ```

---

## Task 2: Relocate events to `team/{teamId}/teamEvents/{year}`

**Files:**
- Modify: `lib/db/events.ts` (full refactor of paths + rename helpers)
- Modify: `lib/hooks/useMonthEvents.ts` (fan-out across teams × years)
- Modify: `lib/hooks/useTodayEvents.ts` (fan-out across teams, current year)
- Modify: `lib/hooks/useWeekEvents.ts` (fan-out across teams × week-years)
- Modify: `firestore.rules` (add nested `teamEvents` matcher under `team`)

### Subtask 2.A — `lib/db/events.ts`

- [ ] **Step 2.A.1: Replace `yearDocRef` with `teamYearDocRef`.**

  Old (lines 109–111):
  ```ts
  function yearDocRef(year: number) {
    return doc(getDb(), "events", String(year));
  }
  ```

  New:
  ```ts
  function teamYearDocRef(teamId: string, year: number) {
    return doc(getDb(), "team", teamId, "teamEvents", String(year));
  }
  ```

- [ ] **Step 2.A.2: Rename `mutateYear` → `mutateTeamYear` and add `teamId` to the signature.**

  Old (lines 117–133):
  ```ts
  async function mutateYear(
    year: number,
    mutate: (events: Event[]) => Event[],
  ): Promise<void> {
    const ref = yearDocRef(year);
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists()
        ? ((snap.data() as YearEvents).events ?? [])
        : [];
      const next = mutate(existing);
      tx.set(ref, {
        year,
        events: next,
      });
    });
  }
  ```

  New:
  ```ts
  async function mutateTeamYear(
    teamId: string,
    year: number,
    mutate: (events: Event[]) => Event[],
  ): Promise<void> {
    const ref = teamYearDocRef(teamId, year);
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists()
        ? ((snap.data() as YearEvents).events ?? [])
        : [];
      const next = mutate(existing);
      tx.set(ref, {
        year,
        events: next,
      });
    });
  }
  ```

- [ ] **Step 2.A.3: Rename `subscribeYear` → `subscribeTeamYear` and add `teamId` to the signature.**

  Old (lines 16–29):
  ```ts
  export function subscribeYear(
    year: number,
    cb: (events: Event[]) => void,
  ): Unsubscribe {
    const ref = doc(getDb(), "events", String(year));
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const data = snap.data() as YearEvents;
      cb(data.events ?? []);
    });
  }
  ```

  New:
  ```ts
  export function subscribeTeamYear(
    teamId: string,
    year: number,
    cb: (events: Event[]) => void,
  ): Unsubscribe {
    const ref = teamYearDocRef(teamId, year);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const data = snap.data() as YearEvents;
      cb(data.events ?? []);
    });
  }
  ```

  Also update the section header comment at line 13:
  ```ts
  // §8.5 — team/{teamId}/teamEvents/{year}. One doc per team per year.
  // Live subscription returns [] when the doc doesn't exist yet (first event
  // for this team-year hasn't been written — the doc is created on first
  // write below).
  ```

- [ ] **Step 2.A.4: Update `createEvent` to call `mutateTeamYear` with the creator's team.**

  Old (lines 163–177):
  ```ts
  export async function createEvent(input: CreateEventInput): Promise<string> {
    validateInput(input);
    const now = Timestamp.now();
    const eventId = doc(collection(getDb(), "events")).id;
    const event = buildEvent(eventId, input, now, now);

    const years = yearsOf(input);
    for (const year of years) {
      await mutateYear(year, (events) => [...events, event]);
    }
    return eventId;
  }
  ```

  New:
  ```ts
  export async function createEvent(input: CreateEventInput): Promise<string> {
    validateInput(input);
    const now = Timestamp.now();
    // doc(collection(...)) on any collection gives a locally-unique id without
    // writing. The path used here is purely an id generator; the event is
    // actually written into team/{creatorTeamId}/teamEvents/{year} below.
    const eventId = doc(collection(getDb(), "team", input.creatorTeamId, "teamEvents")).id;
    const event = buildEvent(eventId, input, now, now);

    const years = yearsOf(input);
    for (const year of years) {
      await mutateTeamYear(input.creatorTeamId, year, (events) => [...events, event]);
    }
    return eventId;
  }
  ```

- [ ] **Step 2.A.5: Update `updateEvent` to use `existing.creatorTeamId` for paths.**

  Old (lines 179–214):
  ```ts
  export async function updateEvent(
    eventId: string,
    patch: EventInput,
    existing: Event,
  ): Promise<void> {
    validateInput(patch);
    const updated: Event = buildEvent(
      eventId,
      {
        ...patch,
        creatorId: existing.creatorId,
        creatorName: existing.creatorName,
        creatorTeamId: existing.creatorTeamId,
      },
      existing.createdAt,
      Timestamp.now(),
    );

    const oldYears = new Set(eventYears(existing));
    const newYears = new Set(yearsOf(patch));

    for (const year of oldYears) {
      if (newYears.has(year)) continue;
      await mutateYear(year, (events) =>
        events.filter((e) => e.eventId !== eventId),
      );
    }
    for (const year of newYears) {
      await mutateYear(year, (events) => {
        const filtered = events.filter((e) => e.eventId !== eventId);
        return [...filtered, updated];
      });
    }
  }
  ```

  New:
  ```ts
  export async function updateEvent(
    eventId: string,
    patch: EventInput,
    existing: Event,
  ): Promise<void> {
    validateInput(patch);
    const updated: Event = buildEvent(
      eventId,
      {
        ...patch,
        creatorId: existing.creatorId,
        creatorName: existing.creatorName,
        creatorTeamId: existing.creatorTeamId,
      },
      existing.createdAt,
      Timestamp.now(),
    );

    const teamId = existing.creatorTeamId;
    const oldYears = new Set(eventYears(existing));
    const newYears = new Set(yearsOf(patch));

    for (const year of oldYears) {
      if (newYears.has(year)) continue;
      await mutateTeamYear(teamId, year, (events) =>
        events.filter((e) => e.eventId !== eventId),
      );
    }
    for (const year of newYears) {
      await mutateTeamYear(teamId, year, (events) => {
        const filtered = events.filter((e) => e.eventId !== eventId);
        return [...filtered, updated];
      });
    }
  }
  ```

- [ ] **Step 2.A.6: Update `deleteEvent` to use `event.creatorTeamId` for paths.**

  Old (lines 216–223):
  ```ts
  export async function deleteEvent(event: Event): Promise<void> {
    const years = eventYears(event);
    for (const year of years) {
      await mutateYear(year, (events) =>
        events.filter((e) => e.eventId !== event.eventId),
      );
    }
  }
  ```

  New:
  ```ts
  export async function deleteEvent(event: Event): Promise<void> {
    const teamId = event.creatorTeamId;
    const years = eventYears(event);
    for (const year of years) {
      await mutateTeamYear(teamId, year, (events) =>
        events.filter((e) => e.eventId !== event.eventId),
      );
    }
  }
  ```

- [ ] **Step 2.A.7: Update `createHolidayEventsBulk` to call `mutateTeamYear` and use the team-scoped id generator.**

  Old (lines 230–283):
  ```ts
  export async function createHolidayEventsBulk(
    year: number,
    holidays: { date: Date; description: string }[],
    creator: { creatorId: string; creatorName: string; creatorTeamId: string },
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    await mutateYear(year, (existing) => {
      created = 0;
      skipped = 0;
      const existingKeys = new Set<string>();
      for (const e of existing) {
        if (
          e.type === "Holiday" &&
          e.creatorTeamId === creator.creatorTeamId &&
          e.isSingleDay &&
          e.date != null
        ) {
          existingKeys.add(`${e.creatorTeamId}|${e.date.toMillis()}`);
        }
      }
      const additions: Event[] = [];
      const now = Timestamp.now();
      for (const h of holidays) {
        const dateOnly = toDateOnly(h.date);
        const key = `${creator.creatorTeamId}|${dateOnly.toMillis()}`;
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }
        existingKeys.add(key);
        const eventId = doc(collection(getDb(), "events")).id;
        additions.push({
          eventId,
          creatorId: creator.creatorId,
          creatorName: creator.creatorName,
          creatorTeamId: creator.creatorTeamId,
          title: h.description,
          description: null,
          type: "Holiday",
          isSingleDay: true,
          date: dateOnly,
          startDate: null,
          endDate: null,
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      }
      return [...existing, ...additions];
    });
    return { created, skipped };
  }
  ```

  New:
  ```ts
  export async function createHolidayEventsBulk(
    year: number,
    holidays: { date: Date; description: string }[],
    creator: { creatorId: string; creatorName: string; creatorTeamId: string },
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    await mutateTeamYear(creator.creatorTeamId, year, (existing) => {
      created = 0;
      skipped = 0;
      const existingKeys = new Set<string>();
      for (const e of existing) {
        if (
          e.type === "Holiday" &&
          e.creatorTeamId === creator.creatorTeamId &&
          e.isSingleDay &&
          e.date != null
        ) {
          existingKeys.add(`${e.creatorTeamId}|${e.date.toMillis()}`);
        }
      }
      const additions: Event[] = [];
      const now = Timestamp.now();
      for (const h of holidays) {
        const dateOnly = toDateOnly(h.date);
        const key = `${creator.creatorTeamId}|${dateOnly.toMillis()}`;
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }
        existingKeys.add(key);
        const eventId = doc(
          collection(getDb(), "team", creator.creatorTeamId, "teamEvents"),
        ).id;
        additions.push({
          eventId,
          creatorId: creator.creatorId,
          creatorName: creator.creatorName,
          creatorTeamId: creator.creatorTeamId,
          title: h.description,
          description: null,
          type: "Holiday",
          isSingleDay: true,
          date: dateOnly,
          startDate: null,
          endDate: null,
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      }
      return [...existing, ...additions];
    });
    return { created, skipped };
  }
  ```

- [ ] **Step 2.A.8: Verify typecheck after events.ts changes.**

  Run: `npx tsc --noEmit`
  Expected: **errors** — the three hooks still import `subscribeYear`, which no longer exists. That's expected; the next subtask fixes them.

### Subtask 2.B — Hook fan-out

- [ ] **Step 2.B.1: Rewrite `lib/hooks/useMonthEvents.ts`.**

  Replace the whole file with:

  ```ts
  "use client";

  import * as React from "react";

  import { subscribeTeamYear } from "@/lib/db/events";
  import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
  import { gridYears } from "@/lib/calendar/grid";
  import type { Event } from "@/lib/types";

  // Subscribes to the team-year docs for every visible team and every year the
  // 42-cell month grid spans (1 or 2 per §8.7). Fans out across
  // teams × years, dedupes by eventId. Loading is true until each (teamId,
  // year) tuple has reported at least once (an empty list still counts).
  export function useMonthEvents(focusedMonth: Date): {
    events: Event[];
    loading: boolean;
  } {
    const { teams } = useWorkspaceTeams();

    // Sort teamIds so a stable order survives reorder churn in the
    // workspace-teams snapshot.
    const teamIds = React.useMemo(
      () => teams.map((t) => t.teamId).sort(),
      [teams],
    );
    const years = React.useMemo(() => gridYears(focusedMonth), [focusedMonth]);

    // Composite key — effect only resubscribes when the actual set of
    // (team, year) tuples changes.
    const subKey = `${teamIds.join(",")}::${years.join(",")}`;

    const [byKey, setByKey] = React.useState<Record<string, Event[]>>({});

    React.useEffect(() => {
      if (teamIds.length === 0 || years.length === 0) {
        setByKey({});
        return;
      }
      const unsubs: Array<() => void> = [];
      for (const teamId of teamIds) {
        for (const year of years) {
          const key = `${teamId}|${year}`;
          unsubs.push(
            subscribeTeamYear(teamId, year, (events) => {
              setByKey((prev) => ({ ...prev, [key]: events }));
            }),
          );
        }
      }
      return () => {
        unsubs.forEach((u) => u());
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subKey]);

    const events = React.useMemo(() => {
      const seen = new Set<string>();
      const out: Event[] = [];
      for (const teamId of teamIds) {
        for (const year of years) {
          const key = `${teamId}|${year}`;
          for (const e of byKey[key] ?? []) {
            if (seen.has(e.eventId)) continue;
            seen.add(e.eventId);
            out.push(e);
          }
        }
      }
      return out;
    }, [byKey, teamIds, years]);

    const loading = teamIds.length > 0 && teamIds.some((tid) =>
      years.some((y) => !(`${tid}|${y}` in byKey)),
    );

    return { events, loading };
  }
  ```

- [ ] **Step 2.B.2: Rewrite `lib/hooks/useTodayEvents.ts`.**

  Replace the whole file with:

  ```ts
  "use client";

  import * as React from "react";
  import { startOfToday } from "date-fns";

  import { subscribeTeamYear } from "@/lib/db/events";
  import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
  import { eventOverlapsDay } from "@/lib/calendar/grid";
  import type { Event } from "@/lib/types";

  // §6.6 — derives the sidebar member-status badge by surfacing events that
  // overlap today. Subscribes to the current year doc of every visible team
  // and dedupes by eventId. Multi-day events crossing the Dec/Jan boundary
  // are visible from whichever year doc they were written to (createEvent
  // writes to both year docs in that case).
  export function useTodayEvents(): { events: Event[]; loading: boolean } {
    const today = React.useMemo(() => startOfToday(), []);
    const year = today.getFullYear();
    const { teams } = useWorkspaceTeams();
    const teamIds = React.useMemo(
      () => teams.map((t) => t.teamId).sort(),
      [teams],
    );

    const subKey = `${teamIds.join(",")}::${year}`;

    const [byTeam, setByTeam] = React.useState<Record<string, Event[]>>({});

    React.useEffect(() => {
      if (teamIds.length === 0) {
        setByTeam({});
        return;
      }
      const unsubs = teamIds.map((teamId) =>
        subscribeTeamYear(teamId, year, (events) => {
          setByTeam((prev) => ({ ...prev, [teamId]: events }));
        }),
      );
      return () => {
        unsubs.forEach((u) => u());
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subKey]);

    const events = React.useMemo(() => {
      const seen = new Set<string>();
      const out: Event[] = [];
      for (const teamId of teamIds) {
        for (const e of byTeam[teamId] ?? []) {
          if (seen.has(e.eventId)) continue;
          if (!eventOverlapsDay(e, today)) continue;
          seen.add(e.eventId);
          out.push(e);
        }
      }
      return out;
    }, [byTeam, teamIds, today]);

    const loading =
      teamIds.length > 0 && teamIds.some((tid) => !(tid in byTeam));

    return { events, loading };
  }
  ```

- [ ] **Step 2.B.3: Rewrite `lib/hooks/useWeekEvents.ts`.**

  Replace the whole file with:

  ```ts
  "use client";

  import * as React from "react";
  import { startOfToday } from "date-fns";

  import { subscribeTeamYear } from "@/lib/db/events";
  import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
  import { eventOverlapsDay, isoWeekRange } from "@/lib/calendar/grid";
  import type { Event } from "@/lib/types";

  // Mirror of useTodayEvents but scoped to the current ISO Mon-Sun week.
  // Fans out across teams × the 1-2 years the week spans, dedupes by eventId,
  // and returns events overlapping any day in the week.
  export function useWeekEvents(): { events: Event[]; loading: boolean } {
    const today = React.useMemo(() => startOfToday(), []);
    const week = React.useMemo(() => isoWeekRange(today), [today]);

    const years = React.useMemo(() => {
      const s = week.start.getFullYear();
      const e = week.end.getFullYear();
      return s === e ? [s] : [s, e];
    }, [week]);

    const { teams } = useWorkspaceTeams();
    const teamIds = React.useMemo(
      () => teams.map((t) => t.teamId).sort(),
      [teams],
    );

    const subKey = `${teamIds.join(",")}::${years.join(",")}`;

    const [byKey, setByKey] = React.useState<Record<string, Event[]>>({});

    React.useEffect(() => {
      if (teamIds.length === 0 || years.length === 0) {
        setByKey({});
        return;
      }
      const unsubs: Array<() => void> = [];
      for (const teamId of teamIds) {
        for (const year of years) {
          const key = `${teamId}|${year}`;
          unsubs.push(
            subscribeTeamYear(teamId, year, (events) => {
              setByKey((prev) => ({ ...prev, [key]: events }));
            }),
          );
        }
      }
      return () => {
        unsubs.forEach((u) => u());
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subKey]);

    const events = React.useMemo(() => {
      const seen = new Set<string>();
      const out: Event[] = [];
      for (const teamId of teamIds) {
        for (const year of years) {
          const key = `${teamId}|${year}`;
          for (const e of byKey[key] ?? []) {
            if (seen.has(e.eventId)) continue;
            if (!eventOverlapsAnyDayInWeek(e, week.start, week.end)) continue;
            seen.add(e.eventId);
            out.push(e);
          }
        }
      }
      return out;
    }, [byKey, teamIds, years, week]);

    const loading = teamIds.length > 0 && teamIds.some((tid) =>
      years.some((y) => !(`${tid}|${y}` in byKey)),
    );

    return { events, loading };
  }

  function eventOverlapsAnyDayInWeek(
    event: Event,
    start: Date,
    end: Date,
  ): boolean {
    let cursor = start;
    while (cursor <= end) {
      if (eventOverlapsDay(event, cursor)) return true;
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    return false;
  }
  ```

### Subtask 2.C — Firestore rules

- [ ] **Step 2.C.1: Add the nested `teamEvents` matcher under `team`** in `firestore.rules`. Also delete the old top-level `match /events/{docId}` block (events no longer live there).

  Inside the `match /team/{teamId} { ... }` block, append (before the closing brace):

  ```
      // Events — one doc per year, scoped to this team (§8.5).
      // READ: any authed user (the calendar is public per §11).
      // WRITE: the writer must claim membership in at least one team. This
      // gate reads users/{uid}.teams which is self-writable, so it is
      // best-effort — see residual risks #1 and #3 at the top of this file.
      // Phase 9 replaces this with a Cloud Function callable that validates
      // team membership and the array diff server-side.
      match /teamEvents/{year} {
        allow read: if isAuth();
        allow create, update, delete: if isAuth()
          && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.teams.size() > 0;
      }
  ```

  Delete the old top-level events block:

  ```
  // Events — one doc per year (§8.5).
  // READ: any authed user (the calendar is public per §11).
  // WRITE: ...
  match /events/{docId} {
    allow read: if isAuth();
    allow create, update, delete: if isAuth()
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.teams.size() > 0;
  }
  ```

- [ ] **Step 2.C.2: Update the header risk-comments in `firestore.rules`** to reflect the narrower per-team blast radius.

  Old residual-risk #1:
  ```
  //  1. Event writers in ANY team can overwrite the per-year events array
  //     (including events authored by others) and can spoof creatorId /
  //     creatorTeamId on new entries. Rules cannot safely diff array overwrites.
  ```

  New:
  ```
  //  1. Event writers can overwrite a single team's per-year events array
  //     (including events authored by others within THAT team) and can spoof
  //     creatorId / creatorTeamId on new entries. Rules cannot safely diff
  //     array overwrites. Blast radius is now scoped to one team's year doc
  //     rather than the whole workspace, but the per-team rule still cannot
  //     verify the writer is in this specific team's roster (see #2).
  ```

- [ ] **Step 2.C.3: Deploy updated rules to the dev Firebase project.** Same mechanism as Step 1.7.

### Subtask 2.D — Verification

- [ ] **Step 2.D.1: Verify typecheck.**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 2.D.2: Verify lint.**

  Run: `npm run lint`
  Expected: clean.

- [ ] **Step 2.D.3: Manual smoke (run after the dev wipe from the Prerequisite section is still in effect).**

  Run: `npm run dev`

  1. Fresh sign-in → empty calendar, no console errors.
  2. Create team **A** → confirm `team/{idA}` exists with inline metadata.
  3. Create an event under A → confirm `team/{idA}/teamEvents/2026` exists with the event in its `events[]`. Confirm the event appears on the calendar.
  4. Create team **B** and create an event in it → confirm `team/{idB}/teamEvents/2026` is a separate doc containing only B's event.
  5. Sidebar filter to A → only A's events render. Switch to B → only B's. "All teams" → both.
  6. Edit an event → mutation lands in the correct team's year doc; calendar reflects it.
  7. Delete an event → removed from the correct team's year doc.
  8. Create a cross-year event under team A (Dec 30 2026 → Jan 2 2027) → writes to both `team/{idA}/teamEvents/2026` and `team/{idA}/teamEvents/2027`; calendar shows it correctly across the boundary.
  9. Cascade-rename team A (via team-settings UI) → metadata updates and embedded `users.teams[]` cascades. `teamEvents/*` subcollection untouched.
  10. Cascade-delete team B → `team/{idB}` + every `team/{idB}/teamEvents/*` doc gone; `teamMembers/{idB}` gone; embedded entries in users removed.
  11. Sidebar "Today" / "This week" pills show events from every team correctly.
  12. Open the calendar in two browser tabs → write in tab 1 → tab 2's listener fires for that team only (verify via DevTools network panel: only that team's `teamEvents` listener receives an update).

  Edge cases:
  13. Workspace with 0 teams visible → hooks return `events: []`, `loading: false` immediately. No listeners opened. (Verify by sign-in with a user who has no teams.)
  14. Import a holiday set via the existing flow (Import Taiwan Holidays dialog) → bulk holidays land at the **SYSTEM**-attributed path: `team/SYSTEM/teamEvents/{year}`. Firestore creates the subcollection doc fine even though no `team/SYSTEM` parent doc exists (the Console will show `team/SYSTEM` as a ghost/placeholder). Rules pass because the `teamEvents` matcher only checks the writer's own user doc, not `isTeamOwner(SYSTEM)`. This is OK transitionally; the holiday-belongs-to-team follow-up spec will replace `SYSTEM` with a real team id.

- [ ] **Step 2.D.4: Commit.**

  ```bash
  git add lib/db/events.ts \
          lib/hooks/useMonthEvents.ts \
          lib/hooks/useTodayEvents.ts \
          lib/hooks/useWeekEvents.ts \
          firestore.rules
  git commit -m "Relocate events into per-team teamEvents subcollections

  Moves events from the global events/{year} doc into
  team/{teamId}/teamEvents/{year}. Each calendar hook fans out across
  the visible teams x years and dedupes by eventId. Rules nest the
  teamEvents matcher under team; the blunt event-write gate (writer
  claims membership in >=1 team) is preserved pending Phase 9 callable
  refactor."
  ```

---

## Task 3: Append note to holiday spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-26-import-taiwan-holidays-design.md` (prepend a status note)

- [ ] **Step 3.1: Add a "Schema rebased" note at the top of the holiday spec**, just below the `Status:` line. Use Edit to insert:

  Old (lines 1–4):
  ```markdown
  # Import Taiwan Holidays — Design

  **Date:** 2026-05-26
  **Status:** Approved (pending spec review)
  ```

  New:
  ```markdown
  # Import Taiwan Holidays — Design

  **Date:** 2026-05-26
  **Status:** Approved — paths and attribution superseded

  > **Schema rebased 2026-05-29.** Events now live at
  > `team/{teamId}/teamEvents/{year}` per
  > `2026-05-28-per-team-event-subcollections-design.md`. The SYSTEM-attribution
  > and Holiday filter-exemption behavior described below is being replaced by
  > the holiday-belongs-to-team follow-up spec. Treat the per-team-subcollection
  > spec and the upcoming holiday-attribution spec as the source of truth for
  > path and attribution; keep this doc for the dialog/UI/dedupe details.
  ```

- [ ] **Step 3.2: Commit.**

  ```bash
  git add docs/superpowers/specs/2026-05-26-import-taiwan-holidays-design.md
  git commit -m "Note schema rebase atop import-holidays spec

  Flag that paths and SYSTEM-attribution are superseded by the per-team
  subcollections spec and an upcoming holiday-attribution follow-up.
  Dialog/UI/dedupe sections of the original spec still apply."
  ```

---

## Done

After all three tasks land:

- Schema is fully per-team. `events/*` collection is empty (or deleted in dev).
- All hooks fan out across teams × years.
- Rules enforce per-team paths with the same blunt write gate as before.
- Holiday import still works against the new schema using `team/SYSTEM/teamEvents/*` as a transitional shim until the holiday-attribution follow-up spec lands.

**Next:** open a separate brainstorm/plan cycle for the holiday-belongs-to-team change against the new schema.
