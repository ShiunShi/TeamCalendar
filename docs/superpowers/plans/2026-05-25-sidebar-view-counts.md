# Sidebar View Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a right-aligned event count beside each row under the Views section of the sidebar — All activity (events in focused month), Out today (distinct people out), Birthdays this week (events in current ISO Mon–Sun week).

**Architecture:** Lift `focusedMonth` from `CalendarView` into a new context provider so both the sidebar and the calendar share the same value. Sidebar consumes three event sources — `useMonthEvents` for All activity, existing `useTodayEvents` for Out today, a new `useWeekEvents` for Birthdays — and computes counts using the existing `eventMatchesPill` predicates and `eventInterval` helper.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Firestore (Web SDK via `subscribeYear`), Tailwind CSS, `date-fns`.

**Verification model:** This project has no test runner installed. Each task verifies via `npx tsc --noEmit` (typecheck), `npm run lint`, and — for UI — manual browser checks against `npm run dev` (http://localhost:3000). Per CLAUDE.md, do not introduce a test framework for this feature.

**Spec:** `docs/superpowers/specs/2026-05-25-sidebar-view-counts-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `lib/calendar/focusedMonth.tsx` | **Create** | React context + provider + `useFocusedMonth` hook owning the calendar's focused month |
| `lib/hooks/useWeekEvents.ts` | **Create** | Subscribe to current ISO Mon–Sun week's year doc(s), return events overlapping any day in the week |
| `components/layout/Shell.tsx` | **Modify** | Wrap children with `<FocusedMonthProvider>` |
| `components/calendar/CalendarView.tsx` | **Modify** | Read `focusedMonth`/`setFocusedMonth` from context instead of local `useState` |
| `components/sidebar/Sidebar.tsx` | **Modify** | Subscribe to month/today/week events, compute counts, render count slot in each view-row button |

---

## Task 1: Create `FocusedMonthProvider` context

**Files:**
- Create: `lib/calendar/focusedMonth.tsx`

- [ ] **Step 1: Create the provider file**

Write `lib/calendar/focusedMonth.tsx`:

```tsx
"use client";

import * as React from "react";
import { startOfMonth, startOfToday } from "date-fns";

interface FocusedMonthContextValue {
  focusedMonth: Date;
  setFocusedMonth: (d: Date) => void;
}

const FocusedMonthContext = React.createContext<FocusedMonthContextValue>({
  focusedMonth: startOfMonth(startOfToday()),
  setFocusedMonth: () => {},
});

export function FocusedMonthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [focusedMonth, setFocusedMonth] = React.useState<Date>(() =>
    startOfMonth(startOfToday()),
  );
  return (
    <FocusedMonthContext.Provider value={{ focusedMonth, setFocusedMonth }}>
      {children}
    </FocusedMonthContext.Provider>
  );
}

export function useFocusedMonth() {
  return React.useContext(FocusedMonthContext);
}
```

This mirrors the existing pattern in `lib/calendar/viewFilter.tsx` (same file structure, same conventions).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). The file is not yet imported anywhere, so this just verifies the file itself compiles.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/calendar/focusedMonth.tsx
git commit -m "Add FocusedMonthProvider context"
```

---

## Task 2: Wire `FocusedMonthProvider` into the Shell

**Files:**
- Modify: `components/layout/Shell.tsx`

- [ ] **Step 1: Add the import**

In `components/layout/Shell.tsx`, alongside the existing context imports, add:

```tsx
import { FocusedMonthProvider } from "@/lib/calendar/focusedMonth";
```

- [ ] **Step 2: Wrap children with the provider**

In the same file, change the JSX from:

```tsx
return (
  <ViewFilterProvider>
    <TeamSelectionProvider>
      <div className="relative flex flex-1 min-h-0">
        {/* ... */}
      </div>
    </TeamSelectionProvider>
  </ViewFilterProvider>
);
```

to (insert `FocusedMonthProvider` just inside `ViewFilterProvider`):

```tsx
return (
  <ViewFilterProvider>
    <FocusedMonthProvider>
      <TeamSelectionProvider>
        <div className="relative flex flex-1 min-h-0">
          {/* ... existing children unchanged ... */}
        </div>
      </TeamSelectionProvider>
    </FocusedMonthProvider>
  </ViewFilterProvider>
);
```

`CalendarView` still owns its own `useState` for `focusedMonth` at this point — that's intentional. Task 3 migrates it.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`
Open http://localhost:3000, sign in, confirm the calendar still loads and month navigation (← / → arrow keys, MonthYearPicker) still works.
Expected: identical behavior to before — provider is mounted but unused.

- [ ] **Step 5: Commit**

```bash
git add components/layout/Shell.tsx
git commit -m "Wrap Shell children with FocusedMonthProvider"
```

---

## Task 3: Migrate `CalendarView` to read `focusedMonth` from context

**Files:**
- Modify: `components/calendar/CalendarView.tsx`

- [ ] **Step 1: Add the import**

In `components/calendar/CalendarView.tsx`, alongside the existing `useViewFilter`/`useTeamSelection` imports, add:

```tsx
import { useFocusedMonth } from "@/lib/calendar/focusedMonth";
```

- [ ] **Step 2: Replace the local `focusedMonth` state with the context hook**

Find this block (around lines 47–50):

```tsx
const today = React.useMemo(() => startOfToday(), []);
const [focusedMonth, setFocusedMonth] = React.useState<Date>(() =>
  startOfMonth(today),
);
```

Change to:

```tsx
const today = React.useMemo(() => startOfToday(), []);
const { focusedMonth, setFocusedMonth } = useFocusedMonth();
```

No other line in `CalendarView` needs to change — every existing consumer of `focusedMonth`/`setFocusedMonth` (the `useMonthEvents` call, `getMonthGrid`, `CalendarHeader`, keyboard handlers) keeps the same identifiers.

- [ ] **Step 3: Remove the now-unused `startOfMonth` import (if applicable)**

`startOfMonth` was used only by the `useState` initializer. The provider now owns that default, so the import is unused in `CalendarView`.

Find:

```tsx
import { addMonths, startOfMonth, startOfToday } from "date-fns";
```

Change to (remove `startOfMonth`):

```tsx
import { addMonths, startOfToday } from "date-fns";
```

(If lint complains about an unused import, this is the fix. If lint passes with `startOfMonth` still present because another reference exists, skip this step.)

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`
Open http://localhost:3000.
- Navigate months with ← / → — calendar grid updates.
- Press `T` — jumps to today's month.
- Open the MonthYearPicker and pick a different month — grid updates.
- Create a Schedule modal (`N` key) — still opens.
Expected: identical behavior to before. The lift is invisible from the user side.

- [ ] **Step 6: Commit**

```bash
git add components/calendar/CalendarView.tsx
git commit -m "Move focusedMonth state into shared context"
```

---

## Task 4: Create `useWeekEvents` hook

**Files:**
- Create: `lib/hooks/useWeekEvents.ts`

- [ ] **Step 1: Write the hook**

Write `lib/hooks/useWeekEvents.ts`:

```ts
"use client";

import * as React from "react";
import { startOfToday } from "date-fns";

import { subscribeYear } from "@/lib/db/events";
import { eventOverlapsDay, isoWeekRange } from "@/lib/calendar/grid";
import type { Event } from "@/lib/types";

// Mirror of useTodayEvents but scoped to the current ISO Mon–Sun week.
// Subscribes to the year doc(s) the week spans (1 normally, 2 across the
// Dec/Jan boundary) and returns events overlapping any day in the week,
// deduped by eventId.
export function useWeekEvents(): { events: Event[]; loading: boolean } {
  const today = React.useMemo(() => startOfToday(), []);
  const week = React.useMemo(() => isoWeekRange(today), [today]);

  const years = React.useMemo(() => {
    const s = week.start.getFullYear();
    const e = week.end.getFullYear();
    return s === e ? [s] : [s, e];
  }, [week]);
  const yearsKey = years.join(",");

  const [byYear, setByYear] = React.useState<Record<number, Event[]>>({});

  React.useEffect(() => {
    const ys = yearsKey.split(",").map(Number);
    const unsubs = ys.map((year) =>
      subscribeYear(year, (events) => {
        setByYear((prev) => ({ ...prev, [year]: events }));
      }),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [yearsKey]);

  const events = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Event[] = [];
    for (const year of years) {
      for (const e of byYear[year] ?? []) {
        if (seen.has(e.eventId)) continue;
        if (!eventOverlapsAnyDayInWeek(e, week.start, week.end)) continue;
        seen.add(e.eventId);
        out.push(e);
      }
    }
    return out;
  }, [byYear, years, week]);

  const loading = years.some((y) => !(y in byYear));

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

This intentionally follows the same shape as `useTodayEvents.ts` (today-overlap filter) and `useMonthEvents.ts` (multi-year dedupe), so the codebase stays consistent.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useWeekEvents.ts
git commit -m "Add useWeekEvents hook"
```

---

## Task 5: Render counts in the Sidebar

**Files:**
- Modify: `components/sidebar/Sidebar.tsx`

- [ ] **Step 1: Update imports**

In `components/sidebar/Sidebar.tsx`, replace the current import block at the top with:

```tsx
"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { endOfMonth, startOfMonth, startOfToday } from "date-fns";

import { useUser } from "@/lib/auth/AuthProvider";
import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
import { useTodayEvents } from "@/lib/hooks/useTodayEvents";
import { useMonthEvents } from "@/lib/hooks/useMonthEvents";
import { useWeekEvents } from "@/lib/hooks/useWeekEvents";
import { useTeamSelection } from "@/lib/calendar/teamSelection";
import { useViewFilter, type ViewKind } from "@/lib/calendar/viewFilter";
import { useFocusedMonth } from "@/lib/calendar/focusedMonth";
import { eventInterval, isoWeekRange } from "@/lib/calendar/grid";
import { eventMatchesPill } from "@/components/calendar/StatPills";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WorkspaceMenu } from "@/components/sidebar/WorkspaceMenu";
import { TeamGroup } from "@/components/sidebar/TeamGroup";
import { CreateTeamDialog } from "@/components/dialogs/CreateTeamDialog";
```

- [ ] **Step 2: Subscribe to month/week events and compute counts**

Inside the `Sidebar` function, **after** the existing `const { events: todayEvents } = useTodayEvents();` line and **before** `const views = ...`, insert:

```tsx
const { focusedMonth } = useFocusedMonth();
const { events: monthEvents, loading: monthLoading } =
  useMonthEvents(focusedMonth);
const { events: weekEvents, loading: weekLoading } = useWeekEvents();

const today = React.useMemo(() => startOfToday(), []);
const week = React.useMemo(() => isoWeekRange(today), [today]);
const monthRange = React.useMemo(
  () => ({
    start: startOfMonth(focusedMonth),
    end: endOfMonth(focusedMonth),
  }),
  [focusedMonth],
);

const allCount = React.useMemo(() => {
  let n = 0;
  for (const e of monthEvents) {
    const iv = eventInterval(e);
    if (!iv) continue;
    if (iv.end >= monthRange.start && iv.start <= monthRange.end) n += 1;
  }
  return n;
}, [monthEvents, monthRange]);

const outCount = React.useMemo(() => {
  const creators = new Set<string>();
  for (const e of todayEvents) {
    if (eventMatchesPill(e, "out", today, week)) {
      // Defensive: schema guarantees creatorId, but fall back to eventId so
      // a missing-creator row doesn't silently collapse into a single bucket.
      creators.add(e.creatorId || e.eventId);
    }
  }
  return creators.size;
}, [todayEvents, today, week]);

const birthdayCount = React.useMemo(
  () =>
    weekEvents.filter((e) => eventMatchesPill(e, "birthdays", today, week))
      .length,
  [weekEvents, today, week],
);
```

Also need a today-loading flag. Update the line:

```tsx
const { events: todayEvents } = useTodayEvents();
```

to:

```tsx
const { events: todayEvents, loading: todayLoading } = useTodayEvents();
```

- [ ] **Step 3: Add `count` to the `views` array**

Replace the current `views` literal:

```tsx
const views: ReadonlyArray<{ icon: string; label: string; kind: ViewKind }> = [
  { icon: "📅", label: "All activity", kind: "all" },
  { icon: "🏖", label: "Out today", kind: "out" },
  { icon: "🎂", label: "Birthdays this week", kind: "birthdays" },
];
```

with:

```tsx
const views: ReadonlyArray<{
  icon: string;
  label: string;
  kind: ViewKind;
  count: number | null;
}> = [
  {
    icon: "📅",
    label: "All activity",
    kind: "all",
    count: monthLoading ? null : allCount,
  },
  {
    icon: "🏖",
    label: "Out today",
    kind: "out",
    count: todayLoading ? null : outCount,
  },
  {
    icon: "🎂",
    label: "Birthdays this week",
    kind: "birthdays",
    count: weekLoading ? null : birthdayCount,
  },
];
```

- [ ] **Step 4: Render the count in the row**

In the same file, find the row JSX inside `views.map(...)`. The current row ends with:

```tsx
<span aria-hidden>{v.icon}</span>
<span className="flex-1 truncate text-left">{v.label}</span>
```

Add a count slot directly after the label span:

```tsx
<span aria-hidden>{v.icon}</span>
<span className="flex-1 truncate text-left">{v.label}</span>
{v.count !== null && (
  <span className="ml-auto tabular-nums text-xs text-muted-foreground">
    {v.count}
  </span>
)}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`
Open http://localhost:3000, sign in to a workspace with events.

Check each row:
- **All activity**: number equals the count of events that overlap *any* day in the currently focused month. Navigate ← / → — the count updates with the month.
- **Out today**: number equals the calendar header's existing `Out today` stat pill (distinct people with a PTO/out/sick event today). Navigate months — count does **not** change.
- **Birthdays this week**: number equals the calendar header's existing `Birthdays this week` stat pill. Navigate months — count does **not** change.
- **Loading**: on initial page load, counts are blank for a moment, then appear (no `0 → N` flash).
- **Zero**: pick a month with no events — `All activity` shows `0` in the same muted style.
- **Active row**: click `All activity` (it becomes the active highlighted row). The count should still be readable. If it looks too dim against the `bg-primary/10` background, change `text-muted-foreground` to `text-foreground/70` in Step 4's JSX and re-verify.

- [ ] **Step 7: Commit**

```bash
git add components/sidebar/Sidebar.tsx
git commit -m "Show event counts beside sidebar view rows"
```

---

## Final verification

- [ ] **Run typecheck and lint together** to catch anything cross-file:

```bash
npx tsc --noEmit && npm run lint
```
Expected: PASS.

- [ ] **End-to-end manual check** (one pass through the spec's verification section):

1. Counts visible on all three view rows.
2. Navigating months changes only `All activity`.
3. `Out today` and `Birthdays this week` numbers match the calendar header's `StatPills` exactly.
4. Initial load shows blank counts briefly, then numbers (no flash from 0).
5. Multi-day event spanning month boundary (e.g. April 28 → May 3) is counted once each in April's and May's `All activity` totals.

---

## Out of scope (do not implement)

- Team-scoped counts (counts ignore `selectedTeamId`).
- New view kinds.
- Animation on count changes.
- A "99+" cap on the count display.
- Any change to `components/calendar/StatPills.tsx`.
