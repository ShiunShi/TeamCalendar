# Import Taiwan Holidays — Design

**Date:** 2026-05-26
**Status:** Approved (pending spec review)

## Context

A team owner needs to seed the calendar with Taiwan's statutory public holidays for a chosen year. Today owners create every event by hand, which is tedious and error-prone for predictable annual data. This feature adds a one-click import that fetches an authoritative public holiday list and writes the missing entries as Holiday-type events attributed to the `SYSTEM` sentinel (not to any user or team). Imported holidays render with a neutral gray chip and stay visible regardless of which team is selected in the sidebar filter — they're national, not team-specific.

Scope deliberately stays minimal: public holidays only, one year per import, idempotent re-imports. Makeup workdays (補班), commemorative-only days, and cross-source holiday data are out of scope.

## User Flow

1. User signs in. The calendar header gains a small overflow (kebab) button next to **+ Schedule**, but only when `userDoc.teams.some(t => t.role === "owner")` — i.e. the user owns at least one team. Non-owners and team-less users see no change to the header.
2. Owner clicks the overflow → shadcn `DropdownMenu` opens with one item: **Import Taiwan holidays**. (Single item today; the menu structure can grow.)
3. Selecting the item opens `ImportHolidaysDialog`:
   - **Year** field: `<input type="number">`, default = current year, min = current year − 1, max = current year + 1.
   - **Cancel** / **Import** buttons in the footer. Import is disabled while a request is in flight and shows a spinner.
4. On **Import**: fetch year data → filter to public holidays → dedupe against existing Holiday events for `(date, "SYSTEM")` → write the delta in one Firestore transaction → toast `Imported N holidays for <year> (M already present)` → close dialog.
5. On error: error toast (e.g. `Holiday data for <year> is not available yet.`), dialog stays open so the owner can retry.

### Attribution

Imported holidays carry the literal `"SYSTEM"` as `creatorId`, `creatorName`, and `creatorTeamId`. The team-color lookup (`teamsById.get("SYSTEM")`) returns `undefined`, so every consumer falls through to the existing gray fallback (`team?.color ?? "#9CA3AF"`). The chip's attribution label reads `SYSTEM`.

The ownership check (`userDoc.teams.some(t => t.role === "owner")`) is preserved only as the menu-visibility gate — non-owners never see the overflow item. The dialog itself does not need to resolve a team. The Firestore write succeeds under the existing H1 rule because the writer (a real owner) has `users.teams.size() > 0`; the per-entry creator fields on the events array are not validated by rules.

## Data Fetch

**New module:** `src/lib/holidays/taiwan.ts`. Browser-only (`fetch`). No new dependencies.

**Source:** `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/<year>.json` — CORS-enabled community mirror of the DGPA office calendar.

**Response shape:**

```json
[
  { "date": "20260101", "week": "四", "isHoliday": true, "description": "開國紀念日" },
  { "date": "20260102", "week": "五", "isHoliday": false, "description": "" }
]
```

**Public API:**

```ts
export interface TaiwanHoliday {
  date: Date;          // local-midnight Date parsed from YYYYMMDD
  description: string; // e.g. "開國紀念日"; falls back to "Public holiday" if empty
}

export async function fetchTaiwanHolidays(year: number): Promise<TaiwanHoliday[]>;
```

**Behavior:**

- Fetch the year's JSON. HTTP 404 → `Holiday data for <year> is not available yet.` Other non-2xx → generic `Failed to fetch holiday data.` Network error → re-throw with a friendly message.
- Validate top-level is an array; validate each surviving entry has an 8-character `date` string and a boolean `isHoliday`. Fail fast on shape mismatch.
- Filter to `entry.isHoliday === true`.
- Parse each `date` via `new Date(yyyy, mm-1, dd, 0, 0, 0, 0)` — matches the local-midnight normalization in `src/lib/db/events.ts:toDateOnly`.
- If the API's `description` is empty, substitute `"Public holiday"`.

**Non-goals:** no retry, no client-side caching, no schema validation library (zod). One-shot fetch per import; failures surface as a toast and the owner clicks again.

## Dedupe and Write

**New helper:** added to `src/lib/db/events.ts`.

```ts
export async function createHolidayEventsBulk(
  year: number,
  holidays: { date: Date; description: string }[],
  creator: { creatorId: string; creatorName: string; creatorTeamId: string },
): Promise<{ created: number; skipped: number }>;
```

**Why a new helper:** the existing `createEvent` runs one `mutateYear` transaction per event. A 25-holiday import would mean 25 transactions on the same year doc with serialized snapshot churn. The new helper calls `mutateYear` exactly once, building the deduped delta in a single transaction.

**Dedupe key:** `(creatorTeamId, type === "Holiday", date.getTime())`. Imports always use `creatorTeamId === "SYSTEM"`, so the key effectively reduces to `("SYSTEM", date)` for all current and future imports — a different owner re-importing the same year cannot create duplicates.

Title is intentionally **not** part of the key. The API's `description` can shift wording year-over-year (`元旦` ↔ `開國紀念日` ↔ `中華民國開國紀念日`); excluding title from the key means a re-import doesn't re-add events because of an upstream string edit. Trade-off: a corrected title upstream will not propagate to existing events. Acceptable given the "skip duplicates silently" semantics the owner picked.

**Algorithm inside `mutateYear`:**

1. Read existing `events[]` from `events/{year}`.
2. Build a `Set<string>` of dedupe keys for existing entries where `type === "Holiday" && creatorTeamId === creator.creatorTeamId && isSingleDay && date != null`. Key format: `<creatorTeamId>|<dateMillis>` (i.e. `SYSTEM|<dateMillis>` after this change).
3. For each holiday in the input, compute its key. If in the Set, increment `skipped`. Otherwise:
   - Generate `eventId` via `doc(collection(getDb(), "events")).id`.
   - Build the `Event` map using the same shape as `createEvent` → `buildEvent`.
   - Append to the new array; increment `created`.
4. Pass `[...existing, ...newOnes]` back to `mutateYear`. One transaction, one snapshot push, one rule evaluation.
5. Return `{ created, skipped }`.

**Event shape per holiday:**

| Field            | Value                                            |
|------------------|--------------------------------------------------|
| `eventId`        | client-generated via `doc(collection(...)).id`   |
| `creatorId`      | `"SYSTEM"`                                       |
| `creatorName`    | `"SYSTEM"`                                       |
| `creatorTeamId`  | `"SYSTEM"`                                       |
| `title`          | API `description`, or `"Public holiday"` fallback |
| `description`    | `null`                                           |
| `type`           | `"Holiday"`                                      |
| `isSingleDay`    | `true`                                           |
| `date`           | `toDateOnly(holiday.date)`                       |
| `startDate`      | `null`                                           |
| `endDate`        | `null`                                           |
| `createdAt`      | `Timestamp.now()`                                |
| `updatedAt`      | `Timestamp.now()`                                |

**Year-boundary note:** every entry from one API file falls inside the requested year, so a single `mutateYear(year, …)` call covers the whole batch. No cross-year path needed (unlike `createEvent`, which handles multi-year ranges).

**Failure mode:** Firestore rolls back the whole transaction on contention or write failure. The caller sees a thrown error and toasts it; no partial state lands.

## UI Components

**New files:**

- `src/components/calendar/CalendarHeaderMenu.tsx` — owner-only overflow button. Uses the existing shadcn `DropdownMenu` at `components/ui/dropdown-menu.tsx`. Reads `useUser` to gate visibility. Manages local open-state for the `ImportHolidaysDialog`. Renders `null` when the user owns no teams.
- `src/components/dialogs/ImportHolidaysDialog.tsx` — shadcn `Dialog`. Holds local state for: year input value, busy flag. Calls `fetchTaiwanHolidays` then `createHolidayEventsBulk` with the `SYSTEM` creator, toasts the result, closes on success.

**Edits to existing files:**

- `src/components/calendar/CalendarHeader.tsx` — mount `<CalendarHeaderMenu />` immediately after the **+ Schedule** button. No prop changes (the menu reads its own context).
- `src/lib/db/events.ts` — add `createHolidayEventsBulk` (described above). No changes to existing exports.
- `src/components/calendar/CalendarView.tsx` — team filter exempts `type === "Holiday"` so workspace-wide holidays remain visible when the sidebar filter narrows to a specific team.

**Not touched:** `firestore.rules` (the H1-partial rule from the prior security work already permits owner writes), `MonthGrid`, `EventChip`, sidebar, view filters.

## Error Handling

| Failure                                | Surface                                                            |
|----------------------------------------|--------------------------------------------------------------------|
| Network error during fetch             | `toast.error("Couldn't reach the holiday data source. Try again.")` — dialog stays open. |
| API returns 404 for the year           | `toast.error("Holiday data for <year> is not available yet.")` — dialog stays open. |
| API returns other non-2xx              | `toast.error("Failed to fetch holiday data.")` — dialog stays open. |
| API shape unexpected                   | `toast.error("Holiday data was in an unexpected format.")` — dialog stays open. |
| No public holidays in the year (empty) | `toast.success("No public holidays found for <year>.")` — dialog closes. (Treated as a benign zero-import.) |
| Firestore transaction fails            | `toast.error(err.message ?? "Import failed.")` — dialog stays open. |

The dialog stays open on every recoverable error so the owner doesn't lose their year input.

## Verification

No test harness exists in the repo (no `test` script, no `__tests__`). Verification is type-check + lint + manual.

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.

**Manual smoke (golden path):**

1. Sign in as a team owner. Confirm the overflow button renders next to **+ Schedule**.
2. Open menu → **Import Taiwan holidays** → dialog opens with current year preset (no Team row).
3. Click **Import** → success toast `Imported N holidays for <year> (0 already present)`. Confirm the holidays appear on the calendar with a neutral gray chip and the creator label `SYSTEM`.
4. Click **Import** again with the same year → `Imported 0 holidays for <year> (N already present)`. Calendar unchanged.
5. Change year to current + 1 and re-import → new holidays land; previous year unaffected.
6. Filter the sidebar to a specific team. Confirm holiday chips remain visible alongside that team's events.

**Manual smoke (edge cases):**

7. Year far in the future (2099) → friendly 404 toast; dialog stays open.
8. Sign in as a non-owner → overflow button does **not** render.
9. Sign in as a user with no teams → overflow button does **not** render.
10. Throttle devtools to offline → click Import → error toast; dialog stays open; retry after reconnect succeeds.

**Not verified by this work:**

- jsDelivr / ruyut upstream accuracy.
- Retention-sweep behavior against Holiday events (separate Cloud Function concern).
- Role gating at the rules layer (the current H1 rule only checks team membership, not role — see the security audit's residual risks).

## Out of Scope

- Makeup workdays (補班), commemorative-only days, lunar-only days.
- Other countries' holiday calendars (the menu structure is ready to grow, but no items added).
- Bulk delete / "remove imported holidays" affordance — owners manage holiday events the same way they manage hand-created ones.
- Cross-year ranges or multi-year imports per click.
- A "preview" step listing each holiday before commit.
- Updating titles on re-import (deliberately excluded per the dedupe-by-date decision).
