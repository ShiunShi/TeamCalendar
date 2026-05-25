# Sidebar view counts

Date: 2026-05-25
Status: Approved, ready for implementation plan

## Goal

Show a count beside each row under the **Views** section of the sidebar (`All activity`, `Out today`, `Birthdays this week`).

## Count semantics

| View | Timeframe | Counts |
|---|---|---|
| All activity | The calendar's currently focused month | Total events in the month |
| Out today | Today (real date, not focused month) | Distinct **people** with a PTO/out/sick event overlapping today |
| Birthdays this week | The ISO Mon–Sun week containing today | Birthday events in the week |

Out-today and Birthdays-this-week reuse the existing `eventMatchesPill` predicates from `components/calendar/StatPills.tsx` — no duplicated regex/date logic.

**Important**: `useMonthEvents` subscribes to the year doc(s) the grid spans and returns *all* events in those years (e.g. for May 2026 → all of 2026). The "All activity" count must filter these down to events that actually intersect the focused month — see the implementation note in the Sidebar consumption section.

## Architecture

### New context: `lib/calendar/focusedMonth.tsx`

Tiny provider mirroring `ViewFilterProvider`:

```ts
export function FocusedMonthProvider({ children })
export function useFocusedMonth(): {
  focusedMonth: Date;
  setFocusedMonth: (d: Date) => void;
}
```

Initial value: `startOfMonth(startOfToday())` (matches CalendarView's current default).

### Provider wiring

In `components/layout/Shell.tsx`, wrap children with `<FocusedMonthProvider>` inside `<ViewFilterProvider>`.

### `CalendarView` change

Replace the local `useState<Date>` for `focusedMonth` with `useFocusedMonth()`. Pass `setFocusedMonth` through to existing call sites (`CalendarHeader`, keyboard handlers, `MonthYearPicker`). No behavior change.

### New hook: `lib/hooks/useWeekEvents.ts`

Mirror of `useTodayEvents.ts`:

- Compute the ISO Mon–Sun range containing today via existing `isoWeekRange`.
- Subscribe to the year doc(s) the week spans (1 normally, 2 around Dec/Jan) using `subscribeYear` — same pattern `useMonthEvents` uses for grid year boundaries.
- Return `{ events, loading }` where `events` are filtered to those overlapping any day in the week.

### Sidebar consumption

In `Sidebar.tsx`:

```ts
const { focusedMonth } = useFocusedMonth();
const { events: monthEvents, loading: monthLoading } = useMonthEvents(focusedMonth);
const { events: todayEvents, loading: todayLoading } = useTodayEvents();
const { events: weekEvents,  loading: weekLoading  } = useWeekEvents();

const today = React.useMemo(() => startOfToday(), []);
const week  = React.useMemo(() => isoWeekRange(today), [today]);
const monthRange = React.useMemo(
  () => ({ start: startOfMonth(focusedMonth), end: endOfMonth(focusedMonth) }),
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
    if (eventMatchesPill(e, "out", today, week)) creators.add(e.creatorId);
  }
  return creators.size;
}, [todayEvents, today, week]);

const birthdayCount = React.useMemo(
  () => weekEvents.filter((e) => eventMatchesPill(e, "birthdays", today, week)).length,
  [weekEvents, today, week],
);
```

`eventInterval` already exists in `lib/calendar/grid.ts` — no new helper needed. The intersection test `iv.end >= monthRange.start && iv.start <= monthRange.end` correctly counts multi-day events spanning month boundaries (e.g. April 28 → May 3 counts once for May).

The `views` array gains a per-row `count: number | null` field (null while that row's source is still loading).

## UI rendering

Append a right-aligned count to each view-row button. The label already has `flex-1`, so the count naturally sits on the right edge:

```tsx
<span className="flex-1 truncate text-left">{v.label}</span>
{v.count !== null && (
  <span className="ml-auto tabular-nums text-xs text-muted-foreground">
    {v.count}
  </span>
)}
```

- `tabular-nums` prevents multi-digit counts from wobbling on width changes.
- Color: `text-muted-foreground`. If the active row makes this too dim against `bg-primary/10`, bump to `text-foreground/70` — decide visually during implementation.
- Loading state: `count === null` → render no number (matches user-selected "Show 0, blank during load").
- Zero: render `0`.

## Edge cases

- **Out-today predicate without `creatorId`**: schema guarantees `creatorId`, but as defensive insurance use `event.creatorId || event.eventId` as the Set key, so missing-creator events don't collapse to a single entry.
- **Week crosses year boundary**: `useWeekEvents` subscribes to both years and dedupes by `eventId`, same pattern as `useMonthEvents`.
- **Sidebar collapsed (mobile drawer closed / desktop width 0)**: counts still subscribe — the component is mounted, just visually hidden. Acceptable; subscriptions are cheap and the counts should be ready when the user reopens.

## Out of scope (YAGNI)

- No new view kinds.
- No team-scoped counts (counts ignore `selectedTeamId`).
- No animation on count changes.
- No max-cap ("99+") — real counts will be small.
- No change to the calendar header's `StatPills`. Its pre-existing edge case (today's events absent from the subscription when navigating to a non-current year) is unrelated to this task.

## Verification

- Open the app. Sidebar shows three counts beside the three view rows.
- Counts match what's visible:
  - `All activity` = number of events whose interval intersects `[startOfMonth(focusedMonth), endOfMonth(focusedMonth)]`. Multi-day events spanning a month boundary count once for each month they touch.
  - `Out today` = number of distinct people with a today-overlapping PTO/out/sick event (matches the calendar's existing `StatPills` "out" count exactly).
  - `Birthdays this week` = matches the calendar's existing `StatPills` "birthdays" count exactly.
- Navigate the calendar with ← / → — only `All activity` changes; the other two stay tied to the real today/this-week.
- Initial page load: counts blank briefly, then appear with values (no `0 → N` flash).

## Files touched

- **New**: `lib/calendar/focusedMonth.tsx`
- **New**: `lib/hooks/useWeekEvents.ts`
- **Edit**: `components/layout/Shell.tsx` (wrap children with new provider)
- **Edit**: `components/calendar/CalendarView.tsx` (read focusedMonth from context)
- **Edit**: `components/sidebar/Sidebar.tsx` (subscribe to month/today/week events, compute counts, render count slot in view-row button)
