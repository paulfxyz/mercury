import { Link, useLocation } from "wouter";
import { Settings, MessageSquare, Plus, ChevronRight, Beaker } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Session } from "@shared/schema";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const { data: sessions } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
    refetchInterval: 5000,
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary">
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
              <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
            </svg>
          </div>
          <div>
            <div className="font-display font-800 text-sm tracking-tight text-foreground">MERCURY</div>
            <div className="text-[10px] text-muted-foreground font-mono tracking-widest">DEEP RESEARCH</div>
          </div>
        </div>

        {/* New Research CTA */}
        <div className="p-3">
          <Link href="/">
            <button
              data-testid="btn-new-research"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                location === "/"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-foreground hover:bg-secondary"
              )}
            >
              <Plus className="w-4 h-4" />
              New Research
            </button>
          </Link>
        </div>

        {/* Recent Sessions */}
        <div className="flex-1 overflow-y-auto px-2">
          {sessions && sessions.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Recent
              </div>
              {sessions.slice(0, 20).map((session) => (
                <Link key={session.id} href={`/session/${session.id}`}>
                  <button
                    data-testid={`session-link-${session.id}`}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all group",
                      location === `/session/${session.id}`
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate flex-1">{session.title}</span>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      session.status === "running" && "bg-amber-500 animate-pulse",
                      session.status === "completed" && "bg-emerald-500",
                      session.status === "error" && "bg-red-500",
                      session.status === "pending" && "bg-muted-foreground",
                    )} />
                  </button>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="p-3 border-t border-border space-y-1">
          <Link href="/settings">
            <button
              data-testid="btn-settings"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                location === "/settings"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
