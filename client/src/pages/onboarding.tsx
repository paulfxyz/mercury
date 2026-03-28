import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Plus, Trash2, ChevronRight, ArrowRight, Check, Sparkles, GitBranch } from "lucide-react";
import type { Workflow } from "@shared/schema";

interface ModelOption { id: string; name: string; }
interface WorkflowStep { modelId: string; modelName: string; systemPrompt: string; }

// ─── Step 1: API Key ─────────────────────────────────────────
function StepApiKey({ onNext }: { onNext: () => void }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", { apiKey: key }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "API key saved" });
      onNext();
    },
    onError: () => toast({ title: "Failed to save key", variant: "destructive" }),
  });

  return (
    <div className="animate-fade-in-up max-w-md w-full">
      <div className="mb-8">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1.5">Connect OpenRouter</h2>
        <p className="text-sm text-muted-foreground">
          Mercury uses OpenRouter to access 100+ AI models. Your key is stored securely on your server — never sent anywhere else.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">OpenRouter API Key</label>
          <div className="relative">
            <Input
              data-testid="input-api-key"
              type={show ? "text" : "password"}
              placeholder="sk-or-v1-..."
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === "Enter" && key.trim() && saveMutation.mutate()}
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your free key at{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2 hover:opacity-70">
              openrouter.ai/keys
            </a>
          </p>
        </div>

        <Button
          data-testid="btn-save-api-key"
          onClick={() => saveMutation.mutate()}
          disabled={!key.trim() || saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending ? "Saving…" : "Continue"}
          {!saveMutation.isPending && <ArrowRight className="ml-2 w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: First Workflow ───────────────────────────────────
function StepWorkflow({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState("My First Workflow");
  const [description, setDescription] = useState("");
  const [iterations, setIterations] = useState(15);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [newStepModel, setNewStepModel] = useState<ModelOption | null>(null);
  const [newStepPrompt, setNewStepPrompt] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: models = [], isLoading: modelsLoading } = useQuery<ModelOption[]>({
    queryKey: ["/api/models"],
    staleTime: 60_000,
  });

  const filteredModels = models
    .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
    .slice(0, 8);

  function addStep() {
    if (!newStepModel) return;
    setSteps(prev => [...prev, { modelId: newStepModel.id, modelName: newStepModel.name, systemPrompt: newStepPrompt }]);
    setNewStepModel(null);
    setNewStepPrompt("");
    setModelSearch("");
    setAddingStep(false);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/workflows", {
        name,
        description,
        steps: steps.map(s => ({ modelId: s.modelId, label: s.modelName, systemPrompt: s.systemPrompt })),
        iterations,
        isDefault: true,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "Workflow created!" });
      onNext();
    },
    onError: () => toast({ title: "Failed to create workflow", variant: "destructive" }),
  });

  return (
    <div className="animate-fade-in-up max-w-lg w-full">
      <div className="mb-6">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
          <GitBranch className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1.5">Build your first workflow</h2>
        <p className="text-sm text-muted-foreground">
          A workflow is a sequence of AI models that will research and debate your query. Each step can have a custom system prompt.
        </p>
      </div>

      <div className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Workflow name</label>
          <Input
            data-testid="input-workflow-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Deep Research, Quick Check…"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this workflow for?"
          />
        </div>

        {/* Iterations */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Debate rounds</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={5} max={30} step={1}
              value={iterations}
              onChange={e => setIterations(Number(e.target.value))}
              className="flex-1 accent-foreground"
            />
            <span className="text-sm font-mono w-8 text-right text-foreground">{iterations}</span>
          </div>
          <p className="text-xs text-muted-foreground">More rounds = deeper consensus, longer wait</p>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Model steps</label>
            <span className="text-xs text-muted-foreground">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
          </div>

          {steps.length === 0 && !addingStep && (
            <div className="border border-dashed border-border rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground">No steps yet. Add at least one model.</p>
            </div>
          )}

          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 border border-border rounded-lg bg-card">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{step.modelName}</p>
                {step.systemPrompt && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{step.systemPrompt}</p>
                )}
              </div>
              <button
                onClick={() => setSteps(prev => prev.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Add step form */}
          {addingStep ? (
            <div className="border border-border rounded-lg p-3 space-y-3 bg-card">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Model</label>
                <Input
                  placeholder="Search models…"
                  value={modelSearch}
                  onChange={e => { setModelSearch(e.target.value); setNewStepModel(null); }}
                  className="text-sm"
                />
                {modelSearch && filteredModels.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border bg-background shadow-sm max-h-40 overflow-y-auto">
                    {filteredModels.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setNewStepModel(m); setModelSearch(m.name); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors"
                      >
                        <p className="font-medium text-foreground">{m.name}</p>
                        <p className="text-muted-foreground">{m.id}</p>
                      </button>
                    ))}
                  </div>
                )}
                {modelsLoading && <p className="text-xs text-muted-foreground">Loading models…</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Custom system prompt <span className="text-muted-foreground/70">(optional)</span></label>
                <Textarea
                  placeholder="e.g. You are a devil's advocate. Challenge assumptions rigorously."
                  value={newStepPrompt}
                  onChange={e => setNewStepPrompt(e.target.value)}
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addStep} disabled={!newStepModel} className="flex-1">
                  Add step
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setAddingStep(false); setNewStepModel(null); setModelSearch(""); setNewStepPrompt(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              data-testid="btn-add-step"
              onClick={() => setAddingStep(true)}
              className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add a model step
            </button>
          )}
        </div>

        <Button
          data-testid="btn-create-workflow"
          onClick={() => createMutation.mutate()}
          disabled={!name.trim() || steps.length === 0 || createMutation.isPending}
          className="w-full"
        >
          {createMutation.isPending ? "Creating…" : "Create workflow & start"}
          {!createMutation.isPending && <ArrowRight className="ml-2 w-4 h-4" />}
        </Button>

        <button
          onClick={() => { onNext(); }}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now — I'll set up a workflow later
        </button>
      </div>
    </div>
  );
}

// ─── Onboarding shell ────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border flex items-center px-6 justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground select-none">
          <span className="text-xl">☿</span> Mercury
        </span>
        <div className="flex items-center gap-2">
          {[1, 2].map(n => (
            <div key={n} className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              n <= step ? "text-foreground" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-xs border transition-colors",
                n < step ? "bg-primary border-primary text-primary-foreground" :
                n === step ? "border-foreground text-foreground" :
                "border-border text-muted-foreground"
              )}>
                {n < step ? <Check className="w-3 h-3" /> : n}
              </div>
              <span className="hidden sm:block">
                {n === 1 ? "API Key" : "Workflow"}
              </span>
              {n < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {step === 1 && <StepApiKey onNext={() => setStep(2)} />}
        {step === 2 && <StepWorkflow onNext={() => navigate("/chat")} />}
      </div>
    </div>
  );
}
