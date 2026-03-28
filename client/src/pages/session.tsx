import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Trash2, Copy, CheckCheck, Download, ChevronDown, ChevronUp,
  Eye, Loader2, CheckCircle2, AlertTriangle, FlaskConical, MessageCircle,
  Vote, BarChart3, Award, Sparkles, X
} from "lucide-react";
import type { Session, Iteration } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────
interface LiveIteration {
  iteration: number;
  phase: string;
  responses: { modelId: string; modelName: string; content: string }[];
  summary: string;
  consensus: number;
}

const PHASE_CFG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  research:  { icon: FlaskConical,  label: "Research",  color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-100 dark:bg-blue-900/30" },
  debate:    { icon: MessageCircle, label: "Debate",    color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  vote:      { icon: Vote,          label: "Vote",      color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/30" },
  synthesis: { icon: BarChart3,     label: "Synthesis", color: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-100 dark:bg-teal-900/30" },
  final:     { icon: Award,         label: "Final",     color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
};
const PHASES = ["research", "debate", "vote", "synthesis", "final"];

// Simple markdown → HTML renderer
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hubol])(.+)$/gm, (m) => m.trim() ? `<p>${m}</p>` : "");
}

// ─── Phase timeline ──────────────────────────────────────────
function PhaseTimeline({ currentPhase }: { currentPhase: string }) {
  const idx = PHASES.indexOf(currentPhase);
  return (
    <div className="flex items-center gap-0.5">
      {PHASES.map((phase, i) => {
        const cfg = PHASE_CFG[phase];
        const Icon = cfg.icon;
        const done = idx > i;
        const cur = idx === i;
        return (
          <div key={phase} className="flex items-center flex-1">
            <div className={cn(
              "flex flex-col items-center gap-1 flex-1",
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                done ? "bg-foreground text-background" :
                cur ? `${cfg.bg} ${cfg.color}` :
                "bg-muted text-muted-foreground"
              )}>
                {done ? (
                  <svg viewBox="0 0 10 10" fill="none" className="w-3 h-3">
                    <path d="M1.5 5L3.5 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <Icon className="w-3 h-3" />
                )}
              </div>
              <span className={cn("text-[10px]", cur ? "text-foreground font-medium" : "text-muted-foreground")}>
                {cfg.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={cn("flex-1 h-px mb-4 mx-0.5", done ? "bg-foreground/30" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Iteration card ──────────────────────────────────────────
function IterCard({ iter, idx }: { iter: LiveIteration; idx: number }) {
  const [open, setOpen] = useState(false);
  const cfg = PHASE_CFG[iter.phase] ?? PHASE_CFG.research;
  const Icon = cfg.icon;
  const pct = iter.consensus ? Math.round(iter.consensus * 100) : null;

  return (
    <div className="border border-border rounded-lg overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 40}ms` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
      >
        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0", cfg.bg)}>
          <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Round {iter.iteration} — {cfg.label}</p>
          {iter.summary && <p className="text-xs text-muted-foreground truncate mt-0.5">{iter.summary}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pct !== null && (
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">{pct}%</span>
          )}
          <span className="text-xs text-muted-foreground">{iter.responses.length} models</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && iter.responses.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {iter.responses.map((r, i) => (
            <div key={i} className="px-4 py-3">
              <p className="text-xs font-medium text-foreground mb-1">{r.modelName || r.modelId}</p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Results section ─────────────────────────────────────────
function Results({ session, iterations }: { session: Session; iterations: Iteration[] }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const finalAnswer = session.finalAnswer ?? "";

  const lastIter = iterations[iterations.length - 1];
  const consensus = lastIter?.consensus ? Math.round(lastIter.consensus * 100) : null;

  const allModels: string[] = [];
  for (const it of iterations) {
    try {
      const parsed = JSON.parse(it.content);
      (parsed.responses ?? []).forEach((r: any) => {
        const name = r.modelName || r.modelId;
        if (!allModels.includes(name)) allModels.push(name);
      });
    } catch {}
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(finalAnswer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  function download() {
    const blob = new Blob([`# ${session.title}\n\n${finalAnswer}`], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${session.title.slice(0, 40).replace(/[^a-z0-9]/gi, "-")}.md`;
    a.click();
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header card */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Research complete</p>
            <p className="text-xs text-muted-foreground">{iterations.length} rounds · {allModels.length} models</p>
          </div>
          {consensus !== null && (
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 leading-none">{consensus}%</p>
              <p className="text-xs text-muted-foreground">consensus</p>
            </div>
          )}
        </div>
        {allModels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {allModels.slice(0, 6).map((m, i) => (
              <Badge key={i} variant="secondary" className="text-xs py-0">{m}</Badge>
            ))}
            {allModels.length > 6 && <Badge variant="secondary" className="text-xs py-0">+{allModels.length - 6}</Badge>}
          </div>
        )}
      </div>

      {/* Final answer */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-foreground/60" />
            <span className="text-sm font-semibold text-foreground">Final Answer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              data-testid="btn-copy-answer"
              onClick={copy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              data-testid="btn-download-answer"
              onClick={download}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              .md
            </button>
          </div>
        </div>
        <div className="p-5">
          {finalAnswer ? (
            <div
              className="mercury-prose"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(finalAnswer) }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">No answer generated.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Session page ────────────────────────────────────────────
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  const [liveIters, setLiveIters] = useState<LiveIteration[]>([]);
  const [currentPhase, setCurrentPhase] = useState("research");
  const [showDetails, setShowDetails] = useState(false);

  const { data: session, isLoading } = useQuery<Session>({
    queryKey: ["/api/sessions", id],
    refetchInterval: q => (q.state.data as Session | undefined)?.status === "running" ? 2000 : false,
  });

  const { data: storedIters = [] } = useQuery<Iteration[]>({
    queryKey: ["/api/sessions", id, "iterations"],
    enabled: !!id,
    refetchInterval: () => session?.status === "running" ? 3000 : false,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate("/chat");
    },
  });

  // WebSocket
  useEffect(() => {
    if (!id) return;
    const base = new URL("./ws", location.href);
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${base.href}?sessionId=${id}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === "iteration_start") setCurrentPhase(d.phase ?? "research");
        if (d.type === "iteration_complete") {
          setLiveIters(prev => {
            if (prev.find(i => i.iteration === d.iteration)) return prev;
            return [...prev, {
              iteration: d.iteration, phase: d.phase ?? "research",
              responses: d.responses ?? [], summary: d.summary ?? "", consensus: d.consensus ?? 0,
            }];
          });
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
        }
        if (d.type === "session_complete" || d.type === "final") {
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id, "iterations"] });
        }
        if (d.type === "error") toast({ title: "Error", description: d.message, variant: "destructive" });
      } catch {}
    };
    return () => ws.close();
  }, [id]);

  const allIters: LiveIteration[] = liveIters.length > 0
    ? liveIters
    : storedIters.map(it => {
      let responses: any[] = [];
      try { responses = JSON.parse(it.content)?.responses ?? []; } catch {}
      return { iteration: it.iterationNumber, phase: it.type, responses, summary: it.summary ?? "", consensus: it.consensus ?? 0 };
    });

  const isRunning = session?.status === "running";
  const isCompleted = session?.status === "completed";
  const isError = session?.status === "error";
  const progress = session && session.totalIterations > 0
    ? Math.round((session.currentIteration / session.totalIterations) * 100) : 0;

  if (isLoading) return (
    <Layout>
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    </Layout>
  );

  if (!session) return (
    <Layout>
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <AlertTriangle className="w-10 h-10 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Session not found</h2>
        <Button variant="outline" onClick={() => navigate("/chat")}>Go back</Button>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <button
              data-testid="btn-back"
              onClick={() => navigate("/chat")}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0 mt-0.5"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-foreground leading-snug">{session.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium",
                  isRunning ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                  isCompleted ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  isError ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                  "bg-muted text-muted-foreground"
                )}>
                  {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                  {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                  {isError && <AlertTriangle className="w-3 h-3" />}
                  <span className="capitalize">{session.status}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(session.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
            <button
              data-testid="btn-delete"
              onClick={() => confirm("Delete this session?") && deleteMutation.mutate()}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Query */}
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Research query</p>
            <p className="text-sm text-foreground">{session.query}</p>
          </div>

          {/* Progress — while running */}
          {isRunning && (
            <div className="border border-border rounded-xl p-4 space-y-4 bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Round {session.currentIteration} of {session.totalIterations}</p>
                  <p className="text-xs text-muted-foreground capitalize">{currentPhase} phase</p>
                </div>
                <span className="text-2xl font-bold text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
              <PhaseTimeline currentPhase={currentPhase} />
              <button
                data-testid="btn-toggle-details"
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                {showDetails ? "Hide" : "Show"} live details
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          )}

          {/* Iterations */}
          {(showDetails || isCompleted) && allIters.length > 0 && (
            <div className="space-y-2">
              {isCompleted && (
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Research process</h3>
                  <span className="text-xs text-muted-foreground">{allIters.length} rounds</span>
                </div>
              )}
              {allIters.map((it, i) => (
                <IterCard key={it.iteration} iter={it} idx={i} />
              ))}
            </div>
          )}

          {/* Results */}
          {isCompleted && <Results session={session} iterations={storedIters} />}

          {/* Error */}
          {isError && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Research failed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Check your API key and try again.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/chat")}>
                Try again
              </Button>
            </div>
          )}

          {/* Running indicator */}
          {isRunning && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Models are debating your query…
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
