"use client";

import * as React from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";

import type { Event, Team } from "@/lib/types";
import { EVENT_TYPE_STYLE, hexToRgba } from "@/lib/calendar/eventType";
import { eventInterval } from "@/lib/calendar/grid";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";

// §7.5 — opens from a cell's `+N more` button. Lists every event on the given
// day (single + multi-day). Clicking a row delegates to the same edit path the
// chip popover uses, so users land in ScheduleDialog directly.
export function DayEventsPopoverContent({
  date,
  events,
  teamsById,
  isDark,
  onCreateEvent,
  onEditEvent,
}: {
  date: Date;
  events: Event[];
  teamsById: Map<string, Team>;
  isDark: boolean;
  onCreateEvent?: (date: Date) => void;
  onEditEvent?: (event: Event) => void;
}) {
  return (
    <PopoverContent align="start" sideOffset={6} className="w-72">
      <PopoverHeader>
        <PopoverTitle className="text-sm font-medium tabular">
          {format(date, "EEEE, MMM d")}
        </PopoverTitle>
      </PopoverHeader>
      <div className="flex flex-col gap-1">
        {events.length > 0 ? (
          events.map((event) => (
            <DayEventRow
              key={event.eventId}
              event={event}
              team={teamsById.get(event.creatorTeamId)}
              isDark={isDark}
              onSelect={onEditEvent}
            />
          ))
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">No events</p>
        )}
      </div>
      {onCreateEvent ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onCreateEvent(date)}>
          <Plus className="size-3.5" />
          Add event
        </Button>
      ) : null}
    </PopoverContent>
  );
}

function DayEventRow({
  event,
  team,
  isDark,
  onSelect,
}: {
  event: Event;
  team: Team | undefined;
  isDark: boolean;
  onSelect?: (event: Event) => void;
}) {
  const style = EVENT_TYPE_STYLE[event.type];
  const Icon = style.icon;
  const fillAlpha = isDark ? 0.18 : 0.12;
  const borderAlpha = isDark ? 0.3 : 0.2;
  const teamColor = team?.color ?? "#9CA3AF";
  const interval = eventInterval(event);
  const dateLabel = !interval
    ? ""
    : interval.isMultiDay
      ? `${format(interval.start, "MMM d")} – ${format(interval.end, "MMM d")}`
      : "";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      disabled={!onSelect}
      className={cn(
        "relative flex items-center gap-2 overflow-hidden rounded-sm border px-2 py-1.5 text-left text-[12px] transition-[background-color] duration-75",
        "hover:brightness-105 disabled:cursor-default",
      )}
      style={{
        backgroundColor: hexToRgba(style.hue, fillAlpha),
        borderColor: hexToRgba(style.hue, borderAlpha),
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{ backgroundColor: teamColor }}
      />
      <Icon
        aria-hidden
        className="ml-1 size-3.5 shrink-0"
        style={{ color: style.hue }}
      />
      <span className="flex-1 truncate font-medium text-foreground">
        {event.title}
      </span>
      {dateLabel ? (
        <span className="shrink-0 text-[10px] text-muted-foreground tabular">
          {dateLabel}
        </span>
      ) : null}
    </button>
  );
}
