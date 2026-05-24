"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useUser } from "@/lib/auth/AuthProvider";
import { createTeam } from "@/lib/db/teams";
import { createInvite } from "@/lib/db/invites";
import { TEAM_COLORS, type TeamColorHex } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteLinkRow } from "@/components/dialogs/InviteLinkRow";

export function CreateTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { userDoc } = useUser();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<TeamColorHex>(TEAM_COLORS[0].hex);
  const [busy, setBusy] = React.useState(false);
  const [createdInvite, setCreatedInvite] = React.useState<{
    token: string;
    teamName: string;
  } | null>(null);

  // Radix Dialog unmounts content when `open` is false, so internal state
  // (name/color/busy/createdInvite) is already fresh on each open. No reset
  // effect needed.

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDoc) {
      toast.error("Profile not loaded yet — try again in a moment.");
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("Team name is required.");
      return;
    }
    setBusy(true);
    try {
      const teamId = await createTeam(userDoc, { name: trimmed, color });
      const token = await createInvite(teamId, userDoc.uid);
      setCreatedInvite({ token, teamName: trimmed });
      toast.success(`Team “${trimmed}” created.`);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Failed to create team.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {createdInvite ? (
          <>
            <DialogHeader>
              <DialogTitle>Team created</DialogTitle>
              <DialogDescription>
                Share this link with anyone you want to join “{createdInvite.teamName}”.
              </DialogDescription>
            </DialogHeader>
            <InviteLinkRow token={createdInvite.token} />
            <DialogFooter>
              <DialogClose asChild>
                <Button>Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create a team</DialogTitle>
              <DialogDescription>
                You&apos;ll become the team&apos;s owner.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="team-name">Name</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engineering"
                maxLength={40}
                autoFocus
                disabled={busy}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <ColorSwatchGrid value={color} onChange={setColor} disabled={busy} />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                <span className={busy ? "ml-2" : ""}>Create team</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ColorSwatchGrid({
  value,
  onChange,
  disabled,
}: {
  value: TeamColorHex;
  onChange: (color: TeamColorHex) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TEAM_COLORS.map((c) => {
        const selected = c.hex === value;
        return (
          <button
            key={c.hex}
            type="button"
            disabled={disabled}
            aria-label={c.name}
            aria-pressed={selected}
            onClick={() => onChange(c.hex)}
            className={cn(
              "relative flex size-7 items-center justify-center rounded-full transition-transform",
              "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              disabled && "cursor-not-allowed opacity-60",
            )}
            style={{ backgroundColor: c.hex }}
          >
            {selected ? (
              <Check className="size-3.5 text-white drop-shadow" strokeWidth={3} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
