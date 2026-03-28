import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Eye, EyeOff, Sun, Moon, Trash2, CheckCircle2, ExternalLink,
  ChevronDown, ChevronUp, Unlink, KeyRound, Sparkles,
} from "lucide-react";

export default function SettingsPage() {
  const { theme, set: setTheme } = useTheme();
  const { toast } = useToast();
  const [newKey, setNewKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const { data: settings } = useQuery<{ apiKey: string; theme: string }>({
    queryKey: ["/api/settings"],
  });

  const configured = settings?.apiKey === "***configured***";

  // ─── Save key ─────────────────────────────────────────────
  const saveKeyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", { apiKey: newKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      setNewKey("");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    },
    onError: () => toast({ title: "Could not save your API key.", description: "Please check the key and try again.", variant: "destructive" }),
  });

  // ─── Remove key ───────────────────────────────────────────
  const removeKeyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", { apiKey: "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      toast({ title: "API key disconnected.", description: "You can reconnect at any time from Settings." });
    },
    onError: () => toast({ title: "Could not remove the API key.", description: "Please try again.", variant: "destructive" }),
  });

  // ─── Clear sessions ────────────────────────────────────────
  const clearSessionsMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/sessions"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "All inquiry history has been deleted.", description: "Your workflows and settings are still intact." });
    },
  });

  return (
    <Layout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

          {/* Header */}
          <div>
            <h1 className="text-base font-semibold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">All settings are stored on your server</p>
          </div>

          {/* ── API Key ─────────────────────────────────────── */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">OpenRouter API Key</span>
              </div>
              {configured ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                  Not connected
                </span>
              )}
            </div>

            <div className="p-4 space-y-3">
              {/* Success state */}
              {justSaved && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 animate-fade-in-up">
                  <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">You're all set!</p>
                    <p className="text-xs text-green-600/80 dark:text-green-400/80">
                      Key saved securely on your server. 100+ models are now available.
                    </p>
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="relative">
                <Input
                  data-testid="input-api-key"
                  type={showKey ? "text" : "password"}
                  placeholder={configured ? "Enter new key to replace…" : "sk-or-v1-…"}
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newKey.trim() && saveKeyMutation.mutate()}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  openrouter.ai/keys <ExternalLink className="w-3 h-3" />
                </a>
                <Button
                  data-testid="btn-save-key"
                  size="sm"
                  onClick={() => saveKeyMutation.mutate()}
                  disabled={!newKey.trim() || saveKeyMutation.isPending}
                >
                  {saveKeyMutation.isPending ? "Saving…" : configured ? "Update key" : "Save key"}
                </Button>
              </div>

              {/* Disconnect option */}
              {configured && (
                <div className="pt-1 border-t border-border">
                  <button
                    onClick={() => {
                      if (confirm("Remove your API key? You'll need to re-enter it to use Mercury.")) {
                        removeKeyMutation.mutate();
                      }
                    }}
                    disabled={removeKeyMutation.isPending}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    {removeKeyMutation.isPending ? "Removing…" : "Disconnect API key"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Appearance ──────────────────────────────────── */}
          <div className="border border-border rounded-xl p-4 bg-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map(t => (
                <button
                  key={t}
                  data-testid={`btn-${t}-mode`}
                  onClick={() => setTheme(t)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all",
                    theme === t
                      ? "border-foreground bg-accent text-foreground font-medium"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {t === "light" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {t === "light" ? "Light" : "Dark"}
                  {theme === t && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* ── About ───────────────────────────────────────── */}
          <div className="border border-border rounded-xl p-4 bg-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">About Mercury</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono text-xs text-foreground">{__APP_VERSION__}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Powered by</span>
                <a
                  href="https://openrouter.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-foreground flex items-center gap-1 hover:opacity-70 transition-opacity"
                >
                  OpenRouter <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Source</span>
                <a
                  href="https://github.com/paulfxyz/mercury"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-foreground flex items-center gap-1 hover:opacity-70 transition-opacity"
                >
                  github.com/paulfxyz/mercury <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* ── Danger zone ─────────────────────────────────── */}
          <div className="border border-destructive/30 rounded-xl p-4 space-y-3">
            <button
              onClick={() => setShowDanger(!showDanger)}
              className="w-full flex items-center justify-between text-sm font-semibold text-destructive"
            >
              Danger zone
              {showDanger ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showDanger && (
              <div className="space-y-3 pt-1 border-t border-destructive/20">
                <div className="flex items-start justify-between gap-4 pt-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete all inquiries</p>
                    <p className="text-xs text-muted-foreground">Permanently removes all sessions, history and results.</p>
                  </div>
                  <Button
                    data-testid="btn-delete-all-sessions"
                    variant="destructive"
                    size="sm"
                    onClick={() => confirm("Delete ALL inquiry history? This cannot be undone.") && clearSessionsMutation.mutate()}
                    disabled={clearSessionsMutation.isPending}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {clearSessionsMutation.isPending ? "Deleting…" : "Delete all"}
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
