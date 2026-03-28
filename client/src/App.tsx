import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

import ChatPage from "@/pages/chat";
import OnboardingPage from "@/pages/onboarding";
import SessionPage from "@/pages/session";
import SettingsPage from "@/pages/settings";
import WorkflowsPage from "@/pages/workflows";
import NotFound from "@/pages/not-found";

// ─── Theme ────────────────────────────────────────────────────
interface ThemeCtx { theme: "light" | "dark"; toggle: () => void; set: (t: "light" | "dark") => void; }
const ThemeContext = createContext<ThemeCtx>({ theme: "light", toggle: () => {}, set: () => {} });
export const useTheme = () => useContext(ThemeContext);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("./api/settings/theme")
      .then(r => r.json())
      .then(d => { const t: "light" | "dark" = d.theme === "dark" ? "dark" : "light"; apply(t); setThemeState(t); })
      .catch(() => { const t: "light" | "dark" = matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"; apply(t); setThemeState(t); })
      .finally(() => setReady(true));
  }, []);

  function apply(t: "light" | "dark") { document.documentElement.classList.toggle("dark", t === "dark"); }

  const set = useCallback((t: "light" | "dark") => {
    setThemeState(t); apply(t);
    fetch("./api/settings/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: t }) }).catch(() => {});
  }, []);

  const toggle = useCallback(() => set(theme === "light" ? "dark" : "light"), [theme, set]);

  if (!ready) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <span className="text-2xl select-none">☿</span>
        <p className="text-xs text-muted-foreground">Loading Mercury…</p>
      </div>
    </div>
  );

  return <ThemeContext.Provider value={{ theme, toggle, set }}>{children}</ThemeContext.Provider>;
}

// ─── Guard: API key only ─────────────────────────────────────
function AppRouter() {
  const [location, navigate] = useLocation();

  const { data: ob, isLoading } = useQuery<{ hasApiKey: boolean }>({
    queryKey: ["/api/onboarding"],
    staleTime: 0,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (isLoading || !ob) return;
    const atOnboarding = location.startsWith("/onboarding");
    if (!ob.hasApiKey) {
      if (!atOnboarding) navigate("/onboarding");
    } else {
      if (location === "/" || atOnboarding) navigate("/chat");
    }
  }, [ob, isLoading, location]);

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <span className="text-2xl select-none animate-pulse">☿</span>
        <p className="text-xs text-muted-foreground">Starting up…</p>
      </div>
    </div>
  );

  return (
    <Switch>
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/session/:id" component={SessionPage} />
      <Route path="/workflows" component={WorkflowsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/" component={() => null} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
