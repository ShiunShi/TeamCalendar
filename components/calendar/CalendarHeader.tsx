"use client";

import * as React from "react";
import { addMonths, format } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CalendarDisplayMode } from "@/lib/calendar/displayMode";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MonthYearPickerContent } from "./MonthYearPicker";
import { CalendarHeaderMenu } from "./CalendarHeaderMenu";

// §7.6 — prev/next/today + clickable month/year title (opens picker) +
// `+ Schedule`.
export function CalendarHeader({
  focusedMonth,
  onPrevious,
  onNext,
  onToday,
  onPickMonth,
  onSchedule,
  displayMode,
  onDisplayModeChange,
  scheduleDisabled,
}: {
  focusedMonth: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickMonth: (date: Date) => void;
  onSchedule: () => void;
  displayMode: CalendarDisplayMode;
  onDisplayModeChange: (mode: CalendarDisplayMode) => void;
  scheduleDisabled?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const title = displayMode === "quarter"
    ? `${format(focusedMonth, "MMM")}–${format(addMonths(focusedMonth, 2), "MMM yyyy")}`
    : format(focusedMonth, "MMMM yyyy");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Pick month"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-lg font-semibold tracking-tight tabular",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {title}
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <MonthYearPickerContent
            focusedMonth={focusedMonth}
            onSelect={(date) => {
              onPickMonth(date);
              setPickerOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          onClick={onPrevious}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToday}
        >
          Today
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next month"
          onClick={onNext}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div
        role="group"
        aria-label="Calendar display"
        className="flex rounded-lg border bg-background p-0.5"
      >
        {(["month", "quarter"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={displayMode === mode}
            onClick={() => onDisplayModeChange(mode)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              displayMode === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {mode}
          </button>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        onClick={onSchedule}
        disabled={scheduleDisabled}
        aria-keyshortcuts="n"
      >
        <Plus className="size-4" />
        <span className="ml-1">Schedule</span>
      </Button>
      <CalendarHeaderMenu />
    </div>
  );
}
