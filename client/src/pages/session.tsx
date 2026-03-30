import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Trash2, Copy, CheckCheck, Download, ChevronDown, ChevronUp,
  Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle,
  FlaskConical, MessageCircle, Vote, BarChart3, Award, Sparkles, Zap,
  CornerDownRight, ArrowUp, Pin, PinOff, Pencil, Check, X,
  Bolt, GitBranch, Star, Save, Thermometer, SlidersHorizontal, Search,
} from "lucide-react";
import type { Session, Iteration, Workflow } from "@shared/schema";

interface LiveResponse { modelId: string; modelName: string; content: string; }
interface LiveIteration {
  iteration: number;
  phase: string;
  phaseLabel: string;
  responses: LiveResponse[];
  summary: string;
  consensus: number;
}
interface FollowUpEntry { query: string; answer: string; createdAt: number; }
interface DebateEntry { sessionId: string; query: string; createdAt: number; }
interface ModelOption { id: string; name: string; }
interface WizardStep { modelId: string; label: string; systemPrompt: string; }
function parseWizardSteps(raw: string): WizardStep[] { try { return JSON.parse(raw); } catch { return []; } }

// Quick-debate defaults (mirrors chat.tsx)
const QUICK_MODELS = ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-001"];
const QUICK_ROUNDS = 3;
const QUICK_TEMP = 0.3;
const QUICK_THRESHOLD = 0.7;

const PHASE_CFG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  research:  { icon: FlaskConical,  label: "Research",  color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  debate:    { icon: MessageCircle, label: "Debate",    color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/20" },
  vote:      { icon: Vote,          label: "Vote",      color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20" },
  synthesis: { icon: BarChart3,     label: "Synthesis", color: "text-teal-600 dark:text-teal-400",    bg: "bg-teal-50 dark:bg-teal-900/20" },
  final:     { icon: Award,         label: "Final",     color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-900/20" },
};
const PHASES = ["research", "debate", "vote", "synthesis", "final"];

function renderMarkdown(md: string): string {
  if (!md) return "";
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };

  // Inline: bold, italic, code, inline-code
  const inline = (s: string) => s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (/^### (.+)$/.test(line)) { closeList(); out.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }
    if (/^## (.+)$/.test(line))  { closeList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (/^# (.+)$/.test(line))   { closeList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }

    // Blockquote
    if (/^> (.+)$/.test(line)) { closeList(); out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); continue; }

    // Unordered list
    if (/^[-*] (.+)$/.test(line)) {
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\d+)\. (.+)$/);
    if (olMatch) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(olMatch[2])}</li>`);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { closeList(); out.push("<hr />"); continue; }

    // Blank line
    if (line.trim() === "") { closeList(); continue; }

    // Regular paragraph line
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return out.join("\n");
}

// ─── Phase timeline ──────────────────────────────────────────
// ─── Model search ────────────────────────────────────────────────
function ModelSearch({ models, loading, onSelect, placeholder = "Search models…" }: {
  models: ModelOption[]; loading: boolean; onSelect: (m: ModelOption) => void; placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = models.filter(m => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input className="pl-9 text-sm" placeholder={placeholder} value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-xl bg-background shadow-2xl z-50 max-h-64 overflow-y-auto">
          {loading && <div className="px-4 py-3 text-xs text-muted-foreground">Loading models…</div>}
          {!loading && filtered.length === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">{q ? `No models found for "${q}"` : "Start typing…"}</div>}
          {filtered.map(m => (
            <button key={m.id} onMouseDown={e => { e.preventDefault(); onSelect(m); setQ(""); setOpen(false); }}
              className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/40 last:border-0">
              <p className="text-sm font-medium text-foreground">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.id}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Debate starter ───────────────────────────────────────────
function DebateStarter({ query, onLaunchDebate, onCustomSetup }: {
  query: string;
  onLaunchDebate: (cfg: { selectedModels: string[]; iterations: number; temperature: number; consensusThreshold: number; workflowId?: string }) => void;
  onCustomSetup: () => void;
}) {
  const { data: workflows = [], isLoading: wfLoading } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });
  const [launching, setLaunching] = useState(false);

  function launch(cfg: Parameters<typeof onLaunchDebate>[0]) { setLaunching(true); onLaunchDebate(cfg); }

  return (
    <div className="space-y-2.5 animate-fade-in-up">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How do you want to run the debate?</p>
      <button onClick={() => launch({ selectedModels: QUICK_MODELS, iterations: QUICK_ROUNDS, temperature: QUICK_TEMP, consensusThreshold: QUICK_THRESHOLD })}
        disabled={launching}
        className={cn("w-full text-left p-4 rounded-xl border border-border hover:border-foreground/30 hover:bg-accent/20 transition-all group flex items-start gap-3.5", launching && "opacity-50 cursor-not-allowed")}>
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bolt className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Quick debate</p>
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium">Recommended</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Top 3 models · {QUICK_ROUNDS} rounds · temp {QUICK_TEMP} — fast and reliable.</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {["GPT-4o", "Claude 3.5", "Gemini 2.0"].map(l => <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">{l}</span>)}
          </div>
        </div>
        {launching ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 -rotate-90 text-muted-foreground group-hover:text-foreground flex-shrink-0 mt-1 transition-colors" />}
      </button>
      {!wfLoading && workflows.length > 0 && (
        <div className="space-y-1.5">
          {workflows.map(wf => {
            const wfSteps = parseWizardSteps(wf.steps);
            return (
              <button key={wf.id} onClick={() => launch({ selectedModels: wfSteps.map(s => s.modelId), iterations: wf.iterations, temperature: wf.temperature ?? 0.7, consensusThreshold: wf.consensusThreshold ?? 0.7, workflowId: wf.id })}
                disabled={launching}
                className={cn("w-full text-left p-3.5 rounded-xl border border-border hover:border-foreground/30 hover:bg-accent/20 transition-all group flex items-center gap-3", launching && "opacity-50 cursor-not-allowed")}>
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {wf.isDefault === 1 ? <Star className="w-3.5 h-3.5 text-amber-500 fill-current" /> : <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{wf.name}</p>
                  <p className="text-xs text-muted-foreground">{wfSteps.length} model{wfSteps.length !== 1 ? "s" : ""} · {wf.iterations} rounds</p>
                </div>
                <ChevronDown className="w-4 h-4 -rotate-90 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>
      )}
      <button onClick={onCustomSetup} disabled={launching}
        className={cn("w-full text-left p-3.5 rounded-xl border border-dashed border-border hover:border-foreground/30 hover:bg-accent/10 transition-all group flex items-center gap-3", launching && "opacity-50 cursor-not-allowed")}>
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Custom setup</p>
          <p className="text-xs text-muted-foreground">Choose models, rounds, temperature and more.</p>
        </div>
        <ChevronDown className="w-4 h-4 -rotate-90 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors" />
      </button>
    </div>
  );
}

// ─── Inquiry wizard (split-panel) ─────────────────────────────
function InquiryWizard({ query, onClose, onLaunch }: {
  query: string; onClose: () => void;
  onLaunch: (cfg: { selectedModels: string[]; iterations: number; temperature: number; consensusThreshold: number; workflowId?: string }) => void;
}) {
  const { data: workflows = [] } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });
  const { data: models = [], isLoading: modelsLoading } = useQuery<ModelOption[]>({ queryKey: ["/api/models"], staleTime: 60_000 });
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [teamSize, setTeamSize] = useState(3);
  const [wSteps, setWSteps] = useState<WizardStep[]>([]);
  const [rounds, setRounds] = useState(15);
  const [temperature, setTemperature] = useState(0.7);
  const [threshold, setThreshold] = useState(0.7);
  const [wantToSave, setWantToSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo(0, 0); }, [step]);

  function addModel(m: ModelOption) { if (wSteps.length < teamSize) setWSteps(prev => [...prev, { modelId: m.id, label: m.name, systemPrompt: "" }]); }
  function removeModel(i: number) { setWSteps(prev => prev.filter((_, j) => j !== i)); }
  function updatePrompt(i: number, v: string) { setWSteps(prev => prev.map((s, j) => j === i ? { ...s, systemPrompt: v } : s)); }

  async function handleLaunch() {
    if (!wSteps.length) { toast({ title: "Please add at least one model.", variant: "destructive" }); return; }
    let workflowId: string | undefined;
    if (wantToSave && saveName.trim()) {
      setSaving(true);
      try {
        const res = await apiRequest("POST", "/api/workflows", { name: saveName.trim(), steps: wSteps, iterations: rounds, temperature, consensusThreshold: threshold, isDefault: workflows.length === 0 });
        const wf = await res.json(); workflowId = wf.id;
        await queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
        toast({ title: `Workflow "${saveName.trim()}" saved.` });
      } catch { toast({ title: "Could not save workflow.", variant: "destructive" }); }
      setSaving(false);
    }
    onLaunch({ selectedModels: wSteps.map(s => s.modelId), iterations: rounds, temperature, consensusThreshold: threshold, workflowId });
  }

  const WSTEPS = [{ n: 1, label: "Size" }, { n: 2, label: "Models" }, { n: 3, label: "Rounds" }, { n: 4, label: "Config" }];
  return (
    <div className="flex flex-col h-full w-full max-w-xl border-l border-border bg-background">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <div><p className="text-sm font-semibold text-foreground">Custom setup</p><p className="text-xs text-muted-foreground truncate max-w-xs">{query.slice(0, 60)}{query.length > 60 ? "…" : ""}</p></div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-1 px-5 py-3 border-b border-border flex-shrink-0">
        {WSTEPS.map((s, i) => {
          const isActive = s.n === step, isDone = s.n < step;
          return (
            <div key={s.n} className="flex items-center flex-1">
              <button onClick={() => isDone && setStep(s.n)} className={cn("flex flex-col items-center gap-1 flex-1", isDone && "cursor-pointer")}>
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all",
                  isDone ? "bg-foreground text-background" : isActive ? "border-2 border-foreground text-foreground" : "border border-border text-muted-foreground")}>
                  {isDone ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={cn("text-[10px]", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>{s.label}</span>
              </button>
              {i < WSTEPS.length - 1 && <div className={cn("h-px flex-1 mb-4 mx-0.5", isDone ? "bg-foreground/30" : "bg-border")} />}
            </div>
          );
        })}
      </div>
      <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">How many experts in your team?</p>
            <div className="grid grid-cols-4 gap-2">
              {[2,3,4,5,6,8,10,12].map(n => (
                <button key={n} onClick={() => setTeamSize(n)} className={cn("py-3 rounded-xl border text-sm font-semibold transition-all",
                  teamSize === n ? "bg-foreground text-background border-foreground" : "border-border text-foreground hover:border-foreground/40")}>{n}</button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>Choose models <ChevronDown className="ml-1 w-4 h-4 -rotate-90" /></Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Select {teamSize} model{teamSize !== 1 ? "s" : ""}</p>
              <span className="text-xs text-muted-foreground tabular-nums">{wSteps.length} / {teamSize}</span>
            </div>
            <ModelSearch models={models} loading={modelsLoading} onSelect={addModel}
              placeholder={wSteps.length < teamSize ? `Add expert ${wSteps.length + 1} of ${teamSize}…` : "Team complete"} />
            <div className="space-y-2">
              {wSteps.map((s, i) => (
                <div key={i} className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="w-5 h-5 rounded-full bg-foreground text-background text-[11px] flex items-center justify-center font-bold flex-shrink-0">{i+1}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{s.label}</p><p className="text-xs text-muted-foreground truncate">{s.modelId}</p></div>
                    <button onClick={() => removeModel(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="px-3.5 pb-3 pt-2 border-t border-border/40">
                    <Textarea placeholder={`Role for ${s.label.split(" ")[0]}…`} value={s.systemPrompt} onChange={e => updatePrompt(i, e.target.value)}
                      className="text-xs resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50 min-h-[2rem]" rows={2} />
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full" disabled={wSteps.length === 0} onClick={() => setStep(3)}>Set rounds <ChevronDown className="ml-1 w-4 h-4 -rotate-90" /></Button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between"><p className="text-sm font-medium text-foreground">Debate rounds</p><span className="text-sm font-mono font-bold text-foreground">{rounds}</span></div>
              <input type="range" min={5} max={30} value={rounds} onChange={e => setRounds(+e.target.value)} className="w-full accent-foreground" />
              <div className="flex justify-between text-xs text-muted-foreground"><span>5 — Quick</span><span>15 — Balanced</span><span>30 — Deep</span></div>
            </div>
            <Button className="w-full" onClick={() => setStep(4)}>Temperature &amp; consensus <ChevronDown className="ml-1 w-4 h-4 -rotate-90" /></Button>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Thermometer className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-sm font-medium text-foreground">Temperature</p></div>
                <span className="text-sm font-mono font-bold text-foreground">{temperature.toFixed(1)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={e => setTemperature(+e.target.value)} className="w-full accent-foreground" />
              <div className="flex justify-between text-xs text-muted-foreground"><span>0 — Precise</span><span>0.7 — Balanced</span><span>1 — Creative</span></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-sm font-medium text-foreground">Required consensus</p></div>
                <span className="text-sm font-mono font-bold text-foreground">{Math.round(threshold * 100)}%</span>
              </div>
              <input type="range" min={0.5} max={1} step={0.05} value={threshold} onChange={e => setThreshold(+e.target.value)} className="w-full accent-foreground" />
              <div className="flex justify-between text-xs text-muted-foreground"><span>50% — Loose</span><span>70% — Standard</span><span>100% — Strict</span></div>
            </div>
            <div className={cn("rounded-xl border transition-all", wantToSave ? "border-foreground/30 bg-accent/30 p-4" : "border-border p-3.5")}>
              <div className="flex items-start gap-3">
                <button onClick={() => setWantToSave(!wantToSave)} className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all mt-0.5", wantToSave ? "bg-foreground border-foreground" : "border-muted-foreground hover:border-foreground")}>
                  {wantToSave && <Check className="w-2.5 h-2.5 text-background" />}
                </button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => setWantToSave(!wantToSave)} className="text-sm font-medium text-foreground text-left">Save as a workflow</button>
                  {wantToSave && <Input autoFocus className="mt-2 text-sm" placeholder="Name it…" value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveName.trim() && handleLaunch()} />}
                </div>
                <Save className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              </div>
            </div>
            <Button className="w-full" onClick={handleLaunch} disabled={saving || wSteps.length === 0 || (wantToSave && !saveName.trim())}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Launch inquiry →"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

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
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0", cfg.bg)}>
                <Icon className={cn("w-2.5 h-2.5", cfg.color)} />
              </div>
              <span className="text-xs font-semibold text-foreground">Round {iter.iteration} — {cfg.label}</span>
              {pct !== null && <Badge variant="outline" className="text-xs py-0 ml-auto">{pct}% consensus</Badge>}
            </div>
            {iter.responses.map((r, i) => (
              <div key={i} className={cn(
                "ml-6 mb-1.5 px-3 py-2 rounded-lg text-xs border",
                r.content.startsWith("[Error:") ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
              )}>
                <p className="font-medium text-foreground mb-1">{r.modelName}</p>
                <p className="text-muted-foreground leading-relaxed">{r.content.slice(0, 280)}{r.content.length > 280 ? "…" : ""}</p>
              </div>
            ))}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Iteration accordion ──────────────────────────────────────
function IterCard({ iter, idx }: { iter: LiveIteration; idx: number }) {
  const [open, setOpen] = useState(false);
  const cfg = PHASE_CFG[iter.phase] ?? PHASE_CFG.research;
  const Icon = cfg.icon;
  const pct = iter.consensus ? Math.round(iter.consensus * 100) : null;
  return (
    <div className="border border-border rounded-lg overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 30}ms` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left">
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
    } catch { toast({ title: "Could not copy to clipboard.", description: "Please try selecting and copying the text manually.", variant: "destructive" }); }
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
      <div className={cn(
        "border rounded-xl p-4",
        isQuick ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40"
                : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
            isQuick ? "bg-amber-100 dark:bg-amber-900/40" : "bg-green-100 dark:bg-green-900/40")}>
            {isQuick ? <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                     : <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{isQuick ? "Quick answer" : "Inquiry complete"}</p>
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

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-foreground/50" />
            <span className="text-sm font-semibold text-foreground">{isQuick ? "Answer" : "Consensus Answer"}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button data-testid="btn-copy-answer" onClick={copy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors">
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button data-testid="btn-download-answer" onClick={download}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors">
              <Download className="w-3.5 h-3.5" /> .md
            </button>
          </div>
        </div>
        <div className="p-5">
          {finalAnswer
            ? <div className="mercury-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(finalAnswer) }} />
            : <p className="text-sm text-muted-foreground italic">No answer generated.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Follow-up entry (answered inline) ───────────────────────

// ─── Debate block — self-contained child debate render ────────
// Fetches and streams a child debate session inline in the parent page.
function DebateBlock({ entry, idx }: { entry: DebateEntry; idx: number }) {
  const [liveIters, setLiveIters] = useState<LiveIteration[]>([]);
  const [currentPhase, setCurrentPhase] = useState("research");
  const [showLive, setShowLive] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const { data: child } = useQuery<Session>({
    queryKey: ["/api/sessions", entry.sessionId],
    refetchInterval: (q) => (q.state.data as Session | undefined)?.status === "running" ? 2000 : false,
  });
  const { data: childIters = [] } = useQuery<Iteration[]>({
    queryKey: ["/api/sessions", entry.sessionId, "iterations"],
    refetchInterval: () => child?.status === "running" ? 3000 : false,
  });

  useEffect(() => {
    const base = new URL("./ws", location.href);
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${base.href}?sessionId=${entry.sessionId}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === "iteration_start") setCurrentPhase(d.phase ?? "research");
        if (d.type === "iteration_complete") {
          setLiveIters(prev => {
            if (prev.find(i => i.iteration === d.iteration)) return prev;
            return [...prev, { iteration: d.iteration, phase: d.phase ?? "research", phaseLabel: d.phaseLabel ?? d.phase ?? "Research", responses: d.responses ?? [], summary: d.summary ?? "", consensus: d.consensus ?? 0 }];
          });
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", entry.sessionId] });
        }
        if (d.type === "completed") {
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", entry.sessionId] });
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", entry.sessionId, "iterations"] });
        }
        if (d.type === "error") toast({ title: "Debate failed.", description: d.message, variant: "destructive" });
      } catch {}
    };
    return () => ws.close();
  }, [entry.sessionId]);

  const isRunning   = !child || child.status === "running";
  const isCompleted = child?.status === "completed";
  const isError     = child?.status === "error";
  const progress    = child && child.totalIterations > 0
    ? Math.round((child.currentIteration / child.totalIterations) * 100) : 0;

  const allIters: LiveIteration[] = liveIters.length > 0
    ? liveIters
    : childIters.map(it => {
      let responses: LiveResponse[] = [];
      try { responses = JSON.parse(it.content) ?? []; } catch {}
      return { iteration: it.iterationNumber, phase: it.type, phaseLabel: it.type, responses, summary: it.summary ?? "", consensus: it.consensus ?? 0 };
    });

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Thread connector */}
      <div className="flex items-center gap-2 pl-1">
        <div className="w-px h-6 bg-border ml-3" />
        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Expert debate {idx + 1}</span>
        {entry.query !== "" && <span className="text-xs text-muted-foreground truncate max-w-[200px]">— {entry.query.slice(0, 60)}{entry.query.length > 60 ? "…" : ""}</span>}
      </div>

      {/* Running state */}
      {isRunning && child && (
        <div className="border border-border rounded-xl p-4 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Round {child.currentIteration} of {child.totalIterations}</p>
              <p className="text-xs text-muted-foreground capitalize">{currentPhase} phase</p>
            </div>
            <span className="text-2xl font-bold text-foreground tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <PhaseTimeline currentPhase={currentPhase} />
          <button onClick={() => setShowLive(!showLive)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 border-t border-border">
            {showLive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showLive ? "Hide" : "Show"} live progress
            {showLive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* Launching state (child session not yet fetched) */}
      {isRunning && !child && (
        <div className="border border-border rounded-xl p-4 flex items-center gap-3 bg-card">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">Starting expert debate…</p>
        </div>
      )}

      {/* Live panel */}
      {isRunning && child && showLive && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-semibold text-foreground">Live — Expert debate in progress</span>
            {liveIters.length > 0 && <Badge variant="outline" className="text-xs py-0 ml-auto">{liveIters.length} round{liveIters.length !== 1 ? "s" : ""}</Badge>}
          </div>
          {liveIters.length === 0 ? (
            <div className="px-4 py-5 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">Calling your expert team — first responses arriving shortly…</p>
              </div>
            </div>
          ) : (
            <div className="p-4"><LivePanel iters={liveIters} /></div>
          )}
        </div>
      )}

      {/* Completed: history + results */}
      {isCompleted && child && (
        <>
          {allIters.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Debate history</h3>
                <span className="text-xs text-muted-foreground">{allIters.length} rounds</span>
              </div>
              {allIters.map((it, i) => <IterCard key={it.iteration} iter={it} idx={i} />)}
            </div>
          )}
          <Results session={child} iterations={childIters} isQuick={false} />
        </>
      )}

      {/* Error */}
      {isError && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-foreground">Debate failed. Check your API key and try again.</p>
        </div>
      )}
    </div>
  );
}

function FollowUpEntryCard({ entry, idx, onLaunchDebate, onCustomSetup, isLast }: {
  entry: FollowUpEntry;
  idx: number;
  onLaunchDebate: (cfg: { selectedModels: string[]; iterations: number; temperature: number; consensusThreshold: number; workflowId?: string; queryOverride?: string }) => void;
  onCustomSetup: (query: string) => void;
  isLast: boolean;
}) {
  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Thread connector */}
      <div className="flex items-center gap-2 pl-1">
        <div className="w-px h-6 bg-border ml-3" />
        <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Follow-up {idx + 1}</span>
      </div>
      {/* Question */}
      <div className="bg-muted/40 border border-border rounded-lg px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">You asked</p>
        <p className="text-sm text-foreground">{entry.query}</p>
      </div>
      {/* Answer */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-foreground">Quick answer</span>
        </div>
        <div className="px-4 py-4">
          <div className="mercury-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.answer) }} />
        </div>
      </div>
      {/* Debate starter for this follow-up — always shown so user can escalate */}
      {isLast && (
        <DebateStarter
          query={entry.query}
          onLaunchDebate={cfg => onLaunchDebate({ ...cfg, queryOverride: entry.query })}
          onCustomSetup={() => onCustomSetup(entry.query)}
        />
      )}
    </div>
  );
}

// ─── Follow-up input bar ──────────────────────────────────────
function FollowUpBar({ onSubmit, isPending }: { onSubmit: (q: string) => void; isPending: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [value]);

  function submit() {
    if (!value.trim() || isPending) return;
    onSubmit(value.trim());
    setValue("");
    // Scroll to bottom after submit
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  return (
    <div>
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
          <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Ask a follow-up</span>
          <span className="text-xs text-muted-foreground ml-1">— answer appears below, in this thread.</span>
        </div>
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
          placeholder="Dig deeper, challenge the answer, or explore a related angle…"
          className="w-full border-0 outline-none resize-none text-sm leading-relaxed bg-transparent px-4 pt-3 pb-2 text-foreground placeholder:text-muted-foreground min-h-[64px]"
          rows={2}
          data-testid="input-session-followup"
        />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="hidden sm:inline text-xs text-muted-foreground">⌘+Enter to send</span>
          <span className="sm:hidden text-xs text-muted-foreground">Tap to send</span>
          <button
            onClick={submit}
            disabled={!value.trim() || isPending}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…</> : <>Inquire <ArrowUp className="w-3.5 h-3.5" /></>}
          </button>
        </div>
      </div>
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Main session page ────────────────────────────────────────
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [liveIters, setLiveIters] = useState<LiveIteration[]>([]);
  const [currentPhase, setCurrentPhase] = useState("research");
  const [showLive, setShowLive] = useState(true);
  // Debate starter / wizard state (shown after quick answer or follow-up)
  const [showWizard, setShowWizard] = useState(false);
  const [wizardQuery, setWizardQuery] = useState<string | null>(null); // null = original session query

  // Pending follow-up (being generated)
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null);

  // Inline rename
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renaming) renameRef.current?.focus(); }, [renaming]);

  const { data: session, isLoading } = useQuery<Session>({
    queryKey: ["/api/sessions", id],
    refetchInterval: q => (q.state.data as Session | undefined)?.status === "running" ? 2000 : false,
  });

  const { data: storedIters = [] } = useQuery<Iteration[]>({
    queryKey: ["/api/sessions", id, "iterations"],
    enabled: !!id,
    refetchInterval: () => session?.status === "running" ? 3000 : false,
  });

  // Launch a child debate session — parent never mutated, new block appends below
  const debateMutation = useMutation({
    mutationFn: async (cfg: { selectedModels: string[]; iterations: number; temperature: number; consensusThreshold: number; workflowId?: string; queryOverride?: string }) => {
      const { queryOverride, ...rest } = cfg;
      const res = await apiRequest("POST", `/api/sessions/${id}/debate`, {
        ...rest,
        ...(queryOverride ? { query: queryOverride } : {}),
      });
      return res.json() as Promise<{ sessionId: string; childSessionId: string }>;
    },
    onSuccess: () => {
      // Refresh parent so the new debates[] entry appears
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setShowWizard(false);
    },
    onError: () => toast({ title: "Could not launch the debate.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/sessions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sessions"] }); navigate("/chat"); },
  });

  const renameMutation = useMutation({
    mutationFn: (title: string) => apiRequest("PATCH", `/api/sessions/${id}/title`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setRenaming(false);
      toast({ title: "Inquiry renamed." });
    },
  });

  const pinMutation = useMutation({
    mutationFn: (pinned: boolean) => apiRequest("PATCH", `/api/sessions/${id}/pin`, { pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: (session as any)?.isPinned ? "Unpinned." : "Pinned to top of sidebar." });
    },
  });

  const followUpMutation = useMutation({
    mutationFn: (query: string) => apiRequest("POST", `/api/sessions/${id}/followup`, { query }),
    onMutate: (query) => { setPendingFollowUp(query); },
    onError: () => {
      setPendingFollowUp(null);
      toast({ title: "Could not get a follow-up answer.", variant: "destructive" });
    },
  });

  // WebSocket — also handles followup_complete events
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
              phaseLabel: d.phaseLabel ?? d.phase ?? "Research",
              responses: d.responses ?? [], summary: d.summary ?? "", consensus: d.consensus ?? 0,
            }];
          });
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
        }
        if (d.type === "completed" || d.type === "quick_complete") {
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id, "iterations"] });
        }
        if (d.type === "followup_complete") {
          setPendingFollowUp(null);
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
        }
        if (d.type === "debate_started") {
          // Parent has a new debates[] entry — refresh so DebateBlock appears
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
        }
        if (d.type === "followup_error") {
          setPendingFollowUp(null);
          toast({ title: "Follow-up failed.", description: d.message, variant: "destructive" });
        }
        if (d.type === "error") toast({ title: "Something went wrong during the inquiry.", description: d.message, variant: "destructive" });
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

  const isRunning   = session?.status === "running";
  const isCompleted = session?.status === "completed";
  const isError     = session?.status === "error";
  // hasQuickAnswer: a quick answer exists (always shown first)
  const hasQuickAnswer = !!session?.quickAnswer;
  // hasDebate: a full debate has run (iterations exist)
  const hasDebate = storedIters.length > 0;
  // isQuick (legacy compat): only a quick answer, no debate run yet
  const isQuick = hasQuickAnswer && !hasDebate;
  const isPinned = !!(session as any)?.isPinned;
  const progress = session && session.totalIterations > 0
    ? Math.round((session.currentIteration / session.totalIterations) * 100) : 0;

  // Parse follow-ups from session
  let followUps: FollowUpEntry[] = [];
  try { followUps = JSON.parse((session as any)?.followUps ?? "[]"); } catch {}
  let debates: DebateEntry[] = [];
  try { debates = JSON.parse((session as any)?.debates ?? "[]"); } catch {}

  if (isLoading) return (
    <Layout><div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></Layout>
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
      <div className="flex h-full overflow-hidden">
        {/* Main content */}
        <div className={cn("flex-1 h-full overflow-y-auto min-w-0 transition-all duration-300", showWizard && "hidden sm:block")}>
        <div className="max-w-2xl mx-auto px-4 py-6 pb-12 space-y-5">

          {/* ── Header ── */}
          <div className="flex items-start gap-3">
            <button data-testid="btn-back" onClick={() => navigate("/chat")}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0 mt-0.5">
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-0">
              {renaming ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={renameRef}
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && renameVal.trim()) renameMutation.mutate(renameVal.trim());
                      if (e.key === "Escape") setRenaming(false);
                    }}
                    className="flex-1 text-sm font-semibold bg-transparent border-b border-foreground outline-none text-foreground pb-0.5"
                  />
                  <button onClick={() => renameVal.trim() && renameMutation.mutate(renameVal.trim())}
                    className="p-1 text-green-600 hover:text-green-700 transition-colors">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setRenaming(false)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <h1 className="text-base font-semibold text-foreground leading-snug truncate">{session.title}</h1>
                  <button
                    onClick={() => { setRenameVal(session.title); setRenaming(true); }}
                    className="p-1 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium",
                  isRunning   ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                  isCompleted ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  isError     ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                  "bg-muted text-muted-foreground"
                )}>
                  {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                  {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                  {isError && <AlertTriangle className="w-3 h-3" />}
                  <span className="capitalize">{session.status}</span>
                </span>
                <span className="text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleString()}</span>
                {followUps.length > 0 && (
                  <span className="text-xs text-muted-foreground">{followUps.length} follow-up{followUps.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>

            {/* Pin button */}
            <button
              onClick={() => pinMutation.mutate(!isPinned)}
              className={cn(
                "p-1.5 rounded-lg transition-colors flex-shrink-0",
                isPinned
                  ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              title={isPinned ? "Unpin" : "Pin to sidebar"}
            >
              {isPinned ? <Pin className="w-4 h-4 fill-current" /> : <PinOff className="w-4 h-4" />}
            </button>

            {/* Delete button */}
            <button data-testid="btn-delete"
              onClick={() => confirm("Delete this inquiry?") && deleteMutation.mutate()}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0">
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
                  <p className="text-sm font-semibold text-foreground">Round {session.currentIteration} of {session.totalIterations}</p>
                  <p className="text-xs text-muted-foreground capitalize">{currentPhase} phase</p>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
              <PhaseTimeline currentPhase={currentPhase} />
              <button data-testid="btn-toggle-live" onClick={() => setShowLive(!showLive)}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 border-t border-border">
                {showLive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showLive ? "Hide" : "View"} live progress
                {showLive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          )}

          {/* Live panel */}
          {isRunning && showLive && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-semibold text-foreground">Live — Expert debate in progress</span>
                {liveIters.length > 0 && <Badge variant="outline" className="text-xs py-0 ml-auto">{liveIters.length} round{liveIters.length !== 1 ? "s" : ""} complete</Badge>}
              </div>
              {liveIters.length === 0 ? (
                <div className="px-4 py-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Inquiry launched.</p>
                      <p className="text-xs text-muted-foreground">Calling your expert team — first responses arriving shortly…</p>
                    </div>
                  </div>
                  <div className="ml-10 space-y-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/40 border border-border" style={{ opacity: 1 - i * 0.2 }}>
                        <div className="w-4 h-4 rounded-full skeleton flex-shrink-0" />
                        <div className="flex-1 h-2.5 skeleton rounded-full" style={{ width: `${75 - i * 12}%` }} />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground pt-1 pl-1">Phase 1 of 5 — Research</p>
                  </div>
                </div>
              ) : (
                <div className="p-4"><LivePanel iters={liveIters} /></div>
              )}
            </div>
          )}

          {isRunning && !showLive && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Expert panel is debating your inquiry…
            </div>
          )}

          {/* ─── COMPLETED STATE — chronological order ───
              1. Quick answer (always first if it exists)
              2. Debate starter (if no debate yet and no follow-ups)
              3. Debate history (collapsed rounds)
              4. Debate consensus answer
              5. Follow-ups (each with their own debate starter)
              6. Follow-up input
          ──────────────────────────────── */}

          {/* 1. Quick answer — shown for completed sessions (and while debate is running on top of it) */}
          {hasQuickAnswer && (isCompleted || isRunning) && (
            <div className="border border-border rounded-xl overflow-hidden animate-fade-in-up">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">Initial answer</span>
                {hasDebate && <span className="text-xs text-muted-foreground ml-1">— full expert debate below</span>}
              </div>
              <div className="px-4 py-4">
                <div className="mercury-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(session.quickAnswer ?? "") }} />
              </div>
            </div>
          )}

          {/* 2. Debate starter — only when no debates launched yet and no follow-ups */}
          {isCompleted && debates.length === 0 && followUps.length === 0 && !showWizard && !debateMutation.isPending && (
            <DebateStarter
              query={session.query}
              onLaunchDebate={cfg => debateMutation.mutate(cfg)}
              onCustomSetup={() => { setWizardQuery(null); setShowWizard(true); }}
            />
          )}

          {/* 3+4. Child debate blocks — each self-contained, append-only */}
          {debates.map((d, i) => (
            <DebateBlock key={d.sessionId} entry={d} idx={i} />
          ))}

          {/* Debate starter after last block — always available to run another debate */}
          {isCompleted && (debates.length > 0 || followUps.length > 0) && !showWizard && !debateMutation.isPending && (
            <DebateStarter
              query={session.query}
              onLaunchDebate={cfg => debateMutation.mutate(cfg)}
              onCustomSetup={() => { setWizardQuery(null); setShowWizard(true); }}
            />
          )}

          {/* Launching indicator */}
          {debateMutation.isPending && (
            <div className="border border-border rounded-xl p-4 flex items-center gap-3 animate-fade-in-up">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">Starting expert debate…</p>
            </div>
          )}

          {/* ── Follow-up thread ── */}
          {followUps.map((fu, i) => (
            <FollowUpEntryCard
              key={fu.createdAt}
              entry={fu}
              idx={i}
              isLast={i === followUps.length - 1 && !pendingFollowUp && isCompleted}
              onLaunchDebate={cfg => debateMutation.mutate(cfg)}
              onCustomSetup={q => { setWizardQuery(q); setShowWizard(true); }}
            />
          ))}

          {/* Pending follow-up (generating) */}
          {pendingFollowUp && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="flex items-center gap-2 pl-1">
                <div className="w-px h-6 bg-border ml-3" />
                <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Follow-up {followUps.length + 1}</span>
              </div>
              <div className="bg-muted/40 border border-border rounded-lg px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">You asked</p>
                <p className="text-sm text-foreground">{pendingFollowUp}</p>
              </div>
              <div className="border border-border rounded-xl p-4 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
                <p className="text-sm text-muted-foreground">Getting answer…</p>
              </div>
            </div>
          )}

          {/* Follow-up input — shown on completed sessions */}
          {isCompleted && !pendingFollowUp && (
            <FollowUpBar
              onSubmit={(q) => followUpMutation.mutate(q)}
              isPending={followUpMutation.isPending}
            />
          )}

          {/* Error */}
          {isError && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Inquiry failed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Check your API key in Settings and try again.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/chat")}>New inquiry</Button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
        </div>{/* end main content */}

        {/* Wizard panel — slides in from right */}
        <div className={cn(
          "flex-shrink-0 overflow-hidden transition-all duration-300 ease-out",
          showWizard ? "w-full sm:w-[480px]" : "w-0"
        )}>
          {showWizard && session && (
            <InquiryWizard
              query={wizardQuery ?? session.query}
              onClose={() => setShowWizard(false)}
              onLaunch={cfg => {
                setShowWizard(false);
                debateMutation.mutate(wizardQuery ? { ...cfg, queryOverride: wizardQuery } : cfg);
              }}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
