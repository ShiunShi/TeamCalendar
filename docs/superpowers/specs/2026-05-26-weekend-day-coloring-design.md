# Weekend Day Coloring — Design

**Date:** 2026-05-26
**Status:** Approved (design); pending implementation plan

## Goal

In the month grid, visually distinguish Saturday and Sunday from weekdays. Both weekend days share a single amber accent applied to the weekday header label, the day number inside each cell, and a faint cell background tint. Coloring works in both light and dark themes via theme tokens.

## Non-Goals

- No per-day distinction (Sat ≠ Sun colors).
- No internationalization toggle (week-start stays Monday-first as it is today).
- No coloring of event chips, multi-day bars, popovers, or the sidebar.
- No new tests — pure styling change verified visually.

## Decisions

| Question | Decision |
|---|---|
| Color scheme | Both weekend days use the same accent. |
| Placement | (1) WeekdayHeader label, (2) day-number text, (3) cell background tint. |
| Accent color | New dedicated `--weekend` theme token, amber/orange family. |
| Today on a weekend | Today's filled circle keeps `--primary`; weekend bg + header label still show. |
| Out-of-month weekend days | Full weekend treatment (bg tint + amber number), with the existing muted opacity preserved. |

## Theme Tokens (`app/globals.css`)

Add to **light** `:root`:

```css
--weekend: #D97706;       /* amber-700 — day number + header label */
--weekend-bg: #FEF3C7;    /* amber-100 — faint cell tint */
```

Add to **dark** `.dark`:

```css
--weekend: #F59E0B;                       /* amber-500 */
--weekend-bg: rgba(245, 158, 11, 0.08);   /* very faint amber wash on #0F0F0F */
```

Add to `@theme inline` so Tailwind exposes `text-weekend` and `bg-weekend-bg` utilities:

```css
--color-weekend: var(--weekend);
--color-weekend-bg: var(--weekend-bg);
```

## Component Changes (`components/calendar/MonthGrid.tsx`)

### `WeekdayHeader` (lines 104–118)

Switch from `labels.map((label) => …)` to `labels.map((label, i) => …)`. When `i === 5 || i === 6` (Sat/Sun in the Mon-first grid), override `text-muted-foreground` with `text-weekend`:

```tsx
className={cn(
  "px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider",
  i === 5 || i === 6 ? "text-weekend" : "text-muted-foreground",
)}
```

### `DayCell` (lines 457–512)

Introduce `const isWeekend = col === 5 || col === 6;` at the top.

**Outer cell `div`** — on weekend columns, swap the `inMonth ? "bg-card" : "bg-transparent"` choice for the weekend tint. In-month weekend cells get `bg-weekend-bg`; out-of-month weekend cells get `bg-weekend-bg/50` to preserve the muted look:

```tsx
isWeekend
  ? (inMonth ? "bg-weekend-bg" : "bg-weekend-bg/50")
  : (inMonth ? "bg-card" : "bg-transparent"),
```

**Day-number `div`** — `isToday` branch is unchanged (primary circle wins). For the non-today branches, apply `text-weekend` when `isWeekend`, preserving muted opacity for out-of-month:

```tsx
isToday
  ? "rounded-full bg-primary px-1.5 text-primary-foreground"
  : isWeekend
    ? (inMonth ? "text-weekend" : "text-weekend/60")
    : (inMonth ? "text-foreground" : "text-muted-foreground/60"),
```

## Interaction with existing styles

- `hover:bg-muted/40`, `isOver` ring, focus ring — all stack above the weekend bg via existing class order; no changes needed.
- Multi-day bars and single-day chips render in the absolute overlay (`MonthGrid.tsx:275`), unaffected by cell background.
- Today's filled `--primary` circle visually dominates the amber day-number on weekends, by design.

## Files Touched

- `app/globals.css` — 4 token declarations + 2 `@theme inline` entries.
- `components/calendar/MonthGrid.tsx` — index parameter in `WeekdayHeader.map`; one `isWeekend` const and two conditional class blocks in `DayCell`.

No other files. No new dependencies. No new tests.

## Verification

Run `npm run dev` and check in the browser:

1. **Light theme** — weekday header "Sat"/"Sun" are amber-700; weekend cells show faint amber tint; weekend day numbers are amber-700.
2. **Dark theme** — header labels amber-500; cell tint is a very faint amber wash that's visible but not loud; day numbers amber-500.
3. **Today on a weekend** — primary-colored circle still wraps the day number; cell tint and header label remain amber.
4. **Leading/trailing days** — out-of-month Sat/Sun cells still show the (lighter) amber tint and a muted amber day number.
5. **Hover/drop-target ring** — hover and `isOver` ring still render correctly over the weekend tint.
6. **`npm run lint` and `npx tsc --noEmit`** pass.
