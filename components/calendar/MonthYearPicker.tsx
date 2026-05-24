"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// §7.6 — popover content shown by the clickable month/year header. A year
// stepper sits above a 3×4 month grid. The currently focused month is
// highlighted; clicking any month emits the first-of-month date.
export function MonthYearPickerContent({
  focusedMonth,
  onSelect,
}: {
  focusedMonth: Date;
  onSelect: (date: Date) => void;
}) {
  // Radix Popover unmounts its content on close, so this initializer
  // re-runs every time the picker opens — no need to sync via effect.
  const [year, setYear] = React.useState(focusedMonth.getFullYear());
  const focusedYear = focusedMonth.getFullYear();
  const focusedMonthIndex = focusedMonth.getMonth();

  return (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous year"
          onClick={() => setYear((y) => y - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold tabular">{year}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next year"
          onClick={() => setYear((y) => y + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MONTHS.map((label, idx) => {
          const isFocused = year === focusedYear && idx === focusedMonthIndex;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={isFocused}
              onClick={() => onSelect(new Date(year, idx, 1))}
              className={cn(
                "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isFocused
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
