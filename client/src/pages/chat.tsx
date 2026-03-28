import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowUp, Clock, Zap, GitBranch, ChevronDown, ChevronRight,
  Plus, Trash2, Search, Users, Repeat2, Thermometer, Check, Save, Star, StarOff, Loader2
} from "lucide-react";
import type { Workflow, Session } from "@shared/schema";

interface ModelOption { id: string; name: string; pricingPrompt?: string; }
interface WizardStep { modelId: string; label: string; systemPrompt: string; }

function parseSteps(raw: string): WizardStep[] {
  try { return JSON.parse(raw); } catch { return []; }
}

// ─── Step indicator ───────────────────────────────────────────
function StepDot({ n, current, done }: { n: number; current: number; done: boolean }) {
  return (
    <div className={cn(
      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all",
      done ? "bg-foreground text-background" :
      n === current ? "border-2 border-foreground text-foreground" :
      "border border-border text-muted-foreground"
    )}>
      {done ? <Check className="w-3 h-3" /> : n}
    </div>
  );
}

// ─── Model search dropdown ────────────────────────────────────
function ModelSearch({
  models, loading, onSelect, placeholder = "Search models…"
}: {
  models: ModelOption[];
  loading: boolean;
  onSelect: (m: ModelOption) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = models
    .filter(m => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          className="pl-9 text-sm"
          placeholder={placeholder}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-lg bg-background shadow-lg z-50 max-h-48 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Loading models…</div>}
          {!loading && filtered.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No models found</div>}
          {filtered.map(m => (
            <button
              key={m.id}
              onMouseDown={() => { onSelect(m); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
            >
              <p className="text-sm font-medium text-foreground">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.id}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inquiry Wizard (5 steps) ─────────────────────────────────
function InquiryWizard({
  query,
  onClose,
  onLaunch,
}: {
  query: string;
  onClose: () => void;
  onLaunch: (config: {
    selectedModels: string[];
    iterations: number;
    temperature: number;
    consensusThreshold: number;
    workflowId?: string;
    saveAs?: string;
  }) => void;
}) {
  const [step, setStep] = useState(1); // 1-5
  const [useExisting, setUseExisting] = useState<string | null>(null); // workflow id or null
  const [teamSize, setTeamSize] = useState(3);
  const [steps, setSteps] = useState<WizardStep[]>([]);
  const [rounds, setRounds] = useState(15);
  const [temperature, setTemperature] = useState(0.7);
  const [consensusThreshold, setConsensusThreshold] = useState(0.7);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: workflows = [] } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });
  const { data: models = [], isLoading: modelsLoading } = useQuery<ModelOption[]>({
    queryKey: ["/api/models"], staleTime: 60_000,
  });
  const { toast } = useToast();

  // If using existing workflow, pre-fill
  function applyWorkflow(wf: Workflow) {
    const s = parseSteps(wf.steps);
    setSteps(s);
    setTeamSize(s.length);
    setRounds(wf.iterations);
    setTemperature(wf.temperature ?? 0.7);
    setConsensusThreshold(wf.consensusThreshold ?? 0.7);
    setSaveName(wf.name);
    setUseExisting(wf.id);
    setStep(5); // jump to review
  }

  function addModel(m: ModelOption) {
    if (steps.length >= teamSize) return;
    setSteps(prev => [...prev, { modelId: m.id, label: m.name, systemPrompt: "" }]);
  }
  function removeModel(i: number) { setSteps(prev => prev.filter((_, j) => j !== i)); }

  async function handleLaunch() {
    if (!steps.length) { toast({ title: "Add at least one model", variant: "destructive" }); return; }
    let workflowId: string | undefined = useExisting ?? undefined;

    if (saveName.trim() && !useExisting) {
      setSaving(true);
      try {
        const res = await apiRequest("POST", "/api/workflows", {
          name: saveName.trim(),
          steps,
          iterations: rounds,
          temperature,
          consensusThreshold,
          isDefault: workflows.length === 0,
        });
        const wf = await res.json();
        workflowId = wf.id;
        await queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
        toast({ title: `Workflow "${saveName}" saved` });
      } catch { toast({ title: "Couldn't save workflow", variant: "destructive" }); }
      setSaving(false);
    }

    onLaunch({
      selectedModels: steps.map(s => s.modelId),
      iterations: rounds,
      temperature,
      consensusThreshold,
      workflowId,
      saveAs: saveName.trim() || undefined,
    });
  }

  const STEPS = [
    { n: 1, label: "Team" },
    { n: 2, label: "Size" },
    { n: 3, label: "Models" },
    { n: 4, label: "Rounds" },
    { n: 5, label: "Config" },
  ];

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Configure your expert team
          </DialogTitle>
          <DialogDescription className="text-xs truncate">{query.slice(0, 80)}{query.length > 80 ? "…" : ""}</DialogDescription>
        </DialogHeader>

        {/* Step bar */}
        <div className="flex items-center gap-1 py-2">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <button
                onClick={() => step > s.n && setStep(s.n)}
                className={cn("flex flex-col items-center gap-1 flex-1", step > s.n && "cursor-pointer")}
              >
                <StepDot n={s.n} current={step} done={step > s.n} />
                <span className={cn("text-[10px]", s.n === step ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && <div className={cn("h-px flex-1 mb-4", step > s.n ? "bg-foreground/30" : "bg-border")} />}
            </div>
          ))}
        </div>

        <div className="space-y-4 pt-1">
          {/* Step 1: Use saved or new */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Do you want to use a saved workflow?</p>
              {workflows.length > 0 ? (
                <div className="space-y-2">
                  {workflows.map(wf => {
                    const s = parseSteps(wf.steps);
                    return (
                      <button
                        key={wf.id}
                        onClick={() => applyWorkflow(wf)}
                        className="w-full text-left p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-accent/30 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{wf.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.length} models · {wf.iterations} rounds · temp {wf.temperature?.toFixed(1)}</p>
                          </div>
                          {wf.isDefault === 1 && <Star className="w-3.5 h-3.5 text-amber-500 fill-current flex-shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => { setUseExisting(null); setStep(2); }}
                    className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Create a new configuration
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-muted-foreground">No saved workflows yet — let's build your first one.</p>
                  <Button onClick={() => setStep(2)}>Get started <ChevronRight className="ml-1 w-4 h-4" /></Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Team size */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">How many experts in your team?</p>
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => setTeamSize(n)}
                    className={cn(
                      "p-3 rounded-lg border text-sm font-medium transition-all",
                      teamSize === n ? "bg-foreground text-background border-foreground" : "border-border text-foreground hover:border-foreground/40"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">More experts = richer debate but slower & higher cost. 3–5 is the sweet spot.</p>
              <Button className="w-full" onClick={() => setStep(3)}>Next — Choose models <ChevronRight className="ml-1 w-4 h-4" /></Button>
            </div>
          )}

          {/* Step 3: Pick models */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Select {teamSize} model{teamSize !== 1 ? "s" : ""}</p>
                <span className="text-xs text-muted-foreground">{steps.length}/{teamSize}</span>
              </div>
              <ModelSearch
                models={models}
                loading={modelsLoading}
                onSelect={addModel}
                placeholder={`Add expert ${steps.length + 1} of ${teamSize}…`}
              />
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 border border-border rounded-lg bg-card">
                  <div className="w-5 h-5 rounded-full bg-foreground text-background text-xs flex items-center justify-center font-semibold flex-shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.modelId}</p>
                  </div>
                  <button onClick={() => removeModel(i)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {steps.length < teamSize && (
                <p className="text-xs text-muted-foreground text-center">
                  Add {teamSize - steps.length} more model{teamSize - steps.length !== 1 ? "s" : ""}
                </p>
              )}
              <Button
                className="w-full"
                disabled={steps.length === 0}
                onClick={() => setStep(4)}
              >
                Next — Debate rounds <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 4: Rounds */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Debate rounds</p>
                  <span className="text-sm font-mono font-semibold text-foreground">{rounds}</span>
                </div>
                <input type="range" min={5} max={30} value={rounds} onChange={e => setRounds(+e.target.value)} className="w-full accent-foreground" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5 — Quick</span><span>15 — Balanced</span><span>30 — Deep</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Each round costs ~1 API call per model. 15 rounds × 3 models = 45 calls.</p>
              <Button className="w-full" onClick={() => setStep(5)}>
                Next — Temperature & consensus <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 5: Temperature + consensus + save */}
          {step === 5 && (
            <div className="space-y-4">
              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Temperature</p>
                  </div>
                  <span className="text-sm font-mono font-semibold text-foreground">{temperature.toFixed(1)}</span>
                </div>
                <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={e => setTemperature(+e.target.value)} className="w-full accent-foreground" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0 — Precise</span><span>0.7 — Balanced</span><span>1 — Creative</span>
                </div>
              </div>

              {/* Consensus threshold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Required consensus</p>
                  </div>
                  <span className="text-sm font-mono font-semibold text-foreground">{Math.round(consensusThreshold * 100)}%</span>
                </div>
                <input type="range" min={0.5} max={1} step={0.05} value={consensusThreshold} onChange={e => setConsensusThreshold(+e.target.value)} className="w-full accent-foreground" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50% — Loose</span><span>70% — Standard</span><span>100% — Strict</span>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">Summary</p>
                <p className="text-muted-foreground">{steps.length} model{steps.length !== 1 ? "s" : ""} · {rounds} rounds · temp {temperature.toFixed(1)} · {Math.round(consensusThreshold * 100)}% consensus</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {steps.map((s, i) => <Badge key={i} variant="secondary" className="text-xs py-0">{s.label.split(" ").slice(-2).join(" ")}</Badge>)}
                </div>
              </div>

              {/* Save option */}
              {!useExisting && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Save className="w-3.5 h-3.5" /> Save as workflow <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input
                    placeholder="e.g. Deep Research, Devil's Advocate…"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}

              <Button className="w-full" onClick={handleLaunch} disabled={saving || steps.length === 0}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Launch inquiry →"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quick answer banner ──────────────────────────────────────
function QuickAnswerBanner({
  query,
  answer,
  onAccept,
  onDebate,
  loading,
}: {
  query: string;
  answer: string;
  onAccept: () => void;
  onDebate: () => void;
  loading: boolean;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card animate-fade-in-up">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-foreground">Quick Answer</span>
        <span className="text-xs text-muted-foreground ml-1">— Detected as a straightforward inquiry</span>
      </div>
      {loading ? (
        <div className="px-4 py-6 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Thinking…</span>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{answer}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={onAccept} className="flex-1">Accept answer</Button>
            <Button size="sm" variant="outline" onClick={onDebate} className="flex-1">
              <GitBranch className="w-3.5 h-3.5 mr-1.5" />
              Run expert debate anyway
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main chat page ───────────────────────────────────────────
export default function ChatPage() {
  const [query, setQuery] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [quickMode, setQuickMode] = useState<null | { sessionId: string; answer: string; loading: boolean }>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: sessions = [] } = useQuery<Session[]>({ queryKey: ["/api/sessions"], staleTime: 5_000 });
  const recentSessions = sessions.slice(0, 6);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  }, [query]);

  // Detect complexity + smart route
  const detectMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/detect-complexity", { query: q });
      return res.json() as Promise<{ complexity: "simple" | "complex" }>;
    },
  });

  // Quick answer
  const quickMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/quick-answer", { query: q, title: q.slice(0, 60) });
      return res.json() as Promise<{ sessionId: string }>;
    },
    onSuccess: (data) => {
      setQuickMode({ sessionId: data.sessionId, answer: "", loading: true });
      // Poll for result via simple fetch
      const poll = setInterval(async () => {
        try {
          const res = await fetch(`./api/sessions/${data.sessionId}`);
          const session = await res.json();
          if (session.status === "completed" && session.quickAnswer) {
            setQuickMode({ sessionId: data.sessionId, answer: session.quickAnswer, loading: false });
            clearInterval(poll);
          } else if (session.status === "error") {
            clearInterval(poll);
            setQuickMode(null);
            toast({ title: "Quick answer failed", variant: "destructive" });
          }
        } catch { /* ignore */ }
      }, 1200);
    },
  });

  // Full inquiry launch
  const inquireMutation = useMutation({
    mutationFn: async (cfg: {
      q: string;
      selectedModels: string[];
      iterations: number;
      temperature: number;
      consensusThreshold: number;
      workflowId?: string;
    }) => {
      const res = await apiRequest("POST", "/api/inquire", {
        query: cfg.q,
        selectedModels: cfg.selectedModels,
        iterations: cfg.iterations,
        title: cfg.q.slice(0, 60),
        workflowId: cfg.workflowId,
        temperature: cfg.temperature,
        consensusThreshold: cfg.consensusThreshold,
      });
      return res.json() as Promise<{ sessionId: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate(`/session/${data.sessionId}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handleSubmit() {
    const q = query.trim();
    if (!q) return;
    setQuickMode(null);

    // Detect complexity
    const { complexity } = await detectMutation.mutateAsync(q);

    if (complexity === "simple") {
      // Show quick answer
      quickMutation.mutate(q);
    } else {
      // Launch wizard
      setShowWizard(true);
    }
  }

  function handleWizardLaunch(cfg: {
    selectedModels: string[];
    iterations: number;
    temperature: number;
    consensusThreshold: number;
    workflowId?: string;
  }) {
    setShowWizard(false);
    inquireMutation.mutate({ q: query.trim(), ...cfg });
  }

  const isProcessing = detectMutation.isPending || quickMutation.isPending || inquireMutation.isPending;

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-2xl space-y-5 animate-fade-in-up">
            {/* Hero */}
            <div className="text-center space-y-2">
              <div className="text-4xl select-none">☿</div>
              <h1 className="text-xl font-semibold text-foreground">What do you want to inquire?</h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Simple questions get an instant answer. Complex ones launch an expert debate.
              </p>
            </div>

            {/* Input box */}
            <div className={cn(
              "border border-border rounded-xl shadow-sm bg-card overflow-hidden transition-all",
              "focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-foreground/20"
            )}>
              <Textarea
                ref={textareaRef}
                data-testid="input-query"
                value={query}
                onChange={e => { setQuery(e.target.value); setQuickMode(null); }}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
                }}
                placeholder="Ask anything — e.g. What are the strongest arguments for and against UBI?"
                className="border-0 shadow-none resize-none focus-visible:ring-0 min-h-[88px] text-sm leading-relaxed bg-transparent px-4 pt-4"
                rows={3}
              />
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground">⌘+Enter to send</span>
                <Button
                  data-testid="btn-submit-query"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!query.trim() || isProcessing}
                  className="rounded-lg h-8 px-3 gap-1.5"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…</>
                  ) : (
                    <>Inquire <ArrowUp className="w-3.5 h-3.5" /></>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick answer result */}
            {quickMode && (
              <QuickAnswerBanner
                query={query.trim()}
                answer={quickMode.answer}
                loading={quickMode.loading}
                onAccept={() => navigate(`/session/${quickMode.sessionId}`)}
                onDebate={() => { setQuickMode(null); setShowWizard(true); }}
              />
            )}

            {/* Recent inquiries */}
            {recentSessions.length > 0 && !quickMode && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent inquiries</p>
                <div className="grid gap-1.5">
                  {recentSessions.map(s => (
                    <button
                      key={s.id}
                      data-testid={`recent-session-${s.id}`}
                      onClick={() => navigate(`/session/${s.id}`)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-accent/40 text-left transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground flex-1 truncate">{s.title}</span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full flex-shrink-0",
                        s.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        s.status === "running" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        s.status === "error" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {s.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showWizard && (
        <InquiryWizard
          query={query.trim()}
          onClose={() => setShowWizard(false)}
          onLaunch={handleWizardLaunch}
        />
      )}
    </Layout>
  );
}
