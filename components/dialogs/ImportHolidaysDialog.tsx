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

  // Only teams the user owns are valid import targets (the menu that opens
  // this dialog is already owner-gated; this narrows to the specific team).
  const ownedTeams = React.useMemo(
    () => userDoc?.teams.filter((t) => t.role === "owner") ?? [],
    [userDoc],
  );

  // Default to the user's primary team when they own it, else the first owned
  // team. null until userDoc loads or if the user owns no teams.
  const defaultTeamId = React.useMemo(() => {
    if (ownedTeams.length === 0) return null;
    const primaryOwned = ownedTeams.find(
      (t) => t.teamId === userDoc?.primaryTeamId,
    );
    return (primaryOwned ?? ownedTeams[0]).teamId;
  }, [ownedTeams, userDoc]);

  // Tracks the user's explicit selection; null means "use the default".
  // This persists across open/close cycles (the dialog stays mounted), which
  // is fine: the derived teamId below always falls back to defaultTeamId when
  // the selection is null or no longer points at an owned team.
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(
    null,
  );

  // Effective team id: honour the user's explicit pick if it is still in the
  // owned-teams list; otherwise fall back to the computed default.
  const teamId = React.useMemo(() => {
    if (!open) return null;
    if (selectedTeamId && ownedTeams.some((t) => t.teamId === selectedTeamId))
      return selectedTeamId;
    return defaultTeamId;
  }, [open, selectedTeamId, ownedTeams, defaultTeamId]);

  const yearValid =
    Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
  const canImport =
    !busy && user != null && userDoc != null && yearValid && teamId != null;

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
          creatorId: userDoc!.uid,
          creatorName: userDoc!.name,
          creatorTeamId: teamId!,
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
            <Label htmlFor="holiday-team">Team</Label>
            <select
              id="holiday-team"
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80"
              value={teamId ?? ""}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              disabled={busy}
            >
              {ownedTeams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </select>
          </div>
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
