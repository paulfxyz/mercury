import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/App";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  GitBranch, Settings, Sun, Moon,
  Plus, Clock, Menu, X, Pin,
} from "lucide-react";
import type { Session } from "@shared/schema";

function MercuryLogo() {
  return (
    <div className="flex items-center gap-2.5 font-semibold text-foreground select-none">
      <span className="text-xl leading-none flex-shrink-0">☿</span>
      <span className="text-sm tracking-tight">Mercury</span>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile nav)
  useEffect(() => { setSidebarOpen(false); }, [location]);

  // Close on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
    staleTime: 5_000,
  });

  const pinnedSessions = sessions.filter(s => (s as any).isPinned);
  const unpinnedSessions = sessions.filter(s => !(s as any).isPinned).slice(0, 8 - pinnedSessions.length);

  const navLink = (href: string, icon: React.ReactNode, label: string) => {
    const active = location === href || (href === "/chat" && (location === "/" || location === "/chat"));
    return (
      <Link href={href}>
        <button
          data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
            active
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          )}
        >
          <span className="flex-shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </button>
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border flex-shrink-0">
        <MercuryLogo />
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* New Inquiry CTA */}
      <div className="p-2 flex-shrink-0">
        <Link href="/chat">
          <button
            data-testid="nav-new-inquiry"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            New Inquiry
          </button>
        </Link>
      </div>

      {/* Nav links */}
      <div className="px-2 space-y-0.5 flex-shrink-0">
        {navLink("/workflows", <GitBranch className="w-4 h-4" />, "Workflows")}
        {navLink("/settings", <Settings className="w-4 h-4" />, "Settings")}
      </div>

      {/* Sessions: pinned first, then recent */}
      {(pinnedSessions.length > 0 || unpinnedSessions.length > 0) && (
        <div className="px-2 mt-4 flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1 space-y-0.5 pr-1">
            {/* Pinned */}
            {pinnedSessions.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-0.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pinned</p>
                {pinnedSessions.map(s => (
                  <Link key={s.id} href={`/session/${s.id}`}>
                    <button data-testid={`session-link-${s.id}`}
                      className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors",
                        location === `/session/${s.id}` ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60")}>
                      <Pin className="w-3 h-3 flex-shrink-0 text-amber-500 fill-current" />
                      <span className="text-xs truncate flex-1">{s.title}</span>
                      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                        s.status === "completed" ? "bg-green-500" : s.status === "running" ? "bg-amber-500 animate-pulse" :
                        s.status === "error" ? "bg-red-500" : "bg-muted-foreground/40")} />
                    </button>
                  </Link>
                ))}
                {unpinnedSessions.length > 0 && (
                  <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent</p>
                )}
              </>
            )}
            {pinnedSessions.length === 0 && (
              <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent</p>
            )}
            {/* Unpinned recent */}
            {unpinnedSessions.map(s => (
              <Link key={s.id} href={`/session/${s.id}`}>
                <button data-testid={`session-link-${s.id}`}
                  className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors",
                    location === `/session/${s.id}` ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60")}>
                  <Clock className="w-3 h-3 flex-shrink-0 opacity-50" />
                  <span className="text-xs truncate flex-1">{s.title}</span>
                  <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                    s.status === "completed" ? "bg-green-500" : s.status === "running" ? "bg-amber-500 animate-pulse" :
                    s.status === "error" ? "bg-red-500" : "bg-muted-foreground/40")} />
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Theme toggle */}
      <div className="p-2 border-t border-sidebar-border mt-auto flex-shrink-0">
        <button
          data-testid="btn-theme-toggle"
          onClick={toggle}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
      </div>
    </>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[100dvh] bg-background overflow-hidden">

        {/* ── Desktop sidebar (always visible ≥ md) ── */}
        <aside className="hidden md:flex flex-col w-56 flex-shrink-0 border-r border-border bg-sidebar">
          {sidebarContent}
        </aside>

        {/* ── Mobile sidebar backdrop ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Mobile sidebar drawer ── */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-sidebar border-r border-border",
          "transition-transform duration-300 ease-out md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {sidebarContent}
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Mobile top bar */}
          <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <MercuryLogo />
            <div className="ml-auto">
              <Link href="/chat">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
              </Link>
            </div>
          </header>

          <main className="flex-1 overflow-hidden flex flex-col min-w-0">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
