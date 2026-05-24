"use client";

import { toast } from "sonner";

import { removeMember } from "@/lib/db/teamMembers";
import type { Member } from "@/lib/types";
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

export function RemoveMemberConfirm({
  open,
  onOpenChange,
  teamId,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  member: Member;
}) {
  const handle = async () => {
    try {
      await removeMember(teamId, member.userId);
      toast.success(`${member.name} removed.`);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Couldn't remove member.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They&apos;ll lose access to this team. Events they created stay on
            the calendar. They can rejoin if you share the invite link again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handle}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
