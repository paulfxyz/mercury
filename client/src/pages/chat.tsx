import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowUp, Zap, GitBranch, X,
  Plus, Trash2, Search, Thermometer, Check, Save, Star, Loader2,
  ChevronRight, Bolt, SlidersHorizontal, ThumbsUp, CornerDownRight,
} from "lucide-react";
import type { Workflow, Session } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

interface ModelOption { id: string; name: string; }
interface WizardStep { modelId: string; label: string; systemPrompt: string; }

function parseSteps(raw: string): WizardStep[] {
  try { return JSON.parse(raw); } catch { return []; }
}

// ─── Quick-debate defaults ─────────────────────────────────────
const QUICK_MODELS = [
  "openai/gpt-4o",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-2.0-flash-001",
];
const QUICK_ROUNDS = 3;
const QUICK_TEMP = 0.3;
const QUICK_THRESHOLD = 0.7;

// ─── Step dot ─────────────────────────────────────────────────
function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={cn(
      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all",
      done  ? "bg-foreground text-background" :
      active ? "border-2 border-foreground text-foreground" :
               "border border-border text-muted-foreground"
    )}>
      {done ? <Check className="w-3 h-3" /> : n}
    </div>
  );
}

// ─── Model search ──────────────────────────────────────────────
function ModelSearch({
  models, loading, onSelect, placeholder,
}: {
  models: ModelOption[];
  loading: boolean;
  onSelect: (m: ModelOption) => void;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = models
    .filter(m => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 12);

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 text-sm"
          placeholder={placeholder ?? t("search_models")}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-xl bg-background shadow-2xl z-50 max-h-64 overflow-y-auto">
          {loading && <div className="px-4 py-3 text-xs text-muted-foreground">{t("model_loading")}</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              {q ? `${t("model_no_results")} "${q}"` : t("model_start_typing")}
            </div>
          )}
          {filtered.map(m => (
            <button
              key={m.id}
              onMouseDown={e => { e.preventDefault(); onSelect(m); setQ(""); setOpen(false); }}
              className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/40 last:border-0"
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

// ─── Debate starter ────────────────────────────────────────────
function DebateStarter({
  workflows, workflowsLoading,
  onQuickLaunch, onWorkflowLaunch, onCustomSetup, launching,
}: {
  workflows: Workflow[];
  workflowsLoading: boolean;
  onQuickLaunch: () => void;
  onWorkflowLaunch: (wf: Workflow) => void;
  onCustomSetup: () => void;
  launching: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-2.5 animate-fade-in-up">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-0.5">
        {t("debate_how")}
      </p>

      <button
        onClick={onQuickLaunch}
        disabled={launching}
        className={cn(
          "w-full text-left p-4 rounded-xl border border-border",
          "hover:border-foreground/30 hover:bg-accent/20 transition-all group",
          "flex items-start gap-3.5",
          launching && "opacity-50 cursor-not-allowed"
        )}
        data-testid="btn-quick-debate"
      >
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bolt className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{t("quick_debate_title")}</p>
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium">{t("quick_debate_badge")}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("quick_debate_desc_tmpl").replace("{rounds}", String(QUICK_ROUNDS)).replace("{temp}", String(QUICK_TEMP))}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {["GPT-4o", "Claude 3.5", "Gemini 2.0"].map(l => (
              <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">{l}</span>
            ))}
          </div>
        </div>
        {launching
          ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0 mt-1" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 mt-1 transition-colors" />
        }
      </button>

      {!workflowsLoading && workflows.length > 0 && (
        <div className="space-y-1.5">
          {workflows.map(wf => {
            const steps = parseSteps(wf.steps);
            return (
              <button
                key={wf.id}
                onClick={() => onWorkflowLaunch(wf)}
                disabled={launching}
                className={cn(
                  "w-full text-left p-3.5 rounded-xl border border-border",
                  "hover:border-foreground/30 hover:bg-accent/20 transition-all group",
                  "flex items-center gap-3",
                  launching && "opacity-50 cursor-not-allowed"
                )}
                data-testid={`btn-workflow-${wf.id}`}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {wf.isDefault === 1
                    ? <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                    : <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{wf.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {steps.length} model{steps.length !== 1 ? "s" : ""} · {wf.iterations} rounds · temp {wf.temperature?.toFixed(1)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={onCustomSetup}
        disabled={launching}
        className={cn(
          "w-full text-left p-3.5 rounded-xl border border-dashed border-border",
          "hover:border-foreground/30 hover:bg-accent/10 transition-all group",
          "flex items-center gap-3",
          launching && "opacity-50 cursor-not-allowed"
        )}
        data-testid="btn-custom-setup"
      >
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{t("custom_setup_title")}</p>
          <p className="text-xs text-muted-foreground">{t("custom_setup_desc")}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors" />
      </button>
    </div>
  );
}

// ─── Inquiry Wizard ────────────────────────────────────────────
function InquiryWizard({
  query, onClose, onLaunch,
}: {
  query: string;
  onClose: () => void;
  onLaunch: (cfg: { selectedModels: string[]; iterations: number; temperature: number; consensusThreshold: number; workflowId?: string }) => void;
}) {
  const { t } = useI18n();
  const { data: workflows = [] } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });
  const { data: models = [], isLoading: modelsLoading } = useQuery<ModelOption[]>({ queryKey: ["/api/models"], staleTime: 60_000 });
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [teamSize, setTeamSize] = useState(3);
  const [steps, setSteps] = useState<WizardStep[]>([]);
  const [rounds, setRounds] = useState(15);
  const [temperature, setTemperature] = useState(0.7);
  const [threshold, setThreshold] = useState(0.7);
  const [wantToSave, setWantToSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo(0, 0); }, [step]);

  function addModel(m: ModelOption) {
    if (steps.length >= teamSize) return;
    setSteps(prev => [...prev, { modelId: m.id, label: m.name, systemPrompt: "" }]);
  }
  function removeModel(i: number) { setSteps(prev => prev.filter((_, j) => j !== i)); }
  function updatePrompt(i: number, v: string) {
    setSteps(prev => prev.map((s, j) => j === i ? { ...s, systemPrompt: v } : s));
  }

  async function handleLaunch() {
    if (!steps.length) {
      toast({ title: t("toast_no_model"), variant: "destructive" });
      return;
    }
    let workflowId: string | undefined;
    if (wantToSave && saveName.trim()) {
      setSaving(true);
      try {
        const res = await apiRequest("POST", "/api/workflows", {
          name: saveName.trim(), steps, iterations: rounds,
          temperature, consensusThreshold: threshold,
          isDefault: workflows.length === 0,
        });
        const wf = await res.json();
        workflowId = wf.id;
        await queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
        toast({ title: t("toast_workflow_saved_title"), description: t("toast_workflow_saved_desc") });
      } catch {
        toast({ title: t("toast_workflow_error"), description: t("toast_workflow_error_desc"), variant: "destructive" });
      }
      setSaving(false);
    }
    onLaunch({ selectedModels: steps.map(s => s.modelId), iterations: rounds, temperature, consensusThreshold: threshold, workflowId });
  }

  const STEPS = [
    { n: 1, label: t("wizard_step_size") }, { n: 2, label: t("wizard_step_models") },
    { n: 3, label: t("wizard_step_rounds") }, { n: 4, label: t("wizard_step_config") },
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-xl border-l border-border bg-background">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t("wizard_title")}</p>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{query.slice(0, 60)}{query.length > 60 ? "…" : ""}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-5 py-3 border-b border-border flex-shrink-0">
        {STEPS.map((s, i) => {
          const isActive = s.n === step;
          const isDone = s.n < step;
          return (
            <div key={s.n} className="flex items-center flex-1">
              <button onClick={() => isDone && setStep(s.n)} className={cn("flex flex-col items-center gap-1 flex-1", isDone && "cursor-pointer")}>
                <StepDot n={i + 1} active={isActive} done={isDone} />
                <span className={cn("text-[10px]", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px flex-1 mb-4 mx-0.5", isDone ? "bg-foreground/30" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">{t("wizard_how_many")}</p>
              <p className="text-xs text-muted-foreground">{t("wizard_how_many_sub")}</p>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
              {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                <button key={n} onClick={() => setTeamSize(n)} className={cn(
                  "py-3 rounded-xl border text-sm font-semibold transition-all",
                  teamSize === n ? "bg-foreground text-background border-foreground" : "border-border text-foreground hover:border-foreground/40"
                )}>{n}</button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>{t("btn_choose_models")} <ChevronRight className="ml-1 w-4 h-4" /></Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Select {teamSize} model{teamSize !== 1 ? "s" : ""}</p>
              <span className="text-xs text-muted-foreground tabular-nums">{steps.length} / {teamSize}</span>
            </div>
            <ModelSearch models={models} loading={modelsLoading} onSelect={addModel}
              placeholder={steps.length < teamSize
                ? t("model_placeholder_add").replace("{n}", String(steps.length + 1)).replace("{total}", String(teamSize))
                : t("wizard_team_complete")} />
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="w-5 h-5 rounded-full bg-foreground text-background text-[11px] flex items-center justify-center font-bold flex-shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.modelId}</p>
                    </div>
                    <button onClick={() => removeModel(i)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="px-3.5 pb-3 pt-2 border-t border-border/40">
                    <Textarea placeholder={t("wizard_role_placeholder_tmpl").replace("{name}", s.label.split(" ")[0])}
                      value={s.systemPrompt} onChange={e => updatePrompt(i, e.target.value)}
                      className="text-xs resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50 min-h-[2rem]" rows={2} />
                  </div>
                </div>
              ))}
            </div>
            {steps.length < teamSize && (
              <p className="text-xs text-muted-foreground text-center">{teamSize - steps.length} more model{teamSize - steps.length !== 1 ? "s" : ""} needed</p>
            )}
            <Button className="w-full" disabled={steps.length === 0} onClick={() => setStep(3)}>{t("btn_set_rounds")} <ChevronRight className="ml-1 w-4 h-4" /></Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{t("wizard_rounds_label")}</p>
                <span className="text-sm font-mono font-bold text-foreground">{rounds}</span>
              </div>
              <input type="range" min={5} max={30} value={rounds} onChange={e => setRounds(+e.target.value)} className="w-full accent-foreground" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("rounds_quick")}</span><span>{t("rounds_balanced")}</span><span>{t("rounds_deep")}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("wizard_api_calls_tmpl")
                .replace("{rounds}", String(rounds))
                .replace("{models}", String(steps.length || "?"))
                .replace("{total}", String(rounds * (steps.length || 3)))}
            </p>
            <Button className="w-full" onClick={() => setStep(4)}>{t("btn_temp_consensus")} <ChevronRight className="ml-1 w-4 h-4" /></Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">{t("wizard_temp_label")}</p>
                </div>
                <span className="text-sm font-mono font-bold text-foreground">{temperature.toFixed(1)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={e => setTemperature(+e.target.value)} className="w-full accent-foreground" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("temp_precise")}</span><span>{t("temp_balanced")}</span><span>{t("temp_creative")}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">{t("wizard_consensus_label")}</p>
                </div>
                <span className="text-sm font-mono font-bold text-foreground">{Math.round(threshold * 100)}%</span>
              </div>
              <input type="range" min={0.5} max={1} step={0.05} value={threshold} onChange={e => setThreshold(+e.target.value)} className="w-full accent-foreground" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("consensus_loose")}</span><span>{t("consensus_standard")}</span><span>{t("consensus_strict")}</span>
              </div>
            </div>

            <div className="bg-muted/40 rounded-xl p-3.5 text-xs space-y-2">
              <p className="font-semibold text-foreground">{t("wizard_summary_title")}</p>
              <p className="text-muted-foreground">
                {steps.length} model{steps.length !== 1 ? "s" : ""} · {rounds} rounds · temp {temperature.toFixed(1)} · {Math.round(threshold * 100)}% consensus
              </p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {steps.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs py-0">{s.label.split(" ").slice(-2).join(" ")}</Badge>
                ))}
              </div>
            </div>

            <div className={cn("rounded-xl border transition-all", wantToSave ? "border-foreground/30 bg-accent/30 p-4" : "border-border p-3.5")}>
              <div className="flex items-start gap-3">
                <button onClick={() => setWantToSave(!wantToSave)}
                  className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all mt-0.5",
                    wantToSave ? "bg-foreground border-foreground" : "border-muted-foreground hover:border-foreground")}>
                  {wantToSave && <Check className="w-2.5 h-2.5 text-background" />}
                </button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => setWantToSave(!wantToSave)} className="text-sm font-medium text-foreground text-left">{t("save_workflow_title")}</button>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("save_workflow_desc")}</p>
                  {wantToSave && (
                    <Input autoFocus className="mt-2.5 text-sm" placeholder={t("save_workflow_placeholder")}
                      value={saveName} onChange={e => setSaveName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveName.trim() && handleLaunch()} />
                  )}
                </div>
                <Save className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              </div>
            </div>

            <Button className="w-full" onClick={handleLaunch} disabled={saving || steps.length === 0 || (wantToSave && !saveName.trim())}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("btn_saving")}</> : t("btn_launch")}
            </Button>
            {wantToSave && !saveName.trim() && (
              <p className="text-xs text-muted-foreground text-center -mt-2">{t("enter_name")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick answer banner ───────────────────────────────────────
function QuickAnswerBanner({
  answer, onAccept, loading,
}: {
  answer: string;
  onAccept: () => void;
  loading: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card animate-fade-in-up">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-foreground">{t("initial_answer_title")}</span>
        <span className="text-xs text-muted-foreground ml-1">{t("initial_answer_sub")}</span>
      </div>
      {loading ? (
        <div className="px-4 py-6 flex items-center justify-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t("getting_answer")}</span>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{answer}</p>
          <button onClick={onAccept} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ThumbsUp className="w-3.5 h-3.5" />
            {t("accept_answer")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Accepted context + follow-up input ───────────────────────
function FollowUpBar({
  prevQuery, prevAnswer, onSubmit, isProcessing,
}: {
  prevQuery: string;
  prevAnswer: string;
  onSubmit: (q: string) => void;
  isProcessing: boolean;
}) {
  const { t } = useI18n();
  const [followUp, setFollowUp] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [followUp]);

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Collapsed previous answer */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <ThumbsUp className="w-3 h-3" /> {t("followup_accepted")}
        </p>
        <p className="text-xs text-muted-foreground italic truncate">{prevQuery}</p>
        <p className="text-xs text-foreground/70 line-clamp-2 leading-relaxed">{prevAnswer}</p>
      </div>

      {/* Follow-up input */}
      <div className={cn(
        "border border-border rounded-xl shadow-sm bg-card overflow-hidden",
        "focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-foreground/20"
      )}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-medium text-muted-foreground">{t("ask_followup")}</span>
        </div>
        <Textarea
          ref={ref}
          value={followUp}
          onChange={e => setFollowUp(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (followUp.trim()) onSubmit(followUp.trim()); }
          }}
          placeholder={t("followup_placeholder")}
          className="border-0 shadow-none resize-none focus-visible:ring-0 min-h-[64px] text-sm leading-relaxed bg-transparent px-4 pt-1 pb-2"
          rows={2}
          data-testid="input-followup"
        />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="hidden sm:inline text-xs text-muted-foreground">{t("chat_hint_desktop")}</span>
          <span className="sm:hidden text-xs text-muted-foreground">{t("chat_hint_mobile")}</span>
          <Button
            size="sm"
            onClick={() => { if (followUp.trim()) onSubmit(followUp.trim()); }}
            disabled={!followUp.trim() || isProcessing}
            className="rounded-lg h-8 px-3 gap-1.5"
          >
            {isProcessing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("btn_thinking")}</>
              : <>{t("btn_inquire")} <ArrowUp className="w-3.5 h-3.5" /></>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main chat page ────────────────────────────────────────────
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
