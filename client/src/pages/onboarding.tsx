import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSessionKey } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Eye, EyeOff, ArrowRight, ExternalLink,
  Server, Clock, Check,
} from "lucide-react";

type SaveMode = "server" | "session";

export default function OnboardingPage() {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<SaveMode>("server");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { setKey: setSessionKey } = useSessionKey();

  // Save to server
  const serverMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/keys", {
      value: key.trim(),
      label: label.trim() || undefined,
      isPrimary: true,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "API key saved to the server.", description: "You now have access to 100+ models via OpenRouter." });
      navigate("/chat");
    },
    onError: () => toast({ title: "Could not save your API key.", description: "Please check the key and try again.", variant: "destructive" }),
  });

  function handleSessionOnly() {
    if (!key.trim()) return;
    setSessionKey(key.trim());
    toast({ title: "Session key active.", description: "Your key is only kept in memory and will be cleared when you close this tab." });
    navigate("/chat");
  }

  const canSubmit = key.trim().length > 10;
  const isPending = serverMutation.isPending;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-6">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground select-none">
          <span className="text-xl">☿</span> Mercury
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in-up space-y-8">

          {/* Hero */}
          <div>
            <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center mb-5 text-background text-xl font-serif select-none">
              ☿
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">Welcome to Mercury</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Mercury uses <strong className="text-foreground font-medium">OpenRouter</strong> to access 100+ AI models.
              Add your API key to get started.
            </p>
          </div>

          {/* Key input */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">OpenRouter API Key</label>
              <div className="relative">
                <Input
                  data-testid="input-api-key"
                  type={show ? "text" : "password"}
                  placeholder="sk-or-v1-…"
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && canSubmit) {
                      mode === "server" ? serverMutation.mutate() : handleSessionOnly();
                    }
                  }}
                  className="pr-10 font-mono text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Get your free key at&nbsp;
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground flex items-center gap-0.5 underline underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  openrouter.ai/keys <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Optional label — only shown for server mode */}
            {mode === "server" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Label <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. Personal, Work, Free tier…"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}
          </div>

          {/* Mode picker */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Where to save it</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("server")}
                className={cn(
                  "flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all",
                  mode === "server"
                    ? "border-foreground bg-accent/30"
                    : "border-border hover:border-foreground/30"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  {mode === "server" && <Check className="w-3.5 h-3.5 text-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Save to server</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Stored securely on your server. Persists across sessions and devices.
                  </p>
                </div>
              </button>

              <button
                onClick={() => setMode("session")}
                className={cn(
                  "flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all",
                  mode === "session"
                    ? "border-foreground bg-accent/30"
                    : "border-border hover:border-foreground/30"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {mode === "session" && <Check className="w-3.5 h-3.5 text-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">This session only</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Kept in memory only. Cleared when you close this tab. Never written to disk.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* CTA */}
          <Button
            data-testid="btn-save-api-key"
            onClick={() => mode === "server" ? serverMutation.mutate() : handleSessionOnly()}
            disabled={!canSubmit || isPending}
            className="w-full"
          >
            {isPending
              ? "Saving…"
              : mode === "server"
                ? "Save & get started"
                : "Continue for this session"
            }
            {!isPending && <ArrowRight className="ml-2 w-4 h-4" />}
          </Button>

        </div>
      </div>
    </div>
  );
}
