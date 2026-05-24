"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";
import { EVENT_TYPE_STYLE, hexToRgba } from "@/lib/calendar/eventType";
import type { BarSegment } from "@/lib/calendar/grid";

// §13.9 — one weekly segment of a multi-day event. Rounded only on the
// segment that contains the event's true start/end; square at week wraps.
// Icon + label render on the leading segment of each week (per spec, the bar
// stays legible after wrapping).
export const MultiDayBar = React.forwardRef<
  HTMLButtonElement,
  {
    segment: BarSegment;
    team: Team | undefined;
    isDark: boolean;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
  }
>(function MultiDayBar({ segment, team, isDark, onClick, className }, ref) {
  const { event, isLeadingSegment, isTrailingSegment } = segment;
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
        "relative flex h-[22px] items-center overflow-hidden border pl-2 pr-2 text-left text-[12px] font-medium text-foreground transition-[background-color] duration-75 hover:brightness-105",
        isLeadingSegment ? "rounded-l-sm" : "rounded-l-none",
        isTrailingSegment ? "rounded-r-sm" : "rounded-r-none",
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
