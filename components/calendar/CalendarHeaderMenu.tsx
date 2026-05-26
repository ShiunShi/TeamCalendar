"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";

import { useUser } from "@/lib/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ImportHolidaysDialog } from "@/components/dialogs/ImportHolidaysDialog";

export function CalendarHeaderMenu() {
  const { userDoc } = useUser();
  const [importOpen, setImportOpen] = React.useState(false);

  const ownsAnyTeam = userDoc?.teams.some((t) => t.role === "owner") ?? false;
  if (!ownsAnyTeam) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="More calendar actions"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setImportOpen(true)}>
            Import Taiwan holidays…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ImportHolidaysDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
