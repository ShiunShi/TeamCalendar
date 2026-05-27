"use client";

import * as React from "react";
import { toast } from "sonner";

import { useUser } from "@/lib/auth/AuthProvider";
import { fetchTaiwanHolidays } from "@/lib/holidays/taiwan";
import { createHolidayEventsBulk } from "@/lib/db/events";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 1;
const MAX_YEAR = CURRENT_YEAR + 1;

export function ImportHolidaysDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, userDoc } = useUser();
  const [year, setYear] = React.useState<number>(CURRENT_YEAR);
  const [busy, setBusy] = React.useState(false);

  const yearValid =
    Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
  const canImport = !busy && user != null && userDoc != null && yearValid;

  async function onImport() {
    if (!canImport) return;
    setBusy(true);
    try {
      const holidays = await fetchTaiwanHolidays(year);
      if (holidays.length === 0) {
        toast.success(`No public holidays found for ${year}.`);
        onOpenChange(false);
        return;
      }
      const { created, skipped } = await createHolidayEventsBulk(
        year,
        holidays,
        {
          creatorId: "SYSTEM",
          creatorName: "SYSTEM",
          creatorTeamId: "SYSTEM",
        },
      );
      toast.success(
        `Imported ${created} holiday${created === 1 ? "" : "s"} for ${year} (${skipped} already present).`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Taiwan holidays</DialogTitle>
          <DialogDescription>
            Adds Taiwan public-holiday dates to the calendar. Re-imports skip
            duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="holiday-year">Year</Label>
            <Input
              id="holiday-year"
              type="number"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={Number.isFinite(year) ? year : ""}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={busy}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onImport} disabled={!canImport}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
