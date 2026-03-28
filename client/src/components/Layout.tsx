import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/App";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MessageSquare, GitBranch, Settings, Sun, Moon, Plus, Clock } from "lucide-react";
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

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
    staleTime: 5_000,
  });

  const recentSessions = sessions.slice(0, 8);

  const navLink = (href: string, icon: React.ReactNode, label: string) => {
    const active = location === href || (href === "/chat" && (location === "/" || location === "/chat"));
    return (
      <Link href={href}>
        <button
          data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar */}
        <aside className="flex flex-col w-56 flex-shrink-0 border-r border-border bg-sidebar">
          {/* Header */}
          <div className="flex items-center px-4 h-14 border-b border-sidebar-border">
            <MercuryLogo />
          </div>

          {/* New Inquiry CTA */}
          <div className="p-2">
            <Link href="/chat">
              <button
                data-testid="nav-new-inquiry"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                New Inquiry
              </button>
            </Link>
          </div>

          {/* Nav links */}
          <div className="px-2 space-y-0.5">
            {navLink("/chat", <MessageSquare className="w-4 h-4" />, "Chat")}
            {navLink("/workflows", <GitBranch className="w-4 h-4" />, "Workflows")}
            {navLink("/settings", <Settings className="w-4 h-4" />, "Settings")}
          </div>

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
            <div className="px-2 mt-4 flex-1 overflow-hidden flex flex-col min-h-0">
              <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recent
              </p>
              <div className="overflow-y-auto flex-1 space-y-0.5 pr-1">
                {recentSessions.map(s => (
                  <Link key={s.id} href={`/session/${s.id}`}>
                    <button
                      data-testid={`session-link-${s.id}`}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors",
                        location === `/session/${s.id}`
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                      )}
                    >
                      <Clock className="w-3 h-3 flex-shrink-0 opacity-50" />
                      <span className="text-xs truncate flex-1">{s.title}</span>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        s.status === "completed" ? "bg-green-500" :
                        s.status === "running" ? "bg-amber-500 animate-pulse" :
                        s.status === "error" ? "bg-red-500" : "bg-muted-foreground/40"
                      )} />
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Theme toggle */}
          <div className="p-2 border-t border-sidebar-border mt-auto">
            <button
              data-testid="btn-theme-toggle"
              onClick={toggle}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
