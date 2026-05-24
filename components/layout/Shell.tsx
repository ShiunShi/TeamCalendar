"use client";

import { Sidebar } from "@/components/sidebar/Sidebar";
import { TeamSelectionProvider } from "@/lib/calendar/teamSelection";
import { ViewFilterProvider } from "@/lib/calendar/viewFilter";

// §7.1 — two-pane shell: 240px fixed left sidebar + fluid main panel.
// Mobile-drawer behavior is deferred to Phase 10. The View + TeamSelection
// providers wrap both panes so sidebar selections drive grid filtering.
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ViewFilterProvider>
      <TeamSelectionProvider>
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex flex-1 flex-col min-w-0 bg-background">
            {children}
          </main>
        </div>
      </TeamSelectionProvider>
    </ViewFilterProvider>
  );
}
