"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useUser } from "@/lib/auth/AuthProvider";
import { Shell } from "@/components/layout/Shell";
import { EmptyWorkspaceCard } from "@/components/empty-workspace-card";
import { CalendarView } from "@/components/calendar/CalendarView";

// Auth gate + always-render Shell. Main panel is either the calendar view
// (user is in at least one team) or the empty-workspace prompt.
export default function Home() {
  const router = useRouter();
  const { user, userDoc, loading } = useUser();

  React.useEffect(() => {
    if (!loading && !user) router.replace("/signin");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // userDoc lags auth.user by a tick (ensureUserDoc → onSnapshot). Show a spinner
  // for that bridge rather than flashing the empty state.
  if (!userDoc) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const inAnyTeam = userDoc.teams.length > 0;

  return (
    <Shell>
      {inAnyTeam ? <CalendarView /> : <EmptyWorkspaceCard />}
    </Shell>
  );
}
