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
  Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle,
  FlaskConical, MessageCircle, Vote, BarChart3, Award, Sparkles, Zap,
} from "lucide-react";
import type { Session, Iteration } from "@shared/schema";

interface LiveResponse { modelId: string; modelName: string; content: string; }
interface LiveIteration {
  iteration: number;
  phase: string;
  phaseLabel: string;
  responses: LiveResponse[];
  summary: string;
  consensus: number;
}

const PHASE_CFG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  research:  { icon: FlaskConical,  label: "Research",  color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  debate:    { icon: MessageCircle, label: "Debate",    color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/20" },
  vote:      { icon: Vote,          label: "Vote",      color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20" },
  synthesis: { icon: BarChart3,     label: "Synthesis", color: "text-teal-600 dark:text-teal-400",    bg: "bg-teal-50 dark:bg-teal-900/20" },
  final:     { icon: Award,         label: "Final",     color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-900/20" },
};
const PHASES = ["research", "debate", "vote", "synthesis", "final"];

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
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                done ? "bg-foreground text-background" :
                cur ? `${cfg.bg} ${cfg.color} ring-2 ring-current ring-offset-1` :
                "bg-muted text-muted-foreground"
              )}>
                {done ? (
                  <svg viewBox="0 0 10 10" fill="none" className="w-3 h-3">
                    <path d="M1.5 5L3.5 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : cur ? (
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                ) : (
                  <Icon className="w-3 h-3" />
                )}
              </div>
              <span className={cn("text-[10px]", cur ? "text-foreground font-semibold" : "text-muted-foreground")}>
                {cfg.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={cn("flex-1 h-px mb-4 mx-0.5 transition-colors", done ? "bg-foreground/30" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Live response stream ─────────────────────────────────────
function LivePanel({ iters }: { iters: LiveIteration[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [iters.length]);

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
      {iters.map((iter) => {
        const cfg = PHASE_CFG[iter.phase] ?? PHASE_CFG.research;
        const Icon = cfg.icon;
        const pct = iter.consensus ? Math.round(iter.consensus * 100) : null;

        return (
          <div key={iter.iteration} className="animate-fade-in-up">
            {/* Round header */}
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0", cfg.bg)}>
                <Icon className={cn("w-2.5 h-2.5", cfg.color)} />
              </div>
              <span className="text-xs font-semibold text-foreground">Round {iter.iteration} — {cfg.label}</span>
              {pct !== null && (
                <Badge variant="outline" className="text-xs py-0 ml-auto">{pct}% consensus</Badge>
              )}
            </div>
            {/* Model responses */}
            {iter.responses.map((r, i) => (
              <div key={i} className={cn(
                "ml-6 mb-1.5 px-3 py-2 rounded-lg text-xs border",
                r.content.startsWith("[Error:") ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
              )}>
                <p className="font-medium text-foreground mb-1">{r.modelName}</p>
                <p className="text-muted-foreground leading-relaxed">
                  {r.content.slice(0, 280)}{r.content.length > 280 ? "…" : ""}
                </p>
              </div>
            ))}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Iteration accordion (completed view) ─────────────────────
function IterCard({ iter, idx }: { iter: LiveIteration; idx: number }) {
  const [open, setOpen] = useState(false);
  const cfg = PHASE_CFG[iter.phase] ?? PHASE_CFG.research;
  const Icon = cfg.icon;
  const pct = iter.consensus ? Math.round(iter.consensus * 100) : null;

  return (
    <div className="border border-border rounded-lg overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 30}ms` }}>
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
          {pct !== null && <span className="text-xs font-semibold text-green-600 dark:text-green-400">{pct}%</span>}
          <span className="text-xs text-muted-foreground">{iter.responses.length} models</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && iter.responses.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {iter.responses.map((r, i) => (
            <div key={i} className="px-4 py-3">
              <p className="text-xs font-semibold text-foreground mb-1.5">{r.modelName || r.modelId}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{r.content.slice(0, 400)}{r.content.length > 400 ? "…" : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Results section ──────────────────────────────────────────
function Results({ session, iterations, isQuick }: { session: Session; iterations: Iteration[]; isQuick?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const finalAnswer = session.finalAnswer ?? session.quickAnswer ?? "";

  const lastIter = iterations[iterations.length - 1];
  const consensus = lastIter?.consensus ? Math.round(lastIter.consensus * 100) : null;

  const allModels: string[] = [];
  for (const it of iterations) {
    try {
      (JSON.parse(it.content) as LiveResponse[]).forEach(r => {
        const n = r.modelName || r.modelId;
        if (!allModels.includes(n)) allModels.push(n);
      });
    } catch {}
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(finalAnswer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast({ title: "Copy failed", variant: "destructive" }); }
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
      {/* Header */}
      <div className={cn(
        "border rounded-xl p-4",
        isQuick
          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40"
          : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
            isQuick ? "bg-amber-100 dark:bg-amber-900/40" : "bg-green-100 dark:bg-green-900/40"
          )}>
            {isQuick
              ? <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              : <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isQuick ? "Quick answer" : "Inquiry complete"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isQuick ? "Single model · instant response" : `${iterations.length} rounds · ${allModels.length} expert${allModels.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {!isQuick && consensus !== null && (
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 leading-none">{consensus}%</p>
              <p className="text-xs text-muted-foreground">consensus</p>
            </div>
          )}
        </div>
        {!isQuick && allModels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {allModels.slice(0, 6).map((m, i) => <Badge key={i} variant="secondary" className="text-xs py-0">{m}</Badge>)}
            {allModels.length > 6 && <Badge variant="secondary" className="text-xs py-0">+{allModels.length - 6}</Badge>}
          </div>
        )}
      </div>

      {/* Answer */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-foreground/50" />
            <span className="text-sm font-semibold text-foreground">
              {isQuick ? "Answer" : "Consensus Answer"}
            </span>
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
              <Download className="w-3.5 h-3.5" /> .md
            </button>
          </div>
        </div>
        <div className="p-5">
          {finalAnswer
            ? <div className="mercury-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(finalAnswer) }} />
            : <p className="text-sm text-muted-foreground italic">No answer generated.</p>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Main session page ────────────────────────────────────────
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  const [liveIters, setLiveIters] = useState<LiveIteration[]>([]);
  const [currentPhase, setCurrentPhase] = useState("research");
  const [showLive, setShowLive] = useState(true); // live panel open by default

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sessions"] }); navigate("/chat"); },
  });

  // WebSocket for live updates
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
              iteration: d.iteration,
              phase: d.phase ?? "research",
              phaseLabel: d.phaseLabel ?? d.phase ?? "Research",
              responses: d.responses ?? [],
              summary: d.summary ?? "",
              consensus: d.consensus ?? 0,
            }];
          });
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
        }
        if (d.type === "completed" || d.type === "quick_complete") {
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
      let responses: LiveResponse[] = [];
      try { responses = JSON.parse(it.content) ?? []; } catch {}
      return { iteration: it.iterationNumber, phase: it.type, phaseLabel: it.type, responses, summary: it.summary ?? "", consensus: it.consensus ?? 0 };
    });

  const isRunning = session?.status === "running";
  const isCompleted = session?.status === "completed";
  const isError = session?.status === "error";
  const isQuick = !!(session?.quickAnswer && storedIters.length === 0);
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
        <h2 className="font-semibold text-foreground">Inquiry not found</h2>
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
                <span className="text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <button
              data-testid="btn-delete"
              onClick={() => confirm("Delete this inquiry?") && deleteMutation.mutate()}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Inquiry text */}
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Inquiry</p>
            <p className="text-sm text-foreground">{session.query}</p>
          </div>

          {/* ── Running state ── */}
          {isRunning && (
            <div className="border border-border rounded-xl p-4 space-y-4 bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Round {session.currentIteration} of {session.totalIterations}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{currentPhase} phase</p>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
              <PhaseTimeline currentPhase={currentPhase} />

              {/* Live view toggle */}
              <button
                data-testid="btn-toggle-live"
                onClick={() => setShowLive(!showLive)}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 border-t border-border"
              >
                {showLive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showLive ? "Hide" : "View"} live progress
                {showLive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          )}

          {/* ── Live panel (real-time responses stream) ── */}
          {isRunning && showLive && liveIters.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-semibold text-foreground">Live — Expert debate in progress</span>
                <Badge variant="outline" className="text-xs py-0 ml-auto">{liveIters.length} round{liveIters.length !== 1 ? "s" : ""} complete</Badge>
              </div>
              <div className="p-4">
                <LivePanel iters={liveIters} />
              </div>
            </div>
          )}

          {/* Running spinner */}
          {isRunning && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Expert panel is debating your inquiry…
            </div>
          )}

          {/* ── Completed: iteration history ── */}
          {isCompleted && !isQuick && allIters.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Debate history</h3>
                <span className="text-xs text-muted-foreground">{allIters.length} rounds</span>
              </div>
              {allIters.map((it, i) => <IterCard key={it.iteration} iter={it} idx={i} />)}
            </div>
          )}

          {/* ── Results ── */}
          {isCompleted && <Results session={session} iterations={storedIters} isQuick={isQuick} />}

          {/* ── Error ── */}
          {isError && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Inquiry failed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Check your API key in Settings and try again.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/chat")}>
                New inquiry
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
