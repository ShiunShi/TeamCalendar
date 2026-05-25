"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { endOfMonth, startOfMonth, startOfToday } from "date-fns";

import { useUser } from "@/lib/auth/AuthProvider";
import { useWorkspaceTeams } from "@/lib/hooks/useWorkspaceTeams";
import { useTodayEvents } from "@/lib/hooks/useTodayEvents";
import { useMonthEvents } from "@/lib/hooks/useMonthEvents";
import { useWeekEvents } from "@/lib/hooks/useWeekEvents";
import { useTeamSelection } from "@/lib/calendar/teamSelection";
import { useViewFilter, type ViewKind } from "@/lib/calendar/viewFilter";
import { useFocusedMonth } from "@/lib/calendar/focusedMonth";
import { eventInterval, isoWeekRange } from "@/lib/calendar/grid";
import { eventMatchesPill } from "@/components/calendar/StatPills";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WorkspaceMenu } from "@/components/sidebar/WorkspaceMenu";
import { TeamGroup } from "@/components/sidebar/TeamGroup";
import { CreateTeamDialog } from "@/components/dialogs/CreateTeamDialog";

// §7.2 — 240px sidebar with workspace header, VIEWS section, and TEAMS
// section. Views drive the calendar's view filter (lib/calendar/viewFilter).
// Member rows surface a derived "status badge" from today's events (§6.6).
//
// Responsive behavior: below md the sidebar is a fixed slide-in drawer
// (controlled by `mobileOpen`); at md+ it's in-flow and `desktopCollapsed`
// shrinks its width to 0.
export function Sidebar({
  mobileOpen,
  desktopCollapsed,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  desktopCollapsed: boolean;
  onCloseMobile: () => void;
}) {
  const { userDoc } = useUser();
  const { teams, loading } = useWorkspaceTeams();
  const { events: todayEvents, loading: todayLoading } = useTodayEvents();
  const { activeView, setActiveView } = useViewFilter();
  const { selectedTeamId, setSelectedTeamId } = useTeamSelection();
  const [createOpen, setCreateOpen] = React.useState(false);
  const anyTeamSelected = selectedTeamId !== null;

  const { focusedMonth } = useFocusedMonth();
  const { events: monthEvents, loading: monthLoading } =
    useMonthEvents(focusedMonth);
  const { events: weekEvents, loading: weekLoading } = useWeekEvents();

  const today = React.useMemo(() => startOfToday(), []);
  const week = React.useMemo(() => isoWeekRange(today), [today]);
  const monthRange = React.useMemo(
    () => ({
      start: startOfMonth(focusedMonth),
      end: endOfMonth(focusedMonth),
    }),
    [focusedMonth],
  );

  const allCount = React.useMemo(() => {
    let n = 0;
    for (const e of monthEvents) {
      const iv = eventInterval(e);
      if (!iv) continue;
      if (iv.end >= monthRange.start && iv.start <= monthRange.end) n += 1;
    }
    return n;
  }, [monthEvents, monthRange]);

  const outCount = React.useMemo(() => {
    const creators = new Set<string>();
    for (const e of todayEvents) {
      if (eventMatchesPill(e, "out", today, week)) {
        // Schema guarantees creatorId, but fall back to eventId so a
        // missing-creator row can't silently collapse to a single bucket.
        creators.add(e.creatorId || e.eventId);
      }
    }
    return creators.size;
  }, [todayEvents, today, week]);

  const birthdayCount = React.useMemo(
    () =>
      weekEvents.filter((e) => eventMatchesPill(e, "birthdays", today, week))
        .length,
    [weekEvents, today, week],
  );

  // The user's owned + joined team IDs, used by TeamGroup to default-expand
  // and to gate owner-only controls.
  const myTeamIds = React.useMemo(
    () => new Set(userDoc?.teams.map((t) => t.teamId) ?? []),
    [userDoc],
  );

  // Sidebar only lists teams the user belongs to. Non-member teams are still
  // visible in the calendar (events render with the team's color) but they
  // don't get a roster row in the sidebar.
  const myTeams = React.useMemo(
    () => teams.filter((t) => myTeamIds.has(t.teamId)),
    [teams, myTeamIds],
  );

  // §7.3 — built-in views. "Cross-team only" deferred (needs Phase 9
  // denormalization to avoid a workspace-wide users/* subscription).
  const views: ReadonlyArray<{
    icon: string;
    label: string;
    kind: ViewKind;
    count: number | null;
  }> = [
    {
      icon: "📅",
      label: "All activity",
      kind: "all",
      count: monthLoading ? null : allCount,
    },
    {
      icon: "🏖",
      label: "Out today",
      kind: "out",
      count: todayLoading ? null : outCount,
    },
    {
      icon: "🎂",
      label: "Birthdays this week",
      kind: "birthdays",
      count: weekLoading ? null : birthdayCount,
    },
  ];

  return (
    <aside
      data-mobile-open={mobileOpen}
      data-desktop-collapsed={desktopCollapsed}
      className={cn(
        // Mobile: fixed overlay drawer, hidden by default.
        "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground",
        "-translate-x-full transition-transform duration-200 ease-out",
        "data-[mobile-open=true]:translate-x-0",
        // Desktop: in-flow with width-collapse animation.
        "md:relative md:translate-x-0 md:transition-[width] md:duration-200",
        "md:data-[desktop-collapsed=true]:w-0",
        "md:data-[desktop-collapsed=true]:overflow-hidden",
        "md:data-[desktop-collapsed=true]:border-r-0",
      )}
    >
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-base font-semibold tracking-tight">TeamCalendar</h1>
        <WorkspaceMenu />
      </header>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-4">
        <Section label="Views">
          {views.map((v) => {
            const isActive = activeView === v.kind;
            return (
              <button
                key={v.kind}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setActiveView(v.kind);
                  onCloseMobile();
                }}
                className={cn(
                  "relative flex h-7 items-center gap-2 rounded-md px-2 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1 h-5 w-[2px] rounded-r bg-primary"
                  />
                ) : null}
                <span aria-hidden>{v.icon}</span>
                <span className="flex-1 truncate text-left">{v.label}</span>
                {v.count !== null && (
                  <span className="ml-auto tabular-nums text-xs text-muted-foreground">
                    {v.count}
                  </span>
                )}
              </button>
            );
          })}
        </Section>

        <Section
          label="Teams"
          action={
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Create team"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          }
        >
          {loading ? null : myTeams.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">No teams yet.</p>
          ) : (
            myTeams.map((team) => (
              <TeamGroup
                key={team.teamId}
                team={team}
                isMember={myTeamIds.has(team.teamId)}
                isOwner={team.ownerId === userDoc?.uid}
                todayEvents={todayEvents}
                isSelected={selectedTeamId === team.teamId}
                anyTeamSelected={anyTeamSelected}
                onSelectTeam={() => {
                  setSelectedTeamId(
                    selectedTeamId === team.teamId ? null : team.teamId,
                  );
                  onCloseMobile();
                }}
              />
            ))
          )}

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-1 flex h-7 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <Plus className="size-3.5" />
            <span>New team…</span>
          </button>
        </Section>
      </nav>

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
    </aside>
  );
}

function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {action}
      </div>
      {children}
    </section>
  );
}
