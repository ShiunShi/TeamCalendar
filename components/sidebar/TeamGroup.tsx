"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Event, Team } from "@/lib/types";
import { useTeamMembers } from "@/lib/hooks/useTeamMembers";
import { deriveMemberStatus } from "@/lib/member/status";
import { Button } from "@/components/ui/button";
import { MemberRow } from "@/components/sidebar/MemberRow";
import { TeamSettingsDialog } from "@/components/dialogs/TeamSettingsDialog";

// §7.2 row: collapsible team group. Default-expanded for teams the user
// belongs to; collapsed for others (still listed so non-members see the
// roster on demand). Clicking the team name toggles single-select team
// filtering (§7.4) and ensures the group is expanded; chevron remains the
// dedicated expand/collapse handle.
export function TeamGroup({
  team,
  isMember,
  isOwner,
  todayEvents,
  isSelected,
  anyTeamSelected,
  onSelectTeam,
}: {
  team: Team;
  isMember: boolean;
  isOwner: boolean;
  todayEvents: Event[];
  isSelected: boolean;
  anyTeamSelected: boolean;
  onSelectTeam: () => void;
}) {
  const [expanded, setExpanded] = React.useState(isMember);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const members = useTeamMembers(expanded ? team.teamId : null);

  const dimmed = anyTeamSelected && !isSelected;

  return (
    <div className={cn(dimmed && "opacity-50 transition-opacity hover:opacity-80")}>
      <div
        className={cn(
          "group flex h-7 items-center gap-1 rounded-md pl-1 pr-2 hover:bg-accent",
          isSelected && "bg-accent/60",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse team" : "Expand team"}
          className="flex items-center"
        >
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
        </button>

        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: team.color }}
        />

        <button
          type="button"
          aria-pressed={isSelected}
          onClick={() => {
            onSelectTeam();
            if (!expanded) setExpanded(true);
          }}
          className="flex-1 truncate text-left text-sm font-medium"
        >
          {team.name}
        </button>

        <span className="text-xs tabular text-muted-foreground">
          {team.memberCount}
        </span>

        {isOwner ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Team settings"
            className="size-5 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-3" />
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="ml-5 mt-0.5 flex flex-col gap-0.5">
          {members.length === 0 ? (
            <p className="px-3 text-xs text-muted-foreground">Loading…</p>
          ) : (
            members.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                teamColor={team.color}
                teamId={team.teamId}
                showRemove={isOwner && m.role !== "owner"}
                status={deriveMemberStatus(m.userId, todayEvents)}
              />
            ))
          )}
        </div>
      ) : null}

      <TeamSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        team={team}
      />
    </div>
  );
}
