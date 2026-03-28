import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import HomePage from "@/pages/home";
import SessionPage from "@/pages/session";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import PerplexityAttribution from "@/components/PerplexityAttribution";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/session/:id" component={SessionPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </Router>
      <Toaster />
      <PerplexityAttribution />
    </QueryClientProvider>
  );
}
