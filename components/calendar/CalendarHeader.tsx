"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MonthYearPickerContent } from "./MonthYearPicker";

// §7.6 — prev/next/today + clickable month/year title (opens picker) +
// `+ Schedule`.
export function CalendarHeader({
  focusedMonth,
  onPrevious,
  onNext,
  onToday,
  onPickMonth,
  onSchedule,
  scheduleDisabled,
}: {
  focusedMonth: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickMonth: (date: Date) => void;
  onSchedule: () => void;
  scheduleDisabled?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-3">
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
            {format(focusedMonth, "MMMM yyyy")}
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
    </div>
  );
}
