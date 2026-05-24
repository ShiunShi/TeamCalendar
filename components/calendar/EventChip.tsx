"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { Event, Team } from "@/lib/types";
import { EVENT_TYPE_STYLE, hexToRgba } from "@/lib/calendar/eventType";

// §13.8 — 22px single-day chip. Tinted-transparent fill from type, 2px team
// stripe from team color. Click bubbles up to the parent (CalendarView wires
// it to EventPopover).
export const EventChip = React.forwardRef<
  HTMLButtonElement,
  {
    event: Event;
    team: Team | undefined;
    isDark: boolean;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
  }
>(function EventChip({ event, team, isDark, onClick, className }, ref) {
  const style = EVENT_TYPE_STYLE[event.type];
  const Icon = style.icon;
  const fillAlpha = isDark ? 0.18 : 0.12;
  const borderAlpha = isDark ? 0.3 : 0.2;
  const teamColor = team?.color ?? "#9CA3AF";

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-[22px] w-full items-center overflow-hidden rounded-sm border pl-2 pr-2 text-left text-[12px] font-medium text-foreground transition-[background-color] duration-75",
        "hover:brightness-105",
        className,
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
        className="mr-1 size-3 shrink-0"
        style={{ color: style.hue }}
      />
      <span className="truncate">
        {event.title}
        <span className="ml-1.5 font-normal text-muted-foreground">
          {event.creatorName}
        </span>
        {event.description ? (
          <span className="ml-1.5 font-normal text-muted-foreground/70">
            {event.description}
          </span>
        ) : null}
      </span>
    </button>
  );
});
