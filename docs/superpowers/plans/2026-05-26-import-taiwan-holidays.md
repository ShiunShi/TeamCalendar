# Import Taiwan Holidays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner-only one-click import that fetches Taiwan public-holiday dates for a chosen year and writes them as Holiday events attributed to the owner's resolved team, deduping silently against existing entries.

**Architecture:** New client-side fetcher hits the ruyut/TaiwanCalendar jsDelivr mirror (CORS-enabled, no Next.js route handler needed). A new bulk-insert helper in `src/lib/db/events.ts` reuses the existing `mutateYear` primitive to write all new events in one Firestore transaction. UI is a new overflow `DropdownMenu` in the calendar header (visible only to team owners) that opens a new `ImportHolidaysDialog`.

**Tech Stack:** Next.js App Router (existing), shadcn `Dialog` + `DropdownMenu` + `Input` + `Label` + `Button` (all already in repo), Firestore Web SDK (existing), `sonner` toasts (existing), `lucide-react` icons (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-26-import-taiwan-holidays-design.md`.

**Note on TDD:** This project has no test harness (no `test` script, no `__tests__`, see spec "Verification" section). Each task uses **`npx tsc --noEmit` + `npm run lint`** as the gating verification, with manual smoke at the end of the plan.

---

## File Structure

**Create:**
- `src/lib/holidays/taiwan.ts` — fetches a year's holiday data from jsDelivr, filters and parses to `{ date, description }[]`. Pure async function, no React.
- `src/components/dialogs/ImportHolidaysDialog.tsx` — shadcn `Dialog` with year input, resolved-team display, and the Import button. Owns local busy/year state. Calls the fetcher and the bulk helper.
- `src/components/calendar/CalendarHeaderMenu.tsx` — owner-only overflow button. Wraps `DropdownMenu` and `ImportHolidaysDialog`; renders `null` when the user owns no teams.

**Modify:**
- `src/lib/db/events.ts` — append `createHolidayEventsBulk(year, holidays, creator)` at the end of the file. Reuses private `mutateYear` and `toDateOnly` helpers.
- `src/components/calendar/CalendarHeader.tsx` — mount `<CalendarHeaderMenu />` immediately after the existing `+ Schedule` button. No prop changes.

**Don't touch:** `firestore.rules` (existing rule from the prior security work already permits owner writes), `MonthGrid`, `EventChip`, view filters, sidebar, `CalendarView`.

---

### Task 1: Holiday fetcher

**Files:**
- Create: `src/lib/holidays/taiwan.ts`

- [ ] **Step 1: Create the fetcher module**

```ts
// Fetch Taiwan public-holiday dates for a given year from the
// ruyut/TaiwanCalendar jsDelivr mirror. Browser-only (uses fetch).
//
// API shape (one entry per day of the year):
//   { date: "20260101", week: "四", isHoliday: true, description: "開國紀念日" }

export interface TaiwanHoliday {
  date: Date;          // local-midnight Date
  description: string; // human-readable name, never empty
}

interface ApiEntry {
  date: string;
  isHoliday: boolean;
  description: string;
}

const SOURCE = "https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data";
const FALLBACK_TITLE = "Public holiday";

export async function fetchTaiwanHolidays(year: number): Promise<TaiwanHoliday[]> {
  let res: Response;
  try {
    res = await fetch(`${SOURCE}/${year}.json`);
  } catch {
    throw new Error("Couldn't reach the holiday data source. Try again.");
  }
  if (res.status === 404) {
    throw new Error(`Holiday data for ${year} is not available yet.`);
  }
  if (!res.ok) {
    throw new Error("Failed to fetch holiday data.");
  }
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) {
    throw new Error("Holiday data was in an unexpected format.");
  }
  const out: TaiwanHoliday[] = [];
  for (const entry of raw) {
    if (!isApiEntry(entry)) {
      throw new Error("Holiday data was in an unexpected format.");
    }
    if (!entry.isHoliday) continue;
    out.push({
      date: parseYyyymmdd(entry.date),
      description:
        entry.description.length > 0 ? entry.description : FALLBACK_TITLE,
    });
  }
  return out;
}

function isApiEntry(v: unknown): v is ApiEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.date === "string" &&
    e.date.length === 8 &&
    typeof e.isHoliday === "boolean" &&
    typeof e.description === "string"
  );
}

function parseYyyymmdd(s: string): Date {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean, no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/holidays/taiwan.ts
git commit -m "$(cat <<'EOF'
Add Taiwan holiday fetcher

Browser-only fetch of the ruyut/TaiwanCalendar jsDelivr mirror for a
given year. Filters to isHoliday entries, parses YYYYMMDD to local-
midnight Dates, and substitutes "Public holiday" when the upstream
description is empty.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Bulk insert helper

**Files:**
- Modify: `src/lib/db/events.ts` (append at end)

- [ ] **Step 1: Append the bulk helper**

Add to the bottom of `src/lib/db/events.ts` (after `deleteEvent`). `mutateYear`, `toDateOnly`, `doc`, `collection`, `Timestamp`, `getDb`, and `Event` are already in scope from earlier in the file / existing imports:

```ts
// Bulk-insert Holiday events for a single year. Reads the year doc once
// inside mutateYear's transaction, dedupes against existing entries by
// (creatorTeamId, type=Holiday, single-day date), and appends the delta.
// Title is intentionally not part of the dedupe key — see the design doc
// 2026-05-26-import-taiwan-holidays-design.md.
export async function createHolidayEventsBulk(
  year: number,
  holidays: { date: Date; description: string }[],
  creator: { creatorId: string; creatorName: string; creatorTeamId: string },
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  await mutateYear(year, (existing) => {
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
      existingKeys.add(key); // dedupe within the input itself, defensively
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

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/events.ts
git commit -m "$(cat <<'EOF'
Add createHolidayEventsBulk for one-shot Holiday inserts

Reuses mutateYear so the whole batch runs in a single Firestore
transaction. Dedupes against existing Holiday entries by
(creatorTeamId, single-day date); title is excluded from the key so a
re-import doesn't re-add events when the upstream description shifts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Import dialog

**Files:**
- Create: `src/components/dialogs/ImportHolidaysDialog.tsx`

- [ ] **Step 1: Create the dialog component**

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import { useUser } from "@/lib/auth/AuthProvider";
import { useTeamSelection } from "@/lib/calendar/teamSelection";
import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
import { fetchTaiwanHolidays } from "@/lib/holidays/taiwan";
import { createHolidayEventsBulk } from "@/lib/db/events";
import type { Team, UserDoc } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 1;
const MAX_YEAR = CURRENT_YEAR + 1;

export function ImportHolidaysDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, userDoc } = useUser();
  const { selectedTeamId } = useTeamSelection();
  const { teams } = useWorkspaceTeams();
  const [year, setYear] = React.useState<number>(CURRENT_YEAR);
  const [busy, setBusy] = React.useState(false);

  const resolvedTeamId = userDoc
    ? resolveOwnedTeamId(userDoc, selectedTeamId)
    : null;
  const resolvedTeam: Team | null = React.useMemo(() => {
    if (!resolvedTeamId) return null;
    return teams.find((t) => t.teamId === resolvedTeamId) ?? null;
  }, [resolvedTeamId, teams]);

  const yearValid =
    Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
  const canImport =
    !busy &&
    user != null &&
    userDoc != null &&
    resolvedTeamId != null &&
    resolvedTeam != null &&
    yearValid;

  async function onImport() {
    if (!canImport || !user || !userDoc || !resolvedTeam || !resolvedTeamId) {
      return;
    }
    setBusy(true);
    try {
      const holidays = await fetchTaiwanHolidays(year);
      if (holidays.length === 0) {
        toast.success(`No public holidays found for ${year}.`);
        onOpenChange(false);
        return;
      }
      const { created, skipped } = await createHolidayEventsBulk(
        year,
        holidays,
        {
          creatorId: user.uid,
          creatorName: userDoc.name,
          creatorTeamId: resolvedTeamId,
        },
      );
      toast.success(
        `Imported ${created} holiday${created === 1 ? "" : "s"} for ${year} (${skipped} already present).`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Taiwan holidays</DialogTitle>
          <DialogDescription>
            Adds public-holiday dates as Holiday events attributed to the
            selected team. Re-imports skip duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="holiday-year">Year</Label>
            <Input
              id="holiday-year"
              type="number"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={Number.isFinite(year) ? year : ""}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Team</Label>
            {resolvedTeam ? (
              <div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
                <span
                  className="inline-block size-3 rounded-full"
                  style={{ backgroundColor: resolvedTeam.color }}
                  aria-hidden
                />
                <span>{resolvedTeam.name}</span>
              </div>
            ) : (
              <div className="rounded-md border border-input bg-card px-3 py-2 text-sm text-muted-foreground">
                No team available — you must own at least one team.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onImport} disabled={!canImport}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function resolveOwnedTeamId(
  userDoc: UserDoc,
  selectedTeamId: string | null,
): string | null {
  const owned = userDoc.teams.filter((t) => t.role === "owner");
  if (owned.length === 0) return null;
  if (selectedTeamId && owned.some((t) => t.teamId === selectedTeamId)) {
    return selectedTeamId;
  }
  if (
    userDoc.primaryTeamId &&
    owned.some((t) => t.teamId === userDoc.primaryTeamId)
  ) {
    return userDoc.primaryTeamId;
  }
  return owned[0].teamId;
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/dialogs/ImportHolidaysDialog.tsx
git commit -m "$(cat <<'EOF'
Add ImportHolidaysDialog

Year input (current year ±1), read-only resolved-team display, Cancel
and Import buttons. Resolves the attribution team from the sidebar
selection, falling back to primary team or first owned team. Toasts
the created/skipped counts on success; keeps the dialog open on error.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Calendar header overflow menu

**Files:**
- Create: `src/components/calendar/CalendarHeaderMenu.tsx`

- [ ] **Step 1: Create the menu component**

```tsx
"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";

import { useUser } from "@/lib/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ImportHolidaysDialog } from "@/components/dialogs/ImportHolidaysDialog";

export function CalendarHeaderMenu() {
  const { userDoc } = useUser();
  const [importOpen, setImportOpen] = React.useState(false);

  const ownsAnyTeam = userDoc?.teams.some((t) => t.role === "owner") ?? false;
  if (!ownsAnyTeam) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="More calendar actions"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setImportOpen(true)}>
            Import Taiwan holidays…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ImportHolidaysDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/CalendarHeaderMenu.tsx
git commit -m "$(cat <<'EOF'
Add owner-only calendar header overflow menu

Renders a kebab DropdownMenu beside the calendar header buttons,
visible only to users who own at least one team. Single item today
(Import Taiwan holidays); structure ready to grow.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Mount the menu in the calendar header

**Files:**
- Modify: `src/components/calendar/CalendarHeader.tsx`

- [ ] **Step 1: Add the import**

In `src/components/calendar/CalendarHeader.tsx`, add this import alongside the existing imports (after the `MonthYearPickerContent` import):

```tsx
import { CalendarHeaderMenu } from "./CalendarHeaderMenu";
```

- [ ] **Step 2: Mount the menu after the Schedule button**

Replace the closing `</Button>` of the Schedule button and its surrounding wrapper. Specifically, change the end of the JSX from:

```tsx
      <Button
        type="button"
        size="sm"
        onClick={onSchedule}
        disabled={scheduleDisabled}
        aria-keyshortcuts="n"
      >
        <Plus className="size-4" />
        <span className="ml-1">Schedule</span>
      </Button>
    </div>
  );
}
```

to:

```tsx
      <Button
        type="button"
        size="sm"
        onClick={onSchedule}
        disabled={scheduleDisabled}
        aria-keyshortcuts="n"
      >
        <Plus className="size-4" />
        <span className="ml-1">Schedule</span>
      </Button>
      <CalendarHeaderMenu />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/CalendarHeader.tsx
git commit -m "$(cat <<'EOF'
Mount CalendarHeaderMenu next to the Schedule button

Renders the owner-only overflow menu at the end of the header row.
The menu component is self-gating: returns null for non-owners, so no
ownership check is needed at the mount site.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Manual verification (no commit)

This task runs the smoke tests from the design doc against the dev server. No code changes, no commit — purely verification before declaring done.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on http://localhost:3000.

- [ ] **Step 2: Golden-path smoke — sign in as a team owner**

In a browser, sign in as a user who owns at least one team. Confirm an overflow (kebab) button renders to the right of the **+ Schedule** button.

- [ ] **Step 3: Open the dialog**

Click the overflow → click **Import Taiwan holidays…**. Confirm the dialog opens with the current year preset and the resolved team displayed (color chip + name).

- [ ] **Step 4: First import**

Click **Import**. Confirm a success toast like `Imported 14 holidays for 2026 (0 already present)`. Confirm the holiday events appear on the calendar with the team's color.

- [ ] **Step 5: Re-import idempotency**

Open the dialog again with the same year and click **Import**. Confirm the toast reads `Imported 0 holidays for 2026 (14 already present)` and no new chips appear on the calendar.

- [ ] **Step 6: Different year**

Change the year input to current year + 1 (e.g. 2027), click **Import**. Confirm those holidays land on the appropriate months and the previous year is unaffected.

- [ ] **Step 7: Year-not-available error**

Edit the year input to `2099` and click **Import**. Confirm an error toast like `Holiday data for 2099 is not available yet.` and the dialog stays open.

- [ ] **Step 8: Non-owner gating**

Sign out and sign in as a user with at least one team where their role is `member` (not `owner`) and no teams they own. Confirm the overflow button does **not** render in the calendar header.

- [ ] **Step 9: No-team gating**

Sign in as a freshly created user with no teams. Confirm the overflow button does **not** render.

- [ ] **Step 10: Sidebar-selection fallback**

Sign in as an owner of multiple teams. Select **All** in the sidebar. Open the dialog and confirm the resolved team is the user's primary team (or first owned team if no primary).

- [ ] **Step 11: Offline error**

In devtools → Network, switch to **Offline**. Open the dialog and click **Import**. Confirm an error toast (e.g. `Couldn't reach the holiday data source. Try again.`) and that the dialog stays open. Switch back to **Online** and retry — the import should succeed.

---

## Self-Review Notes

Coverage check against the spec:

| Spec section          | Tasks                       |
|-----------------------|-----------------------------|
| User Flow             | Task 4 (menu), Task 3 (dialog), Task 5 (mount) |
| Team attribution      | Task 3 (`resolveOwnedTeamId`) |
| Data Fetch            | Task 1                      |
| Dedupe and Write      | Task 2                      |
| UI Components         | Tasks 3, 4, 5               |
| Error Handling        | Task 1 (throws), Task 3 (toasts) |
| Verification (manual) | Task 6                      |
| Out of Scope items    | (n/a — intentionally absent) |

No placeholders, no "TBD", no "similar to Task N", no untyped references — every called function (`fetchTaiwanHolidays`, `createHolidayEventsBulk`, `resolveOwnedTeamId`, `useUser`, `useTeamSelection`, `useWorkspaceTeams`) is either defined in this plan or exists in the codebase (verified at plan time).
