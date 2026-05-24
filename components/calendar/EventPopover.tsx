"use client";

import * as React from "react";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Event, Team } from "@/lib/types";
import { EVENT_TYPE_STYLE } from "@/lib/calendar/eventType";
import { eventInterval } from "@/lib/calendar/grid";
import { deleteEvent } from "@/lib/db/events";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PopoverContent, PopoverHeader, PopoverTitle } from "@/components/ui/popover";

// §7.7 — read-only event detail popover with Edit + Delete buttons. Edit
// delegates to the parent (which opens ScheduleDialog in edit mode); delete
// is confirmed inline with an AlertDialog and writes via lib/db/events.
export function EventPopoverContent({
  event,
  team,
  onEdit,
}: {
  event: Event;
  team: Team | undefined;
  onEdit?: (event: Event) => void;
}) {
  const style = EVENT_TYPE_STYLE[event.type];
  const Icon = style.icon;
  const interval = eventInterval(event);
  const teamColor = team?.color ?? "#9CA3AF";
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const dateLabel = !interval
    ? "Invalid date"
    : interval.isMultiDay
      ? `${format(interval.start, "EEE, MMM d")} – ${format(interval.end, "EEE, MMM d, yyyy")}`
      : format(interval.start, "EEE, MMM d, yyyy");

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteEvent(event);
      toast.success("Event deleted.");
      setConfirmOpen(false);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Failed to delete event.");
      setBusy(false);
    }
  };

  return (
    <>
      <PopoverContent align="start" sideOffset={6} className="w-80">
        <PopoverHeader>
          <div className="flex items-center gap-2">
            <Icon aria-hidden className="size-4" style={{ color: style.hue }} />
            <span
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: style.hue }}
            >
              {event.type}
            </span>
          </div>
          <PopoverTitle className="text-base">{event.title}</PopoverTitle>
        </PopoverHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="size-5">
            <AvatarFallback
              className="text-[9px] font-semibold text-white"
              style={{ backgroundColor: teamColor }}
            >
              {initials(event.creatorName)}
            </AvatarFallback>
          </Avatar>
          <span>{event.creatorName}</span>
          {team ? <span aria-hidden>·</span> : null}
          {team ? <span>{team.name}</span> : null}
        </div>

        <div className="text-sm tabular">{dateLabel}</div>

        {event.description ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {event.description}
          </p>
        ) : null}

        <div className="border-t pt-2 text-[11px] text-muted-foreground tabular">
          Created {format(event.createdAt.toDate(), "MMM d, yyyy")}
          {event.updatedAt.toMillis() !== event.createdAt.toMillis()
            ? ` · Updated ${format(event.updatedAt.toDate(), "MMM d, yyyy")}`
            : null}
        </div>

        <div className="flex items-center justify-end gap-1.5 border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            <span className="ml-1.5">Delete</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit?.(event)}
            disabled={!onEdit}
          >
            <Pencil className="size-3.5" />
            <span className="ml-1.5">Edit</span>
          </Button>
        </div>
      </PopoverContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              “{event.title}” will be removed from the calendar for everyone in
              the workspace. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}
