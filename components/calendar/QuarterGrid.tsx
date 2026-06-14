"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { EVENT_TYPE_STYLE } from "@/lib/calendar/eventType";
import { eventsForDay } from "@/lib/calendar/grid";
import type { Event, EventType, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { DayEventsPopoverContent } from "./DayEventsPopover";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function QuarterGrid({
  focusedMonth,
  events,
  teamsById,
  today,
  isDark,
  onCreateEvent,
  onEditEvent,
}: {
  focusedMonth: Date;
  events: Event[];
  teamsById: Map<string, Team>;
  today: Date;
  isDark: boolean;
  onCreateEvent?: (date: Date) => void;
  onEditEvent?: (event: Event) => void;
}) {
  const months = React.useMemo(
    () => [0, 1, 2].map((offset) => startOfMonth(addMonths(focusedMonth, offset))),
    [focusedMonth],
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto lg:grid-cols-3">
      {months.map((month) => (
        <MiniMonth
          key={month.toISOString()}
          month={month}
          events={events}
          teamsById={teamsById}
          today={today}
          isDark={isDark}
          onCreateEvent={onCreateEvent}
          onEditEvent={onEditEvent}
        />
      ))}
    </div>
  );
}

function MiniMonth({
  month,
  events,
  teamsById,
  today,
  isDark,
  onCreateEvent,
  onEditEvent,
}: {
  month: Date;
  events: Event[];
  teamsById: Map<string, Team>;
  today: Date;
  isDark: boolean;
  onCreateEvent?: (date: Date) => void;
  onEditEvent?: (event: Event) => void;
}) {
  const cells = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const todayDay = React.useMemo(() => startOfDay(today), [today]);

  return (
    <section className="flex min-h-[430px] flex-col overflow-hidden rounded-lg border bg-card">
      <h2 className="border-b px-4 py-3 text-center text-sm font-semibold tabular">
        {format(month, "MMMM yyyy")}
      </h2>
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((label, index) => (
          <div
            key={`${label}:${index}`}
            className={cn(
              "py-2 text-center text-[10px] font-semibold uppercase",
              index > 4 ? "text-weekend" : "text-muted-foreground",
            )}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map((date, index) => {
          const inMonth = isSameMonth(date, month);
          const dayEvents = inMonth ? eventsForDay(events, date) : [];
          return (
            <CompactDay
              key={date.toISOString()}
              date={date}
              inMonth={inMonth}
              isToday={isSameDay(date, todayDay)}
              isWeekend={index % 7 > 4}
              events={dayEvents}
              teamsById={teamsById}
              isDark={isDark}
              onCreateEvent={onCreateEvent}
              onEditEvent={onEditEvent}
            />
          );
        })}
      </div>
    </section>
  );
}

function CompactDay({
  date,
  inMonth,
  isToday,
  isWeekend,
  events,
  teamsById,
  isDark,
  onCreateEvent,
  onEditEvent,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: Event[];
  teamsById: Map<string, Team>;
  isDark: boolean;
  onCreateEvent?: (date: Date) => void;
  onEditEvent?: (event: Event) => void;
}) {
  if (!inMonth) {
    return <div aria-hidden className="border-b border-r bg-muted/10" />;
  }

  const types = [...new Set(events.map((event) => event.type))].slice(0, 3);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${format(date, "EEEE, MMMM d")}, ${events.length} event${events.length === 1 ? "" : "s"}`}
          className={cn(
            "flex min-h-0 flex-col items-center gap-1 border-b border-r px-1 py-1.5 text-xs hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            isWeekend && "bg-weekend-bg",
          )}
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full tabular",
              isToday
                ? "bg-primary text-primary-foreground"
                : isWeekend
                  ? "text-weekend"
                  : "text-foreground",
            )}
          >
            {format(date, "d")}
          </span>
          {events.length > 0 ? (
            <>
              <span className="font-semibold tabular text-muted-foreground">
                {events.length}
              </span>
              <span className="flex gap-0.5" aria-hidden>
                {types.map((type) => (
                  <EventTypeDot key={type} type={type} />
                ))}
              </span>
            </>
          ) : null}
        </button>
      </PopoverTrigger>
      <DayEventsPopoverContent
        date={date}
        events={events}
        teamsById={teamsById}
        isDark={isDark}
        onCreateEvent={onCreateEvent}
        onEditEvent={onEditEvent}
      />
    </Popover>
  );
}

function EventTypeDot({ type }: { type: EventType }) {
  return (
    <span
      className="size-1.5 rounded-full"
      style={{ backgroundColor: EVENT_TYPE_STYLE[type].hue }}
    />
  );
}
