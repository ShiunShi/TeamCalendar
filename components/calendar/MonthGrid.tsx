"use client";

import * as React from "react";
import { format, isSameDay, isSameMonth, startOfDay } from "date-fns";
import { useDraggable, useDroppable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import type { Event, Team } from "@/lib/types";
import {
  type BarSegment,
  type GridCell,
  eventInterval,
  eventsForDay,
  splitEventToSegments,
} from "@/lib/calendar/grid";
import {
  dateKey,
  dragIdForBar,
  dragIdForChip,
} from "@/lib/calendar/dragMove";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EventChip } from "./EventChip";
import { MultiDayBar } from "./MultiDayBar";
import { EventPopoverContent } from "./EventPopover";
import { DayEventsPopoverContent } from "./DayEventsPopover";

const CHIP_HEIGHT = 22;
const CHIP_GAP = 3;
// Reserve space at the cell top for the day-number row before bars/chips.
const CELL_TOP_INSET = 26;
// §7.5 — cells render at most 3 stacked rows. When a column has more events,
// rows 0–1 show chips and row 2 becomes "+N more". A 109px floor is enforced
// on each cell (`min-h-[109px]` in DayCell) so chips always fit; the grid
// itself stretches to fill the viewport via `flex-1` + `grid-rows-6` so any
// extra vertical space is distributed evenly across the 6 weeks.
// Floor = CELL_TOP_INSET + MAX_VISIBLE_SLOTS * (CHIP_HEIGHT + CHIP_GAP) + 8
//       = 26 + 3 * 25 + 8 = 109.
const MAX_VISIBLE_SLOTS = 3;

interface MonthGridProps {
  cells: GridCell[];
  events: Event[];
  teamsById: Map<string, Team>;
  focusedMonth: Date;
  today: Date;
  isDark: boolean;
  // §7.7 — drag-move is gated on the same "user has a primary team" check
  // as the + Schedule button. When false, chips render as plain non-draggable
  // buttons (popover/edit still work).
  dragEnabled?: boolean;
  onSelectDate?: (date: Date) => void;
  onEditEvent?: (event: Event) => void;
}

// §7.5 + §13.7 — 6×7 month grid. Multi-day bars are rendered in a per-row
// overlay using CSS grid for column spanning; single-day chips are stacked
// inside each cell at the slot indices left over after bars are placed.
export function MonthGrid({
  cells,
  events,
  teamsById,
  focusedMonth,
  today,
  isDark,
  dragEnabled = false,
  onSelectDate,
  onEditEvent,
}: MonthGridProps) {
  const todayDay = React.useMemo(() => startOfDay(today), [today]);

  const weeks = React.useMemo(
    () => buildWeekLayouts(cells, events),
    [cells, events],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
      <WeekdayHeader />
      <div className="grid min-h-0 flex-1 grid-rows-6">
        {weeks.map((week, weekIndex) => (
          <WeekRow
            key={weekIndex}
            week={week}
            weekIndex={weekIndex}
            focusedMonth={focusedMonth}
            todayDay={todayDay}
            teamsById={teamsById}
            isDark={isDark}
            dragEnabled={dragEnabled}
            onSelectDate={onSelectDate}
            onEditEvent={onEditEvent}
          />
        ))}
      </div>
    </div>
  );
}

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

interface WeekLayout {
  cells: GridCell[];
  // Bar segments to render this week. Each one's `slot` is below the cutoff
  // for every column it spans; otherwise the segment is hidden and its event
  // surfaces only via the +N more popover.
  visibleSegments: Array<BarSegment & { slot: number }>;
  // For each column (0..6) → single-day events to render (slot < cutoff).
  visibleSingleByCol: Array<Array<{ event: Event; slot: number }>>;
  // For each column, the +N more count (0 when there's no overflow).
  overflowCountByCol: number[];
  // For each column, the full day's events — feeds the +N more popover.
  allEventsByCol: Event[][];
}

function buildWeekLayouts(cells: GridCell[], events: Event[]): WeekLayout[] {
  const weeks: WeekLayout[] = [];
  for (let w = 0; w < 6; w++) {
    const weekCells = cells.slice(w * 7, w * 7 + 7);
    const used: Set<number>[] = Array.from({ length: 7 }, () => new Set<number>());

    // 1) Multi-day segments overlapping this week — wider first for predictable layout.
    const segments: Array<BarSegment & { slot: number }> = [];
    for (const e of events) {
      for (const seg of splitEventToSegments(e, cells)) {
        if (seg.weekIndex === w && seg.span > 1) {
          segments.push({ ...seg, slot: -1 });
        }
      }
    }
    segments.sort((a, b) => b.span - a.span || a.startCol - b.startCol);
    for (const seg of segments) {
      let slot = 0;
      while (true) {
        let ok = true;
        for (let c = seg.startCol; c < seg.startCol + seg.span; c++) {
          if (used[c].has(slot)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          for (let c = seg.startCol; c < seg.startCol + seg.span; c++) {
            used[c].add(slot);
          }
          seg.slot = slot;
          break;
        }
        slot++;
      }
    }

    // 2) Single-day events per column.
    const singleByCol: Array<Array<{ event: Event; slot: number }>> = [];
    for (let col = 0; col < 7; col++) {
      const day = weekCells[col].date;
      const dayEvents = eventsForDay(events, day).filter((e) => {
        // Skip true multi-day events — they're already handled as segments.
        if (!e.isSingleDay && e.startDate && e.endDate) {
          return e.startDate.toMillis() === e.endDate.toMillis();
        }
        return true;
      });
      dayEvents.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
      const out: Array<{ event: Event; slot: number }> = [];
      let slot = 0;
      for (const ev of dayEvents) {
        while (used[col].has(slot)) slot++;
        used[col].add(slot);
        out.push({ event: ev, slot });
        slot++;
      }
      singleByCol.push(out);
    }

    // 3) Apply the slot cap. Each column whose used-slot count exceeds the
    // limit drops its highest-slot items to make room for the +N more row.
    const totalByCol = used.map((s) => (s.size === 0 ? 0 : Math.max(...s) + 1));
    const cutoffByCol = totalByCol.map((n) =>
      n > MAX_VISIBLE_SLOTS ? MAX_VISIBLE_SLOTS - 1 : MAX_VISIBLE_SLOTS,
    );

    const visibleSegments = segments.filter((seg) => {
      for (let c = seg.startCol; c < seg.startCol + seg.span; c++) {
        if (seg.slot >= cutoffByCol[c]) return false;
      }
      return true;
    });
    const visibleSingleByCol = singleByCol.map((dayEvents, col) =>
      dayEvents.filter(({ slot }) => slot < cutoffByCol[col]),
    );

    // 4) For each column, compute the full event list (used for the popover)
    // and the +N more count.
    const allEventsByCol: Event[][] = [];
    const overflowCountByCol: number[] = [];
    for (let col = 0; col < 7; col++) {
      const day = weekCells[col].date;
      const allEvents = eventsForDay(events, day);
      allEvents.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
      allEventsByCol.push(allEvents);

      const visibleCountInCol =
        visibleSingleByCol[col].length +
        visibleSegments.filter(
          (seg) => col >= seg.startCol && col < seg.startCol + seg.span,
        ).length;
      overflowCountByCol.push(Math.max(0, allEvents.length - visibleCountInCol));
    }

    weeks.push({
      cells: weekCells,
      visibleSegments,
      visibleSingleByCol,
      overflowCountByCol,
      allEventsByCol,
    });
  }
  return weeks;
}

function WeekRow({
  week,
  weekIndex,
  focusedMonth,
  todayDay,
  teamsById,
  isDark,
  dragEnabled,
  onSelectDate,
  onEditEvent,
}: {
  week: WeekLayout;
  weekIndex: number;
  focusedMonth: Date;
  todayDay: Date;
  teamsById: Map<string, Team>;
  isDark: boolean;
  dragEnabled: boolean;
  onSelectDate?: (date: Date) => void;
  onEditEvent?: (event: Event) => void;
}) {
  return (
    <div className={cn("relative grid min-h-0 grid-cols-7", weekIndex > 0 && "border-t")}>
      {week.cells.map((cell, col) => (
        <DayCell
          key={cell.date.toISOString()}
          cell={cell}
          col={col}
          focusedMonth={focusedMonth}
          todayDay={todayDay}
          onSelectDate={onSelectDate}
        />
      ))}

      {/* Overlay: multi-day bars + single-day chips + +N more buttons. */}
      <div
        className="pointer-events-none absolute inset-0 grid grid-cols-7"
        style={{ paddingTop: CELL_TOP_INSET }}
      >
        {week.visibleSegments.map((seg) => (
          <div
            key={`${seg.event.eventId}:${weekIndex}`}
            className="pointer-events-auto px-1"
            onClick={(e) => e.stopPropagation()}
            style={{
              gridColumn: `${seg.startCol + 1} / span ${seg.span}`,
              gridRow: 1,
              marginTop: seg.slot * (CHIP_HEIGHT + CHIP_GAP),
              height: CHIP_HEIGHT,
            }}
          >
            <ChipWithPopover
              event={seg.event}
              team={teamsById.get(seg.event.creatorTeamId)}
              dragId={dragIdForBar(seg.event.eventId, weekIndex)}
              dragEnabled={dragEnabled}
              onEdit={onEditEvent}
            >
              <MultiDayBar
                segment={seg}
                team={teamsById.get(seg.event.creatorTeamId)}
                isDark={isDark}
                className="w-full"
              />
            </ChipWithPopover>
          </div>
        ))}

        {week.visibleSingleByCol.flatMap((dayEvents, col) =>
          dayEvents.map(({ event, slot }) => (
            <div
              key={`${event.eventId}:${col}`}
              className="pointer-events-auto px-1"
              onClick={(e) => e.stopPropagation()}
              style={{
                gridColumn: `${col + 1} / span 1`,
                gridRow: 1,
                marginTop: slot * (CHIP_HEIGHT + CHIP_GAP),
                height: CHIP_HEIGHT,
              }}
            >
              <ChipWithPopover
                event={event}
                team={teamsById.get(event.creatorTeamId)}
                dragId={dragIdForChip(event.eventId)}
                dragEnabled={dragEnabled}
                onEdit={onEditEvent}
              >
                <EventChip
                  event={event}
                  team={teamsById.get(event.creatorTeamId)}
                  isDark={isDark}
                />
              </ChipWithPopover>
            </div>
          )),
        )}

        {week.overflowCountByCol.map((count, col) =>
          count > 0 ? (
            <div
              key={`more:${col}`}
              className="pointer-events-auto px-1"
              onClick={(e) => e.stopPropagation()}
              style={{
                gridColumn: `${col + 1} / span 1`,
                gridRow: 1,
                marginTop: (MAX_VISIBLE_SLOTS - 1) * (CHIP_HEIGHT + CHIP_GAP),
                height: CHIP_HEIGHT,
              }}
            >
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Show ${count} more event${count === 1 ? "" : "s"}`}
                    className="flex h-[22px] w-full items-center rounded-sm px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    +{count} more
                  </button>
                </PopoverTrigger>
                <DayEventsPopoverContent
                  date={week.cells[col].date}
                  events={week.allEventsByCol[col]}
                  teamsById={teamsById}
                  isDark={isDark}
                  onEditEvent={onEditEvent}
                />
              </Popover>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

// Composes Tooltip + Popover (+ optional drag handle) around a chip/bar.
// Hover shows the styled tooltip; click opens the event detail popover (the
// 8-px activation gate in CalendarView's PointerSensor disambiguates from
// drag). When dragEnabled, mounts useDraggable on the outer wrapper so the
// chip can be picked up and moved to another DayCell droppable.
function ChipWithPopover({
  event,
  team,
  dragId,
  dragEnabled,
  onEdit,
  children,
}: {
  event: Event;
  team: Team | undefined;
  dragId: string;
  dragEnabled: boolean;
  onEdit?: (event: Event) => void;
  children: React.ReactElement;
}) {
  const interval = eventInterval(event);
  const dateLabel = !interval
    ? "Invalid date"
    : interval.isMultiDay
      ? `${format(interval.start, "EEE, MMM d")} – ${format(interval.end, "EEE, MMM d, yyyy")}`
      : format(interval.start, "EEE, MMM d, yyyy");

  return (
    <DraggableShell event={event} dragId={dragId} dragEnabled={dragEnabled}>
      <Popover>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="top" sideOffset={4}>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{event.title}</span>
              <span className="text-[10px] opacity-80 tabular">{dateLabel}</span>
            </div>
          </TooltipContent>
        </Tooltip>
        <EventPopoverContent event={event} team={team} onEdit={onEdit} />
      </Popover>
    </DraggableShell>
  );
}

function DraggableShell({
  event,
  dragId,
  dragEnabled,
  children,
}: {
  event: Event;
  dragId: string;
  dragEnabled: boolean;
  children: React.ReactNode;
}) {
  // useDraggable always runs (hooks order), but when dragEnabled is false we
  // simply don't attach the listeners/attributes so the chip stays a plain
  // button.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { event },
    disabled: !dragEnabled,
  });
  if (!dragEnabled) return <>{children}</>;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Move event"
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      {children}
    </div>
  );
}

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
