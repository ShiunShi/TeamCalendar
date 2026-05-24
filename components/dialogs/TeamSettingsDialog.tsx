"use client";

import * as React from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTeam,
  recolorTeam,
  renameTeam,
} from "@/lib/db/teams";
import { createInvite, revokeAllInvitesForTeam } from "@/lib/db/invites";
import type { Team, TeamColorHex } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorSwatchGrid } from "@/components/dialogs/CreateTeamDialog";
import { InviteLinkRow } from "@/components/dialogs/InviteLinkRow";
import { DeleteTeamConfirm } from "@/components/dialogs/DeleteTeamConfirm";

// Owner-only — opened from TeamGroup's settings affordance.
export function TeamSettingsDialog({
  open,
  onOpenChange,
  team,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
}) {
  const [name, setName] = React.useState(team.name);
  const [color, setColor] = React.useState<TeamColorHex>(team.color);
  const [busy, setBusy] = React.useState<"save" | "invite" | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Radix Dialog unmounts content when `open` is false, so the useState
  // initializers above (team.name, team.color) re-evaluate on each open
  // and the form picks up any live edits made elsewhere automatically.

  const dirty = name.trim() !== team.name || color !== team.color;
  const nameError = name.trim().length === 0;

  const save = async () => {
    if (nameError || !dirty) return;
    setBusy("save");
    try {
      const trimmed = name.trim();
      if (trimmed !== team.name) await renameTeam(team.teamId, trimmed);
      if (color !== team.color) await recolorTeam(team.teamId, color);
      toast.success("Team updated.");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Failed to update team.");
    } finally {
      setBusy(null);
    }
  };

  const generateInvite = async () => {
    setBusy("invite");
    try {
      const next = await createInvite(team.teamId, team.ownerId);
      setToken(next);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Failed to generate invite link.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    try {
      await revokeAllInvitesForTeam(team.teamId);
      await deleteTeam(team.teamId);
      toast.success(`Team “${team.name}” deleted.`);
      setDeleteOpen(false);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Failed to delete team.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Team settings</DialogTitle>
            <DialogDescription>Owner-only controls for “{team.name}”.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="team-rename">Name</Label>
              <Input
                id="team-rename"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                disabled={busy !== null}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <ColorSwatchGrid value={color} onChange={setColor} disabled={busy !== null} />
            </div>

            <div className="space-y-1.5">
              <Label>Invite link</Label>
              {token ? (
                <InviteLinkRow token={token} />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateInvite}
                  disabled={busy !== null}
                  className="w-full"
                >
                  {busy === "invite" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="size-4" />
                  )}
                  <span className="ml-2">Generate invite link</span>
                </Button>
              )}
            </div>

            <hr />

            <div className="space-y-1.5">
              <Label className="text-destructive">Danger zone</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
                disabled={busy !== null}
              >
                Delete team
              </Button>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy !== null}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={save}
              disabled={busy !== null || !dirty || nameError}
            >
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : null}
              <span className={busy === "save" ? "ml-2" : ""}>Save changes</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteTeamConfirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        teamName={team.name}
        onConfirm={handleDelete}
      />
    </>
  );
}
