"use client";

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

// Cascade-delete confirmation. Spec §10 says rename/recolor/delete cascade
// across users.teams[] — the warning here matches what the operation does.
export function DeleteTeamConfirm({
  open,
  onOpenChange,
  teamName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{teamName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the team and its roster. All members lose access to
            this team. Events created by team members stay on the calendar
            but lose their team color. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete team
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
