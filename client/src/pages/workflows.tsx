import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil, Star, StarOff, GripVertical, X, Search } from "lucide-react";
import type { Workflow } from "@shared/schema";

interface ParsedStep { modelId: string; label: string; systemPrompt: string; }
interface ModelOption { id: string; name: string; }

function parseSteps(raw: string): ParsedStep[] {
  try { return JSON.parse(raw) as ParsedStep[]; } catch { return []; }
}

// ─── Step builder ────────────────────────────────────────────
function StepBuilder({
  steps, onChange
}: {
  steps: ParsedStep[];
  onChange: (steps: ParsedStep[]) => void;
}) {
  const [q, setQ] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: models = [], isLoading } = useQuery<ModelOption[]>({
    queryKey: ["/api/models"],
    staleTime: 60_000,
  });

  const filtered = models
    .filter(m => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 10);

  function openDrop() {
    if (inputRef.current) setDropRect(inputRef.current.getBoundingClientRect());
    setDropOpen(true);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function addStep(m: ModelOption) {
    onChange([...steps, { modelId: m.id, label: m.name, systemPrompt: "" }]);
    setQ(""); setDropOpen(false);
  }
  function removeStep(i: number) { onChange(steps.filter((_, j) => j !== i)); }
  function updatePrompt(i: number, p: string) {
    onChange(steps.map((s, j) => j === i ? { ...s, systemPrompt: p } : s));
  }

  const dropdown = dropOpen ? createPortal(
    <div
      style={{
        position: "fixed",
        top: dropRect ? dropRect.bottom + 4 : 0,
        left: dropRect ? dropRect.left : 0,
        width: dropRect ? dropRect.width : "auto",
        zIndex: 9999,
      }}
      className="border border-border rounded-lg bg-background shadow-xl max-h-56 overflow-y-auto"
    >
      {isLoading && <div className="px-3 py-2 text-xs text-muted-foreground">Loading models…</div>}
      {!isLoading && filtered.length === 0 && q && (
        <div className="px-3 py-2 text-xs text-muted-foreground">No models found for "{q}"</div>
      )}
      {!isLoading && filtered.length === 0 && !q && (
        <div className="px-3 py-2 text-xs text-muted-foreground">Start typing to search models…</div>
      )}
      {filtered.map(m => (
        <button
          key={m.id}
          onPointerDown={e => { e.preventDefault(); e.stopPropagation(); addStep(m); }}
          className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
        >
          <p className="text-sm font-medium text-foreground">{m.name}</p>
          <p className="text-xs text-muted-foreground">{m.id}</p>
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground">No models yet. Search below to add your first expert.</p>
        </div>
      )}

      {steps.map((step, i) => (
        <div key={i} className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-5 h-5 rounded-full bg-foreground text-background text-xs flex items-center justify-center font-semibold flex-shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{step.label}</p>
              <p className="text-xs text-muted-foreground truncate">{step.modelId}</p>
            </div>
            <button onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-3 pb-2.5 pt-2 border-t border-border/50">
            <Textarea
              placeholder={`Custom role for ${step.label.split(" ")[0]}… e.g. "You are a devil's advocate. Challenge every assumption."`}
              value={step.systemPrompt}
              onChange={e => updatePrompt(i, e.target.value)}
              className="text-xs resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/60 min-h-[2rem]"
              rows={2}
            />
          </div>
        </div>
      ))}

      {/* Search to add */}
      <div ref={containerRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            className="pl-9 text-sm"
            placeholder="Search and add a model…"
            value={q}
            onChange={e => { setQ(e.target.value); openDrop(); }}
            onFocus={openDrop}
          />
        </div>
        {dropdown}
      </div>
    </div>
  );
}

// ─── Workflow form dialog ─────────────────────────────────────
function WorkflowFormDialog({
  open, onClose, existing
}: {
  open: boolean;
  onClose: () => void;
  existing?: Workflow;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(existing?.name ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [iters, setIters] = useState(existing?.iterations ?? 15);
  const [temp, setTemp] = useState(existing?.temperature ?? 0.7);
  const [threshold, setThreshold] = useState(existing?.consensusThreshold ?? 0.7);
  const [steps, setSteps] = useState<ParsedStep[]>(parseSteps(existing?.steps ?? "[]"));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { name, description: desc, steps, iterations: iters, temperature: temp, consensusThreshold: threshold, isDefault: false };
      if (existing) return apiRequest("PUT", `/api/workflows/${existing.id}`, payload);
      return apiRequest("POST", "/api/workflows", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: existing ? "Workflow updated successfully." : "Workflow created successfully.", description: existing ? "Your changes have been saved." : "It's ready to use in your next inquiry." });
      onClose();
    },
    onError: () => toast({ title: "Could not save the workflow.", description: "Please check your inputs and try again.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit workflow" : "New workflow"}</DialogTitle>
          <DialogDescription>Configure the model steps and debate settings.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Deep Research" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What is this workflow for?" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Rounds</label>
                <span className="text-xs font-mono text-foreground">{iters}</span>
              </div>
              <input type="range" min={5} max={30} value={iters} onChange={e => setIters(Number(e.target.value))}
                className="w-full accent-foreground" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5</span><span>15</span><span>30</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Temperature</label>
                <span className="text-xs font-mono text-foreground">{temp.toFixed(1)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.1} value={temp} onChange={e => setTemp(Number(e.target.value))}
                className="w-full accent-foreground" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0</span><span>0.7</span><span>1</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Consensus</label>
                <span className="text-xs font-mono text-foreground">{Math.round(threshold * 100)}%</span>
              </div>
              <input type="range" min={0.5} max={1} step={0.05} value={threshold} onChange={e => setThreshold(Number(e.target.value))}
                className="w-full accent-foreground" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>50%</span><span>70%</span><span>100%</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Model steps</label>
            <StepBuilder steps={steps} onChange={setSteps} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || steps.length === 0 || mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Workflows page ──────────────────────────────────────────
export default function WorkflowsPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Workflow | undefined>();

  const { data: workflows = [], isLoading } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/workflows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "Workflow deleted.", description: "It has been permanently removed." });
    },
  });

  const defaultMutation = useMutation({
    mutationFn: async ({ id, isDefault }: { id: string; isDefault: boolean }) =>
      apiRequest("PUT", `/api/workflows/${id}`, { isDefault }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workflows"] }),
  });

  return (
    <Layout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-foreground">Workflows</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Model sequences that research and debate your queries</p>
            </div>
            <Button
              data-testid="btn-new-workflow"
              size="sm"
              onClick={() => { setEditing(undefined); setShowForm(true); }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />New
            </Button>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-24 skeleton rounded-xl" />)}
            </div>
          ) : workflows.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">No workflows yet</p>
              <Button size="sm" onClick={() => { setEditing(undefined); setShowForm(true); }}>
                Create your first workflow
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map(wf => {
                const steps = parseSteps(wf.steps);
                return (
                  <div
                    key={wf.id}
                    data-testid={`workflow-card-${wf.id}`}
                    className="border border-border rounded-xl p-4 bg-card hover:border-foreground/20 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{wf.name}</p>
                          {wf.isDefault === 1 && (
                            <Badge variant="secondary" className="text-xs py-0">Default</Badge>
                          )}
                        </div>
                        {wf.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{wf.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {steps.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-xs py-0 font-normal">
                              {s.label || s.modelId.split("/").pop()}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {steps.length} model{steps.length !== 1 ? "s" : ""} · {wf.iterations} rounds
                        </p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          data-testid={`btn-default-${wf.id}`}
                          onClick={() => defaultMutation.mutate({ id: wf.id, isDefault: !wf.isDefault })}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title={wf.isDefault ? "Remove default" : "Set as default"}
                        >
                          {wf.isDefault ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                        </button>
                        <button
                          data-testid={`btn-edit-${wf.id}`}
                          onClick={() => { setEditing(wf); setShowForm(true); }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`btn-delete-${wf.id}`}
                          onClick={() => confirm("Delete this workflow?") && deleteMutation.mutate(wf.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <WorkflowFormDialog
          open={showForm}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          existing={editing}
        />
      )}
    </Layout>
  );
}
