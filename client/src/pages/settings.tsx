import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Check, ExternalLink, Key, Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/settings"],
  });

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", { apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({ title: "Saved", description: "OpenRouter API key updated." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const isConfigured = settings?.apiKey === "***configured***";

  return (
    <Layout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-display font-800 text-foreground mb-1">Settings</h1>
            <p className="text-muted-foreground text-sm">Configure Mercury to connect with OpenRouter</p>
          </div>

          {/* API Key section */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Key className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">OpenRouter API Key</div>
                  <div className="text-xs text-muted-foreground">Required to call AI models</div>
                </div>
              </div>
              {isConfigured && (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                  <Check className="w-3 h-3" />
                  Configured
                </span>
              )}
            </div>

            <div className="relative">
              <input
                data-testid="input-api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isConfigured ? "Enter new key to update..." : "sk-or-v1-..."}
                className="w-full pr-10 pl-4 py-2.5 text-sm bg-input border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Get your free API key at{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  openrouter.ai/keys
                  <ExternalLink className="w-3 h-3" />
                </a>
                . Mercury uses your key to call models directly — it never stores or shares it beyond your server.
              </span>
            </div>

            <button
              data-testid="btn-save-settings"
              disabled={!apiKey || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                apiKey && !saveMutation.isPending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              {saveMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {saved ? <><Check className="w-3.5 h-3.5" />Saved</> : "Save API Key"}
            </button>
          </div>

          {/* How it works */}
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display font-700 text-base text-foreground mb-4">How Mercury works</h2>
            <div className="space-y-3">
              {[
                {
                  step: "1",
                  title: "You submit a deep query",
                  desc: "Attach files, record voice, or type your research question. Choose which models to engage.",
                },
                {
                  step: "2",
                  title: "Models research independently",
                  desc: "Each selected model produces an initial analysis in parallel.",
                },
                {
                  step: "3",
                  title: "Debate & challenge",
                  desc: "Models review each other's findings, challenge assumptions, and argue their positions.",
                },
                {
                  step: "4",
                  title: "Voting & synthesis",
                  desc: "Models vote on points of agreement and synthesize into a coherent view.",
                },
                {
                  step: "5",
                  title: "Consensus answer",
                  desc: "After 15-25 iterations, a final authoritative answer emerges from collective intelligence.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* About */}
          <div className="mt-4 text-xs text-muted-foreground/60 text-center">
            Mercury v1.0 — Self-hosted deep research platform
          </div>
        </div>
      </div>
    </Layout>
  );
}
