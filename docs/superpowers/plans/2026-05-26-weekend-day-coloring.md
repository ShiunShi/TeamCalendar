# Weekend Day Coloring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguish Saturday and Sunday columns in the month grid with a shared amber accent on the weekday header label, the day number, and a faint cell background tint — in both light and dark themes.

**Architecture:** Add two new CSS theme tokens (`--weekend`, `--weekend-bg`) to `app/globals.css` for both light and dark, register them in `@theme inline` so Tailwind exposes `text-weekend` and `bg-weekend-bg` utilities, then apply those utilities conditionally in `WeekdayHeader` and `DayCell` based on column index (5 = Sat, 6 = Sun in the Mon-first grid). Today's `--primary` circle is preserved on weekends; out-of-month weekend cells get the tint at reduced opacity.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS v4 (CSS-variable theme), shadcn/ui conventions.

**Spec:** `docs/superpowers/specs/2026-05-26-weekend-day-coloring-design.md`

---

## File Structure

This change touches exactly two files. No new files are created.

- **`app/globals.css`** — add `--weekend` and `--weekend-bg` to both `:root` (light) and `.dark` blocks, and register `--color-weekend` / `--color-weekend-bg` in `@theme inline` so Tailwind generates utilities.
- **`components/calendar/MonthGrid.tsx`** — pass an index into the `WeekdayHeader` map, and add an `isWeekend` branch to `DayCell` that swaps the cell background and the non-today day-number text color.

No tests are added — this is a pure styling change. Verification is visual (dev server) plus `npm run lint` and `npx tsc --noEmit`.

---

## Task 1: Add weekend theme tokens

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Open `app/globals.css` and locate the `@theme inline` block (lines 7–85).** After the existing `--color-team-amber` entry (around line 76) and before the `--radius-sm` line, add two new entries:

```css
  /* Weekend accent — Sat/Sun columns */
  --color-weekend: var(--weekend);
  --color-weekend-bg: var(--weekend-bg);
```

- [ ] **Step 2: In the light theme block (`:root`, starts line 88), add the two weekend variables.** Place them right after the `--focus-ring: #4F46E5;` line (around line 99), before the `/* Event-type fills (light) */` comment:

```css
  /* Weekend accent (light) — used on Sat/Sun in the month grid */
  --weekend: #D97706;       /* amber-700 — header label + day number */
  --weekend-bg: #FEF3C7;    /* amber-100 — faint cell tint */
```

- [ ] **Step 3: In the dark theme block (`.dark`, starts line 150), add the two weekend variables.** Place them right after the `--focus-ring: #6366F1;` line (around line 160), before the `/* Event-type fills (dark) */` comment:

```css
  /* Weekend accent (dark) — used on Sat/Sun in the month grid */
  --weekend: #F59E0B;                       /* amber-500 */
  --weekend-bg: rgba(245, 158, 11, 0.08);   /* very faint amber wash on #0F0F0F */
```

- [ ] **Step 4: Verify Tailwind picks up the new utilities.** Run:

```bash
npx tsc --noEmit
```

Expected: passes with no errors (TypeScript doesn't validate CSS, but this confirms nothing else broke). Tailwind utility availability will be confirmed visually in Task 3.

- [ ] **Step 5: Commit.**

```bash
git add app/globals.css
git commit -m "Add --weekend and --weekend-bg theme tokens"
```

---

## Task 2: Color the Sat/Sun weekday header labels

**Files:**
- Modify: `components/calendar/MonthGrid.tsx:104-118`

- [ ] **Step 1: Replace the entire `WeekdayHeader` function (lines 104–118) with this version.** The change: add an `i` parameter to `labels.map`, and use `cn()` to swap `text-muted-foreground` for `text-weekend` on columns 5 (Sat) and 6 (Sun).

```tsx
function WeekdayHeader() {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="grid grid-cols-7 border-b bg-muted/40">
      {labels.map((label, i) => (
        <div
          key={label}
          className={cn(
            "px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider",
            i === 5 || i === 6 ? "text-weekend" : "text-muted-foreground",
          )}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck.**

```bash
npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Lint.**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 4: Commit.**

```bash
git add components/calendar/MonthGrid.tsx
git commit -m "Color Sat/Sun weekday header labels with --weekend"
```

---

## Task 3: Apply weekend background + day-number color to `DayCell`

**Files:**
- Modify: `components/calendar/MonthGrid.tsx:457-512`

- [ ] **Step 1: Replace the entire `DayCell` function (lines 457–512) with this version.** Changes:
  1. Derive `const isWeekend = col === 5 || col === 6;` near the top.
  2. Outer cell `div`: on weekend columns, swap `bg-card`/`bg-transparent` for `bg-weekend-bg` (in-month) / `bg-weekend-bg/50` (out-of-month). Today and `isOver` styling untouched.
  3. Day-number `div`: leave the `isToday` branch alone (primary circle wins). For non-today, use `text-weekend` (in-month) or `text-weekend/60` (out-of-month) when `isWeekend`.

```tsx
function DayCell({
  cell,
  col,
  focusedMonth,
  todayDay,
  onSelectDate,
}: {
  cell: GridCell;
  col: number;
  focusedMonth: Date;
  todayDay: Date;
  onSelectDate?: (date: Date) => void;
}) {
  const inMonth = isSameMonth(cell.date, focusedMonth);
  const isToday = isSameDay(cell.date, todayDay);
  const isWeekend = col === 5 || col === 6;
  const clickable = Boolean(onSelectDate);
  const { setNodeRef, isOver } = useDroppable({ id: dateKey(cell.date) });
  return (
    <div
      ref={setNodeRef}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onSelectDate!(cell.date) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectDate!(cell.date);
              }
            }
          : undefined
      }
      className={cn(
        "p-2 min-h-[109px]",
        col > 0 && "border-l",
        isWeekend
          ? (inMonth ? "bg-weekend-bg" : "bg-weekend-bg/50")
          : (inMonth ? "bg-card" : "bg-transparent"),
        clickable && "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isOver && "ring-2 ring-primary/40 ring-inset",
      )}
    >
      <div
        className={cn(
          "tabular flex h-[18px] w-fit min-w-[22px] items-center justify-center text-[12px] font-medium",
          isToday
            ? "rounded-full bg-primary px-1.5 text-primary-foreground"
            : isWeekend
              ? (inMonth ? "text-weekend" : "text-weekend/60")
              : (inMonth ? "text-foreground" : "text-muted-foreground/60"),
        )}
      >
        {format(cell.date, "d")}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck.**

```bash
npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Lint.**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 4: Commit.**

```bash
git add components/calendar/MonthGrid.tsx
git commit -m "Tint Sat/Sun cells and color day numbers with --weekend"
```

---

## Task 4: Visual verification

**Files:** none modified; this task is browser verification only.

- [ ] **Step 1: Start the dev server.**

```bash
npm run dev
```

Open http://localhost:3000 in a browser. Sign in if needed and navigate to the calendar (month view).

- [ ] **Step 2: Verify light theme.** Ensure the theme toggle is set to light. Check:
  - The "Sat" and "Sun" column headers render in amber-700 (`#D97706`); Mon–Fri remain in the muted gray.
  - Every Saturday and Sunday cell in the current month shows a faint amber tint (`#FEF3C7`) that's clearly different from neighboring weekday cells.
  - Day numbers inside in-month Sat/Sun cells render in amber-700 (matching the header).
  - Hovering a weekend cell still shows the `hover:bg-muted/40` overlay correctly above the tint.

- [ ] **Step 3: Verify dark theme.** Toggle to dark theme. Check:
  - "Sat" / "Sun" headers render in amber-500 (`#F59E0B`).
  - Weekend cell backgrounds show a very subtle amber wash that's visible against the `#0F0F0F` page bg but not loud.
  - Weekend day numbers render in amber-500.

- [ ] **Step 4: Verify "today on a weekend" edge case.** Navigate to a month where today falls on a Saturday or Sunday (or temporarily change your system date if needed). Confirm:
  - Today's day number still renders as the filled primary circle (white text on `--primary` background) — the weekend amber does NOT override it.
  - The cell background tint and the column header label still show amber.

- [ ] **Step 5: Verify out-of-month leading/trailing days.** Look at the first and last weeks of the month grid (where leading/trailing days from adjacent months appear). Confirm:
  - Out-of-month Sat/Sun cells show the weekend tint at reduced opacity (`bg-weekend-bg/50`), still distinguishable from out-of-month weekday cells.
  - Out-of-month Sat/Sun day numbers render in `text-weekend/60` (a muted amber).

- [ ] **Step 6: Verify drag-and-drop interaction.** If you have a primary team set (so chips are draggable), pick up a chip and drag it over a weekend cell. Confirm:
  - The `ring-2 ring-primary/40 ring-inset` drop-target highlight still renders correctly over the weekend tint.
  - Dropping on a weekend cell behaves identically to dropping on a weekday cell (no regression).

- [ ] **Step 7: Stop the dev server.** Ctrl-C the `npm run dev` process.

- [ ] **Step 8: No commit needed** — this task adds no code. If any of the above checks fails, return to Task 1, 2, or 3 and fix the issue before continuing.

---

## Self-Review Results

**Spec coverage:**
- Theme tokens (light + dark + `@theme inline`) → Task 1 ✓
- WeekdayHeader Sat/Sun coloring → Task 2 ✓
- DayCell background tint (in-month + out-of-month) → Task 3 ✓
- DayCell day-number coloring (in-month + out-of-month, today exemption) → Task 3 ✓
- Verification scenarios from spec §Verification → Task 4 (steps 2–6) ✓

**Placeholder scan:** No TBDs, no "add appropriate X", no "similar to Task N" — every step has either exact code or an exact command.

**Type consistency:** No new TypeScript symbols introduced — only CSS variables and Tailwind utility class names. `isWeekend` is a local `const` in `DayCell` only. `cn()` and `isSameMonth`/`isSameDay` are already imported at the top of `MonthGrid.tsx` (lines 4, 7).
