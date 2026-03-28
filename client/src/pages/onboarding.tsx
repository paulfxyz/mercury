import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowRight, ExternalLink } from "lucide-react";

export default function OnboardingPage() {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", { apiKey: key }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "API key saved successfully.", description: "You now have access to 100+ AI models via OpenRouter." });
      navigate("/chat");
    },
    onError: () => toast({ title: "Could not save your API key.", description: "Please check the key and try again.", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-6">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground select-none">
          <span className="text-xl">☿</span> Mercury
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Icon */}
          <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center mb-6 text-background text-xl font-serif select-none">
            ☿
          </div>

          <h1 className="text-xl font-semibold text-foreground mb-2">Welcome to Mercury</h1>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            Mercury connects to <strong className="text-foreground font-medium">100+ AI models</strong> via OpenRouter to power your expert inquiry engine. Add your API key to get started — it's stored securely on your server and never leaves it.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">OpenRouter API Key</label>
              <div className="relative">
                <Input
                  data-testid="input-api-key"
                  type={show ? "text" : "password"}
                  placeholder="sk-or-v1-…"
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && key.trim() && saveMutation.mutate()}
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
                <span>Get your free key at</span>
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

            <Button
              data-testid="btn-save-api-key"
              onClick={() => saveMutation.mutate()}
              disabled={!key.trim() || saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? "Connecting…" : "Connect & start"}
              {!saveMutation.isPending && <ArrowRight className="ml-2 w-4 h-4" />}
            </Button>
          </div>

          <div className="mt-8 p-4 rounded-xl border border-border bg-muted/30 space-y-2">
            <p className="text-xs font-medium text-foreground">What happens next</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2"><span>1.</span><span>Submit any inquiry — simple questions get an instant answer, complex ones launch the expert debate wizard</span></li>
              <li className="flex gap-2"><span>2.</span><span>Configure your expert team: choose models, debate rounds, temperature and required consensus level</span></li>
              <li className="flex gap-2"><span>3.</span><span>Watch models debate in real time and receive a final consensus answer</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
