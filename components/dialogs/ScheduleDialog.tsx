"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useUser } from "@/lib/auth/AuthProvider";
import { createEvent, deleteEvent, updateEvent } from "@/lib/db/events";
import { EVENT_TYPE_STYLE } from "@/lib/calendar/eventType";
import { useTeamSelection } from "@/lib/calendar/teamSelection";
import {
  EVENT_TYPES,
  type Event,
  type EventType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

export type ScheduleMode =
  | { kind: "create"; defaultDate?: Date }
  | { kind: "edit"; event: Event };

// §6.4 — single dialog handles create + edit. Radix unmounts content when
// `open` is false, so form state resets between opens; parent toggles open
// by setting/clearing the mode.
export function ScheduleDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ScheduleMode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ScheduleForm mode={mode} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface FormState {
  title: string;
  type: EventType;
  isSingleDay: boolean;
  date: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  description: string;
}

function initialState(mode: ScheduleMode): FormState {
  if (mode.kind === "edit") {
    const e = mode.event;
    return {
      title: e.title,
      type: e.type,
      isSingleDay: e.isSingleDay,
      date: e.date ? e.date.toDate() : null,
      startDate: e.startDate ? e.startDate.toDate() : null,
      endDate: e.endDate ? e.endDate.toDate() : null,
      description: e.description ?? "",
    };
  }
  const seed = mode.defaultDate ?? new Date();
  return {
    title: "",
    type: "Personal",
    isSingleDay: true,
    date: seed,
    startDate: seed,
    endDate: seed,
    description: "",
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function validate(state: FormState): { title?: string; date?: string } {
  const errors: { title?: string; date?: string } = {};
  const trimmed = state.title.trim();
  if (trimmed.length === 0) errors.title = "Title is required.";
  else if (trimmed.length > 80) errors.title = "Max 80 characters.";

  if (state.isSingleDay) {
    if (!state.date) errors.date = "Pick a date.";
  } else {
    if (!state.startDate || !state.endDate) {
      errors.date = "Pick a start and end date.";
    } else {
      const s = startOfLocalDay(state.startDate).getTime();
      const e = startOfLocalDay(state.endDate).getTime();
      if (e < s) errors.date = "End date must be on or after start date.";
      else {
        const span = Math.round((e - s) / MS_PER_DAY) + 1;
        if (span > 365) errors.date = "Event can span at most 365 days.";
        else if (
          new Date(e).getFullYear() - new Date(s).getFullYear() > 1
        ) {
          errors.date = "Event cannot span more than 2 calendar years.";
        }
      }
    }
  }
  return errors;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function ScheduleForm({
  mode,
  onClose,
}: {
  mode: ScheduleMode;
  onClose: () => void;
}) {
  const { userDoc } = useUser();
  const { selectedTeamId } = useTeamSelection();
  const [state, setState] = React.useState<FormState>(() => initialState(mode));
  const [busy, setBusy] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const errors = validate(state);
  const hasErrors = Boolean(errors.title || errors.date);
  const isEdit = mode.kind === "edit";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (hasErrors) return;

    if (!userDoc) {
      toast.error("Profile not loaded yet — try again in a moment.");
      return;
    }

    setBusy(true);
    try {
      if (mode.kind === "create") {
        // Prefer the sidebar-selected team when the user is a member of it,
        // so events created while filtering on team B land in team B instead
        // of silently going to the user's primary team (and getting filtered
        // out of view). Fall back to primaryTeamId otherwise.
        const creatorTeamId =
          (selectedTeamId &&
            userDoc.teams.some((t) => t.teamId === selectedTeamId)
            ? selectedTeamId
            : userDoc.primaryTeamId);
        if (!creatorTeamId) {
          throw new Error(
            "Set a primary team before creating events.",
          );
        }
        await createEvent({
          creatorId: userDoc.uid,
          creatorName: userDoc.name,
          creatorTeamId,
          title: state.title,
          description: state.description.length > 0 ? state.description : null,
          type: state.type,
          isSingleDay: state.isSingleDay,
          date: state.isSingleDay ? state.date : null,
          startDate: state.isSingleDay ? null : state.startDate,
          endDate: state.isSingleDay ? null : state.endDate,
        });
        toast.success("Event scheduled.");
      } else {
        await updateEvent(
          mode.event.eventId,
          {
            title: state.title,
            description: state.description.length > 0 ? state.description : null,
            type: state.type,
            isSingleDay: state.isSingleDay,
            date: state.isSingleDay ? state.date : null,
            startDate: state.isSingleDay ? null : state.startDate,
            endDate: state.isSingleDay ? null : state.endDate,
          },
          mode.event,
        );
        toast.success("Event updated.");
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Failed to save event.");
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (mode.kind !== "edit") return;
    setBusy(true);
    try {
      await deleteEvent(mode.event);
      toast.success("Event deleted.");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Failed to delete event.");
      setBusy(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit event" : "Schedule an event"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update or delete this event."
              : "Add a new event to the team calendar."}
          </DialogDescription>
        </DialogHeader>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="event-title">Title</Label>
          <Input
            id="event-title"
            value={state.title}
            onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            placeholder="PTO, Conference, Birthday…"
            maxLength={80}
            autoFocus
            disabled={busy}
            aria-invalid={touched && Boolean(errors.title)}
          />
          {touched && errors.title ? (
            <p className="text-xs text-destructive">{errors.title}</p>
          ) : null}
        </div>

        {/* Type — segmented control */}
        <div className="space-y-1.5">
          <Label>Type</Label>
          <TypeSegmented
            value={state.type}
            onChange={(type) => setState((s) => ({ ...s, type }))}
            disabled={busy}
          />
        </div>

        {/* Date mode toggle */}
        <div className="space-y-1.5">
          <Label>Date</Label>
          <div className="inline-flex rounded-md border bg-card p-0.5 text-xs">
            <ModeButton
              active={state.isSingleDay}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  isSingleDay: true,
                  // Preserve a sensible date when flipping back to single.
                  date: s.date ?? s.startDate ?? new Date(),
                }))
              }
              disabled={busy}
            >
              Single day
            </ModeButton>
            <ModeButton
              active={!state.isSingleDay}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  isSingleDay: false,
                  startDate: s.startDate ?? s.date ?? new Date(),
                  endDate: s.endDate ?? s.date ?? new Date(),
                }))
              }
              disabled={busy}
            >
              Date range
            </ModeButton>
          </div>

          {state.isSingleDay ? (
            <DatePickerButton
              date={state.date}
              onChange={(d) => setState((s) => ({ ...s, date: d }))}
              disabled={busy}
              placeholder="Pick a date"
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <DatePickerButton
                date={state.startDate}
                onChange={(d) => setState((s) => ({ ...s, startDate: d }))}
                disabled={busy}
                placeholder="Start"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <DatePickerButton
                date={state.endDate}
                onChange={(d) => setState((s) => ({ ...s, endDate: d }))}
                disabled={busy}
                placeholder="End"
              />
            </div>
          )}

          {touched && errors.date ? (
            <p className="text-xs text-destructive">{errors.date}</p>
          ) : null}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="event-description">
            Description{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="event-description"
            value={state.description}
            onChange={(e) =>
              setState((s) => ({ ...s, description: e.target.value }))
            }
            placeholder="Notes for your team…"
            maxLength={500}
            disabled={busy}
            rows={3}
          />
        </div>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
          {isEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={busy}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              <span className="ml-1.5">Delete</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              <span className={busy ? "ml-2" : ""}>
                {isEdit ? "Save changes" : "Schedule"}
              </span>
            </Button>
          </div>
        </DialogFooter>
      </form>

      {isEdit ? (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this event?</AlertDialogTitle>
              <AlertDialogDescription>
                “{mode.event.title}” will be removed from the calendar for
                everyone in the workspace. This can&apos;t be undone.
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
      ) : null}
    </>
  );
}

function TypeSegmented({
  value,
  onChange,
  disabled,
}: {
  value: EventType;
  onChange: (t: EventType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EVENT_TYPES.map((t) => {
        const style = EVENT_TYPE_STYLE[t];
        const Icon = style.icon;
        const selected = t === value;
        return (
          <button
            key={t}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(t)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "border-transparent bg-foreground text-background"
                : "border-input bg-card text-foreground hover:bg-muted",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <Icon className="size-3.5" style={{ color: selected ? undefined : style.hue }} />
            {t}
          </button>
        );
      })}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded px-2.5 py-1 transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {children}
    </button>
  );
}

function DatePickerButton({
  date,
  onChange,
  disabled,
  placeholder,
}: {
  date: Date | null;
  onChange: (d: Date | null) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "w-[180px] justify-start font-normal tabular",
            !date && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-3.5" />
          <span className="ml-2">
            {date ? format(date, "EEE, MMM d, yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date ?? undefined}
          onSelect={(d) => {
            onChange(d ?? null);
            if (d) setOpen(false);
          }}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  );
}
