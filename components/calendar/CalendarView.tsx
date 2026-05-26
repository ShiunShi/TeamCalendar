"use client";

import * as React from "react";
import { addMonths, startOfMonth, startOfToday } from "date-fns";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { useUser } from "@/lib/auth/AuthProvider";
import type { Event, Team } from "@/lib/types";
import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
import { useMonthEvents } from "@/lib/hooks/useMonthEvents";
import { getMonthGrid, isoWeekRange } from "@/lib/calendar/grid";
import { useTeamSelection } from "@/lib/calendar/teamSelection";
import { eventMatchesView, useViewFilter } from "@/lib/calendar/viewFilter";
import { useFocusedMonth } from "@/lib/calendar/focusedMonth";
import {
  eventToInput,
  parseDateKey,
  shiftEvent,
} from "@/lib/calendar/dragMove";
import { updateEvent } from "@/lib/db/events";
import {
  ScheduleDialog,
  type ScheduleMode,
} from "@/components/dialogs/ScheduleDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CalendarHeader } from "./CalendarHeader";
import { EventChip } from "./EventChip";
import { MonthGrid } from "./MonthGrid";

// Composes the calendar view. Owns focusedMonth, the team-filter selection
// (client-local per §7.4), the Schedule modal state, and the drag-move
// optimistic-pending map. Keyboard shortcuts: ←/→ step months, T jumps to
// today, N opens the Schedule modal.
export function CalendarView() {
  const today = React.useMemo(() => startOfToday(), []);
  const { focusedMonth, setFocusedMonth } = useFocusedMonth();
  const [scheduleMode, setScheduleMode] = React.useState<ScheduleMode | null>(
    null,
  );
  const { activeView } = useViewFilter();
  const { selectedTeamId } = useTeamSelection();

  // §7.7 — drag-to-move. `pending` holds the post-drag shape of any event
  // mid-flight; `activeDrag` tracks the current pointer-followed clone.
  const [pending, setPending] = React.useState<Map<string, Event>>(() => new Map());
  const [activeDrag, setActiveDrag] = React.useState<Event | null>(null);

  const { userDoc } = useUser();
  const { teams } = useWorkspaceTeams();
  const { events: allEvents } = useMonthEvents(focusedMonth);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const canSchedule = Boolean(userDoc?.primaryTeamId);

  const cells = React.useMemo(() => getMonthGrid(focusedMonth), [focusedMonth]);
  const teamsById = React.useMemo<Map<string, Team>>(
    () => new Map(teams.map((t) => [t.teamId, t])),
    [teams],
  );

  // §7.7 — overlay pending drag-move state on top of the snapshot stream so
  // the grid reflects the new position immediately. Once Firestore confirms,
  // the `finally` in onDragEnd clears the pending entry and identity returns
  // to allEvents.
  const baseEvents = React.useMemo(() => {
    if (pending.size === 0) return allEvents;
    return allEvents.map((e) => pending.get(e.eventId) ?? e);
  }, [allEvents, pending]);

  // §7.4 — single-select team filter. null means "All" (no filter).
  const teamFilteredEvents = React.useMemo(() => {
    if (!selectedTeamId) return baseEvents;
    return baseEvents.filter((e) => e.creatorTeamId === selectedTeamId);
  }, [baseEvents, selectedTeamId]);

  const weekRange = React.useMemo(() => isoWeekRange(today), [today]);

  // §7.3 — view filter is applied between team filter and pill filter so
  // that pill counts (built from teamFilteredEvents) don't depend on which
  // view is active, but the active pill still narrows further.
  const filteredEvents = React.useMemo(() => {
    if (activeView === "all") return teamFilteredEvents;
    return teamFilteredEvents.filter((e) =>
      eventMatchesView(e, activeView, today, weekRange),
    );
  }, [teamFilteredEvents, activeView, today, weekRange]);

  // Keyboard shortcuts — bound at the window so they work even when no input
  // has focus. Ignore when typing in an input/textarea.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") setFocusedMonth((m) => addMonths(m, -1));
      else if (e.key === "ArrowRight") setFocusedMonth((m) => addMonths(m, 1));
      else if (e.key === "t" || e.key === "T") setFocusedMonth(startOfMonth(today));
      else if (e.key === "n" || e.key === "N") {
        if (canSchedule) setScheduleMode({ kind: "create" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [today, canSchedule, setFocusedMonth]);

  const openCreateForDate = (date: Date) => {
    if (!canSchedule) return;
    setScheduleMode({ kind: "create", defaultDate: date });
  };

  const openEdit = (event: Event) => {
    setScheduleMode({ kind: "edit", event });
  };

  // §7.7 — drag sensors. PointerSensor's 8-px distance gate preserves the
  // existing click-on-chip → popover and click-on-cell → Schedule-modal
  // behaviors. KeyboardSensor uses the grid's measured droppable size to step
  // by one cell per arrow press.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: weekGridCoordinateGetter }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const event = (e.active.data.current as { event?: Event } | undefined)
      ?.event;
    if (event) setActiveDrag(event);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const event = (active.data.current as { event?: Event } | undefined)?.event;
    if (!event) return;

    const dropDay = parseDateKey(String(over.id));
    const moved = shiftEvent(event, dropDay);
    if (!moved) return;

    setPending((p) => new Map(p).set(event.eventId, moved));
    try {
      await updateEvent(event.eventId, eventToInput(moved), event);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Failed to move event.");
    } finally {
      setPending((p) => {
        const m = new Map(p);
        m.delete(event.eventId);
        return m;
      });
    }
  };

  const onDragCancel = () => setActiveDrag(null);

  return (
    <TooltipProvider delayDuration={500}>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex flex-1 flex-col gap-4 p-6">
          <CalendarHeader
            focusedMonth={focusedMonth}
            onPrevious={() => setFocusedMonth((m) => addMonths(m, -1))}
            onNext={() => setFocusedMonth((m) => addMonths(m, 1))}
            onToday={() => setFocusedMonth(startOfMonth(today))}
            onPickMonth={(date) => setFocusedMonth(startOfMonth(date))}
            onSchedule={() => setScheduleMode({ kind: "create" })}
            scheduleDisabled={!canSchedule}
          />

          <MonthGrid
            cells={cells}
            events={filteredEvents}
            teamsById={teamsById}
            focusedMonth={focusedMonth}
            today={today}
            isDark={isDark}
            dragEnabled={canSchedule}
            onSelectDate={canSchedule ? openCreateForDate : undefined}
            onEditEvent={openEdit}
          />

          {scheduleMode ? (
            <ScheduleDialog
              open
              onOpenChange={(open) => {
                if (!open) setScheduleMode(null);
              }}
              mode={scheduleMode}
            />
          ) : null}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="w-full opacity-90">
              <EventChip
                event={activeDrag}
                team={teamsById.get(activeDrag.creatorTeamId)}
                isDark={isDark}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </TooltipProvider>
  );
}

// Translate arrow keys into one-cell-of-the-month-grid moves. @dnd-kit's
// collision detection finds the droppable closest to the returned point.
const weekGridCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context },
) => {
  const arrows: Record<string, [number, number]> = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowUp: [0, -1],
  };
  const dir = arrows[event.code];
  if (!dir) return undefined;
  event.preventDefault();
  const rects = context.droppableRects;
  const firstRect = rects.values().next().value;
  if (!firstRect) return undefined;
  return {
    x: currentCoordinates.x + dir[0] * firstRect.width,
    y: currentCoordinates.y + dir[1] * firstRect.height,
  };
};
