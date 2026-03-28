import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { cn } from "@/lib/utils";
import type { Session, Iteration } from "@shared/schema";
import {
  ChevronDown, ChevronUp, Bot, Copy, CheckCheck, Trash2,
  BarChart3, Sparkles, MessageCircle, Vote, FlaskConical, Award,
  ArrowLeft, Clock, CheckCircle2, AlertTriangle, Loader2
} from "lucide-react";
import { getProvider, getProviderName } from "@/lib/models";
import { useToast } from "@/hooks/use-toast";

interface LiveIteration {
  iteration: number;
  phase: string;
  responses: Array<{ modelId: string; modelName: string; content: string }>;
  summary: string;
  consensus: number;
  type: string;
}

const PHASE_ICONS: Record<string, React.ElementType> = {
  research: FlaskConical,
  debate: MessageCircle,
  vote: Vote,
  synthesis: BarChart3,
  final: Award,
};

const PHASE_COLORS: Record<string, string> = {
  research: "text-blue-400",
  debate: "text-amber-400",
  vote: "text-purple-400",
  synthesis: "text-teal-400",
  final: "text-emerald-400",
};

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [liveIterations, setLiveIterations] = useState<LiveIteration[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const { data: session, isLoading } = useQuery<Session>({
    queryKey: ["/api/sessions", id],
    refetchInterval: (data) => (data?.status === "running" ? 2000 : false),
  });

  const { data: storedIterations } = useQuery<Iteration[]>({
    queryKey: ["/api/sessions", id, "iterations"],
    refetchInterval: (data) => (session?.status === "running" ? 3000 : false),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate("/");
    },
  });

  // Connect WebSocket for live updates
  useEffect(() => {
    if (!id) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${id}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "iteration_start") {
          setCurrentPhase(data.phase);
        }

        if (data.type === "iteration_complete") {
          setLiveIterations((prev) => {
            const exists = prev.find((i) => i.iteration === data.iteration);
            if (exists) return prev;
            return [...prev, {
              iteration: data.iteration,
              phase: data.phase,
              responses: data.responses ?? [],
              summary: data.summary ?? "",
              consensus: data.consensus ?? 0,
              type: data.type,
            }];
          });
          setCurrentPhase("");
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
        }

        if (data.type === "completed") {
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id, "iterations"] });
        }
      } catch {}
    };

    return () => ws.close();
  }, [id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveIterations.length]);

  // Merge stored + live iterations
  const allIterations = (() => {
    if (!storedIterations) return liveIterations;
    const stored = storedIterations.map((iter) => {
      let responses = [];
      try { responses = JSON.parse(iter.content); } catch {}
      return {
        iteration: iter.iterationNumber,
        phase: iter.type,
        responses,
        summary: iter.summary ?? "",
        consensus: iter.consensus ?? 0,
        type: iter.type,
      } as LiveIteration;
    });
    // Merge: prefer stored, supplement with live
    const storedNums = new Set(stored.map((i) => i.iteration));
    const liveOnly = liveIterations.filter((i) => !storedNums.has(i.iteration));
    return [...stored, ...liveOnly].sort((a, b) => a.iteration - b.iteration);
  })();

  function toggleExpand(iter: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(iter) ? next.delete(iter) : next.add(iter);
      return next;
    });
  }

  async function copyAnswer() {
    if (!session?.finalAnswer) return;
    await navigator.clipboard.writeText(session.finalAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getModelBadgeClass(modelId: string) {
    const p = getProvider(modelId);
    const map: Record<string, string> = {
      anthropic: "model-anthropic",
      openai: "model-openai",
      google: "model-google",
      meta: "model-meta",
      mistral: "model-mistral",
      deepseek: "model-deepseek",
      qwen: "model-qwen",
    };
    return map[p] ?? "model-default";
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertTriangle className="w-8 h-8" />
          <p>Session not found</p>
        </div>
      </Layout>
    );
  }

  const selectedModels: string[] = (() => {
    try { return JSON.parse(session.selectedModels); } catch { return []; }
  })();

  const progress = session.totalIterations > 0
    ? Math.round((session.currentIteration / session.totalIterations) * 100)
    : 0;

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border bg-card px-6 py-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate("/")}
              className="mt-0.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold",
                  session.status === "running" && "bg-amber-500/15 text-amber-400",
                  session.status === "completed" && "bg-emerald-500/15 text-emerald-400",
                  session.status === "error" && "bg-red-500/15 text-red-400",
                  session.status === "pending" && "bg-secondary text-muted-foreground",
                )}>
                  {session.status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
                  {session.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                  {session.status === "error" && <AlertTriangle className="w-3 h-3" />}
                  {session.status === "pending" && <Clock className="w-3 h-3" />}
                  {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </span>

                {session.status === "running" && currentPhase && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    {currentPhase}...
                  </span>
                )}
              </div>

              <h1 className="font-display font-700 text-lg text-foreground truncate" data-testid="session-title">
                {session.title}
              </h1>

              <div className="flex items-center gap-3 mt-1.5">
                {/* Progress bar */}
                {session.status === "running" && (
                  <div className="flex-1 max-w-xs flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {session.currentIteration}/{session.totalIterations}
                    </span>
                  </div>
                )}

                {/* Model pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  {selectedModels.slice(0, 5).map((m) => (
                    <span key={m} className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                      getModelBadgeClass(m)
                    )}>
                      {m.split("/").pop()}
                    </span>
                  ))}
                  {selectedModels.length > 5 && (
                    <span className="text-[10px] text-muted-foreground">+{selectedModels.length - 5}</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => deleteMutation.mutate()}
              data-testid="btn-delete-session"
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Final Answer — pinned at top if completed */}
          {session.status === "completed" && session.finalAnswer && (
            <div className="m-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Consensus Answer</span>
                  <span className="text-xs text-muted-foreground">
                    from {allIterations.length} iterations · {selectedModels.length} models
                  </span>
                </div>
                <button
                  onClick={copyAnswer}
                  data-testid="btn-copy-answer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="p-5">
                <div
                  className="prose-mercury text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(session.finalAnswer) }}
                />
              </div>
            </div>
          )}

          {/* Iterations */}
          <div className="px-6 pb-6 space-y-3">
            {allIterations.map((iter) => {
              const Icon = PHASE_ICONS[iter.phase] ?? Bot;
              const colorClass = PHASE_COLORS[iter.phase] ?? "text-muted-foreground";
              const isExpanded = expanded.has(iter.iteration);
              const successResponses = iter.responses.filter((r) => !r.content.startsWith("Error:"));

              return (
                <div
                  key={iter.iteration}
                  className="rounded-xl border border-border bg-card overflow-hidden animate-slide-in"
                  data-testid={`iteration-${iter.iteration}`}
                >
                  <button
                    onClick={() => toggleExpand(iter.iteration)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/20 transition-all"
                  >
                    <div className={cn("w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0", colorClass)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{iter.iteration}</span>
                        <span className={cn("text-xs font-semibold capitalize", colorClass)}>{iter.phase}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{successResponses.length} responses</span>
                        {iter.consensus > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-emerald-400">{Math.round(iter.consensus * 100)}% consensus</span>
                          </>
                        )}
                      </div>
                      {iter.summary && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{iter.summary}</div>
                      )}
                    </div>

                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/50 divide-y divide-border/30">
                      {iter.responses.map((resp, ri) => (
                        <div key={ri} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                              getModelBadgeClass(resp.modelId)
                            )}>
                              {resp.modelName || resp.modelId.split("/").pop()}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{getProviderName(resp.modelId)}</span>
                          </div>
                          <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-body">
                            {resp.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Active iteration skeleton */}
            {session.status === "running" && (
              <div className="rounded-xl border border-primary/20 bg-card overflow-hidden animate-pulse-ring">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <div className="skeleton h-3 w-32 mb-1.5" />
                    <div className="skeleton h-2 w-48" />
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {allIterations.length === 0 && session.status !== "running" && (
              <div className="text-center py-16 text-muted-foreground">
                <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No iterations yet</p>
              </div>
            )}
          </div>

          <div ref={bottomRef} />
        </div>
      </div>
    </Layout>
  );
}

// Simple markdown renderer
function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul]|<p|<block)(.+)$/gm, "<p>$1</p>");
}
