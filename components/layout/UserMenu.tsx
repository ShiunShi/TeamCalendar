"use client";

import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { useUser } from "@/lib/auth/AuthProvider";
import { getAuthClient } from "@/lib/firebase/client";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function UserMenu() {
  const { user, userDoc } = useUser();
  if (!user) return null;

  const displayName = userDoc?.name ?? user.displayName ?? user.email ?? "";
  const email = userDoc?.email ?? user.email ?? "";
  const photoURL = user.photoURL ?? userDoc?.photoURL ?? "";

  const handleSignOut = async () => {
    try {
      await signOut(getAuthClient());
    } catch (err) {
      toast.error((err as Error).message ?? "Sign-out failed.");
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar>
            {photoURL ? (
              <AvatarImage
                src={photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {getInitials(displayName) || "?"}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent align="end">
          <div className="font-medium">{displayName}</div>
          {email ? <div className="text-xs opacity-80">{email}</div> : null}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent align="end">Sign out</TooltipContent>
      </Tooltip>
    </div>
  );
}
