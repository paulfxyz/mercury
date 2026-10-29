import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowUp, Loader2, ChevronRight } from "lucide-react";
import type { Session } from "@shared/schema";

export default function ChatPage() {
  const { t } = useI18n();
  const search = useSearch();
  const [query, setQuery] = useState(() => {
    // Pre-fill from ?q= URL param (set by session follow-up)
    const params = new URLSearchParams(search);
    return params.get("q") ?? "";
  });
  // All inquiry state lives in /session/:id — chat page is just the input.

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: sessions = [] } = useQuery<Session[]>({ queryKey: ["/api/sessions"], staleTime: 5_000 });
  const recentSessions = sessions.slice(0, 6);

  // Auto-submit if arriving with a pre-filled ?q= param
  useEffect(() => {
    const params = new URLSearchParams(search);
    const q = params.get("q");
    if (q?.trim()) {
      setQuery(q);
      const timer = setTimeout(() => { quickMutation.mutate(q.trim()); }, 80);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  }, [query]);

  const quickMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/quick-answer", { query: q, title: q.slice(0, 60) });
      return res.json() as Promise<{ sessionId: string }>;
    },
    onSuccess: (data) => {
      // Navigate immediately — session page handles the quick answer display,
      // debate starter, wizard, follow-ups and debate all in one place.
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate(`/session/${data.sessionId}`);
    },
    onError: () => {
      toast({ title: t("toast_inquiry_error_title"), description: t("toast_inquiry_error_desc"), variant: "destructive" });
    },
  });


  function handleSubmit(q?: string) {
    const text = (q ?? query).trim();
    if (!text) return;
    setQuery(text);
    quickMutation.mutate(text);
  }

  const isProcessing = quickMutation.isPending;

  return (
    <Layout>
      <div className="flex h-full overflow-hidden">
        <div className="w-full flex flex-col h-full">
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-5 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-2xl space-y-5 animate-fade-in-up">

              {/* Hero */}
              <div className="text-center space-y-2">
                <div className="text-3xl sm:text-4xl select-none">☿</div>
                <h1 className="text-lg sm:text-xl font-semibold text-foreground">{t("chat_hero_title")}</h1>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {t("chat_hero_sub")}
                </p>
              </div>

              {/* Input */}
              <div className={cn(
                "border border-border rounded-xl shadow-sm bg-card overflow-hidden",
                "focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-foreground/20"
              )}>
                <Textarea
                  ref={textareaRef}
                  data-testid="input-query"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
                  }}
                  placeholder={t("chat_placeholder")}
                  className="border-0 shadow-none resize-none focus-visible:ring-0 min-h-[88px] text-sm leading-relaxed bg-transparent px-4 pt-4"
                  rows={3}
                />
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="hidden sm:inline text-xs text-muted-foreground">{t("chat_hint_desktop")}</span>
                  <span className="sm:hidden text-xs text-muted-foreground">{t("chat_hint_mobile")}</span>
                  <Button
                    data-testid="btn-submit-query"
                    size="sm"
                    onClick={() => handleSubmit()}
                    disabled={!query.trim() || isProcessing}
                    className="rounded-lg h-8 px-3 gap-1.5"
                  >
                    {isProcessing
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("btn_thinking")}</>
                      : <>{t("btn_inquire")} <ArrowUp className="w-3.5 h-3.5" /></>
                    }
                  </Button>
                </div>
              </div>

              {/* Recent sessions */}
              {recentSessions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("recent_title")}</p>
                  <div className="grid gap-1.5">
                    {recentSessions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => navigate(`/session/${s.id}`)}
                        className="w-full text-left px-3.5 py-3 rounded-xl border border-border hover:border-foreground/20 hover:bg-accent/20 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0 group-hover:bg-foreground/40 transition-colors" />
                          <p className="text-sm text-foreground truncate flex-1">{s.title || s.query}</p>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-all flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
