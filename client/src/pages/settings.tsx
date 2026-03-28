import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Sun, Moon, Trash2, CheckCircle2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

export default function SettingsPage() {
  const { theme, set: setTheme } = useTheme();
  const { toast } = useToast();
  const [newKey, setNewKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showDanger, setShowDanger] = useState(false);

  const { data: settings } = useQuery<{ apiKey: string; theme: string }>({
    queryKey: ["/api/settings"],
  });

  const saveKeyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", { apiKey: newKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      toast({ title: "API key updated" });
      setNewKey("");
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const clearSessionsMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/sessions"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "All sessions deleted" });
    },
  });

  const configured = settings?.apiKey === "***configured***";

  return (
    <Layout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-base font-semibold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Configure Mercury — all settings persist on your server</p>
          </div>

          {/* API Key */}
          <div className="border border-border rounded-xl p-4 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">OpenRouter API Key</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Stored securely on your server</p>
              </div>
              {configured && (
                <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  data-testid="input-api-key"
                  type={showKey ? "text" : "password"}
                  placeholder={configured ? "Enter new key to update…" : "sk-or-v1-…"}
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
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
                  Get your key at openrouter.ai/keys
                  <ExternalLink className="w-3 h-3" />
                </a>
                <Button
                  data-testid="btn-save-key"
                  size="sm"
                  onClick={() => saveKeyMutation.mutate()}
                  disabled={!newKey.trim() || saveKeyMutation.isPending}
                >
                  {saveKeyMutation.isPending ? "Saving…" : "Save key"}
                </Button>
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="border border-border rounded-xl p-4 bg-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                data-testid="btn-light-mode"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all",
                  theme === "light"
                    ? "border-foreground bg-accent text-foreground font-medium"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                <Sun className="w-4 h-4" />
                Light
                {theme === "light" && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-foreground" />}
              </button>
              <button
                data-testid="btn-dark-mode"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all",
                  theme === "dark"
                    ? "border-foreground bg-accent text-foreground font-medium"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                <Moon className="w-4 h-4" />
                Dark
                {theme === "dark" && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-foreground" />}
              </button>
            </div>
          </div>

          {/* About */}
          <div className="border border-border rounded-xl p-4 bg-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">About Mercury</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono text-xs text-foreground">3.0.0</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Powered by</span>
                <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-foreground flex items-center gap-1 hover:opacity-70 transition-opacity">
                  OpenRouter <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="pt-2 space-y-1 text-xs text-muted-foreground">
                <p>• Submit a query with a workflow</p>
                <p>• Multiple AI models debate your inquiry independently</p>
                <p>• Models debate, challenge, and vote over 15+ rounds</p>
                <p>• A consensus answer emerges after debate from collective intelligence</p>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="border border-destructive/30 rounded-xl p-4 space-y-3">
            <button
              onClick={() => setShowDanger(!showDanger)}
              className="w-full flex items-center justify-between text-sm font-semibold text-destructive"
            >
              Danger zone
              {showDanger ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showDanger && (
              <div className="space-y-3 pt-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete all sessions</p>
                    <p className="text-xs text-muted-foreground">Permanently remove all research history and results.</p>
                  </div>
                  <Button
                    data-testid="btn-delete-all-sessions"
                    variant="destructive"
                    size="sm"
                    onClick={() => confirm("Delete ALL sessions? This cannot be undone.") && clearSessionsMutation.mutate()}
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
