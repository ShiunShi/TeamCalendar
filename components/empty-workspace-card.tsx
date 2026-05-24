"use client";

import * as React from "react";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CreateTeamDialog } from "@/components/dialogs/CreateTeamDialog";

// §13.15 empty state for a user who isn't in any team yet.
// Clicking "Create a team" opens the same dialog as the sidebar's `+` button.
export function EmptyWorkspaceCard() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center">
        <div className="rounded-full bg-muted p-3">
          <Users className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">You&apos;re not in any team yet</h2>
        <p className="text-sm text-muted-foreground">
          Ask a team owner to invite you, or create your own team.
        </p>
        <Button onClick={() => setOpen(true)}>Create a team</Button>
      </div>

      <CreateTeamDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
