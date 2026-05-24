"use client";

import * as React from "react";
import { Minus } from "lucide-react";

import { EVENT_TYPE_STYLE, hexToRgba } from "@/lib/calendar/eventType";
import type { MemberStatus } from "@/lib/member/status";
import type { Member, TeamColorHex } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RemoveMemberConfirm } from "@/components/dialogs/RemoveMemberConfirm";

// §13.10 — 28px row with 20px team-color avatar, name, optional derived
// status badge (§6.6), and an owner-hover remove button.
export function MemberRow({
  member,
  teamColor,
  teamId,
  showRemove,
  status,
}: {
  member: Member;
  teamColor: TeamColorHex;
  teamId: string;
  showRemove: boolean;
  status: MemberStatus | null;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const initials = getInitials(member.name);

  return (
    <div className="group flex h-7 items-center gap-2 rounded-md px-3 hover:bg-accent">
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: teamColor }}
      >
        {initials}
      </span>

      <span className="flex-1 truncate text-sm">{member.name}</span>

      {status ? (
        <span
          className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground"
          style={{
            backgroundColor: hexToRgba(EVENT_TYPE_STYLE[status.type].hue, 0.5),
          }}
          aria-label={`${status.label} today`}
        >
          {status.label}
        </span>
      ) : null}

      {showRemove ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${firstName(member.name)}`}
              className="size-4 opacity-0 transition-opacity group-hover:opacity-100 text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Minus className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove {firstName(member.name)}</TooltipContent>
        </Tooltip>
      ) : null}

      <RemoveMemberConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        teamId={teamId}
        member={member}
      />
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
