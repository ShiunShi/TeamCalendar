"use client";

import * as React from "react";
import { toast } from "sonner";

import { useUser } from "@/lib/auth/AuthProvider";
import { useTeamSelection } from "@/lib/calendar/teamSelection";
import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
import { fetchTaiwanHolidays } from "@/lib/holidays/taiwan";
import { createHolidayEventsBulk } from "@/lib/db/events";
import type { Team, UserDoc } from "@/lib/types";
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
  const { selectedTeamId } = useTeamSelection();
  const { teams } = useWorkspaceTeams();
  const [year, setYear] = React.useState<number>(CURRENT_YEAR);
  const [busy, setBusy] = React.useState(false);

  const resolvedTeamId = userDoc
    ? resolveOwnedTeamId(userDoc, selectedTeamId)
    : null;
  const resolvedTeam: Team | null = React.useMemo(() => {
    if (!resolvedTeamId) return null;
    return teams.find((t) => t.teamId === resolvedTeamId) ?? null;
  }, [resolvedTeamId, teams]);

  const yearValid =
    Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
  const canImport =
    !busy &&
    user != null &&
    userDoc != null &&
    resolvedTeamId != null &&
    resolvedTeam != null &&
    yearValid;

  async function onImport() {
    if (!canImport || !user || !userDoc || !resolvedTeam || !resolvedTeamId) {
      return;
    }
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
          creatorId: user.uid,
          creatorName: userDoc.name,
          creatorTeamId: resolvedTeamId,
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
            Adds public-holiday dates as Holiday events attributed to the
            selected team. Re-imports skip duplicates.
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

          <div className="flex flex-col gap-1.5">
            <Label>Team</Label>
            {resolvedTeam ? (
              <div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
                <span
                  className="inline-block size-3 rounded-full"
                  style={{ backgroundColor: resolvedTeam.color }}
                  aria-hidden
                />
                <span>{resolvedTeam.name}</span>
              </div>
            ) : (
              <div className="rounded-md border border-input bg-card px-3 py-2 text-sm text-muted-foreground">
                No team available — you must own at least one team.
              </div>
            )}
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

function resolveOwnedTeamId(
  userDoc: UserDoc,
  selectedTeamId: string | null,
): string | null {
  const owned = userDoc.teams.filter((t) => t.role === "owner");
  if (owned.length === 0) return null;
  if (selectedTeamId && owned.some((t) => t.teamId === selectedTeamId)) {
    return selectedTeamId;
  }
  if (
    userDoc.primaryTeamId &&
    owned.some((t) => t.teamId === userDoc.primaryTeamId)
  ) {
    return userDoc.primaryTeamId;
  }
  return owned[0].teamId;
}
