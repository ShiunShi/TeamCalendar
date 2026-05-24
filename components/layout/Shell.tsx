"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Sidebar } from "@/components/sidebar/Sidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { Button } from "@/components/ui/button";
import { TeamSelectionProvider } from "@/lib/calendar/teamSelection";
import { ViewFilterProvider } from "@/lib/calendar/viewFilter";

// §7.1 — two-pane shell: collapsible left sidebar + fluid main panel.
// Below md the sidebar is a slide-in drawer over a backdrop; at md+ it's
// in-flow and the same hamburger collapses its width to 0.
export function Shell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = React.useState(false);

  const toggleSidebar = React.useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      setDesktopCollapsed((v) => !v);
    } else {
      setMobileOpen((v) => !v);
    }
  }, []);

  return (
    <ViewFilterProvider>
      <TeamSelectionProvider>
        <div className="relative flex flex-1 min-h-0">
          <Sidebar
            mobileOpen={mobileOpen}
            desktopCollapsed={desktopCollapsed}
            onCloseMobile={() => setMobileOpen(false)}
          />

          {mobileOpen ? (
            <div
              aria-hidden
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
            />
          ) : null}

          <main className="flex flex-1 flex-col min-w-0 bg-background">
            <header className="flex h-12 items-center justify-between gap-2 border-b px-3 md:px-6">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Toggle sidebar"
                aria-expanded={mobileOpen}
                onClick={toggleSidebar}
              >
                <Menu className="size-4" />
              </Button>
              <UserMenu />
            </header>
            {children}
          </main>
        </div>
      </TeamSelectionProvider>
    </ViewFilterProvider>
  );
}
