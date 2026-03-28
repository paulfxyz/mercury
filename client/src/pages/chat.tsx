import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowUp, Paperclip, GitBranch, Plus, Check, ChevronDown, Clock, Sparkles } from "lucide-react";
import type { Workflow, Session } from "@shared/schema";

interface ParsedStep { modelId: string; label: string; systemPrompt: string; }

function parseSteps(raw: string): ParsedStep[] {
  try { return JSON.parse(raw); } catch { return []; }
}

// ─── Workflow picker modal ───────────────────────────────────
function WorkflowModal({
  open, onClose, onSelect, onCreate
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (wf: Workflow) => void;
  onCreate: () => void;
}) {
  const { data: workflows = [] } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select a workflow</DialogTitle>
          <DialogDescription>Choose how your query will be researched.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {workflows.map(wf => {
            const steps = parseSteps(wf.steps);
            return (
              <button
                key={wf.id}
                data-testid={`workflow-option-${wf.id}`}
                onClick={() => onSelect(wf)}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-accent/50 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{wf.name}</p>
                    {wf.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{wf.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {steps.slice(0, 4).map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs py-0">{s.label || s.modelId.split("/").pop()}</Badge>
                      ))}
                      {steps.length > 4 && <Badge variant="secondary" className="text-xs py-0">+{steps.length - 4}</Badge>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">{wf.iterations}r</div>
                </div>
              </button>
            );
          })}

          <button
            data-testid="btn-create-new-workflow"
            onClick={onCreate}
            className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create a new workflow
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Chat page ───────────────────────────────────────────────
export default function ChatPage() {
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: workflows = [] } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });
  const { data: sessions = [] } = useQuery<Session[]>({ queryKey: ["/api/sessions"], staleTime: 5_000 });

  // Auto-select default (or first) workflow
  useEffect(() => {
    if (!selectedWorkflow && workflows.length > 0) {
      const def = workflows.find(w => w.isDefault) ?? workflows[0];
      setSelectedWorkflow(def);
    }
  }, [workflows]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [query]);

  const researchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkflow) throw new Error("No workflow selected");
      const steps = parseSteps(selectedWorkflow.steps);
      const models = steps.map(s => s.modelId);
      const res = await apiRequest("POST", "/api/research", {
        query: query.trim(),
        selectedModels: models,
        iterations: selectedWorkflow.iterations,
        title: query.trim().slice(0, 60),
        workflowId: selectedWorkflow.id,
      });
      return res.json();
    },
    onSuccess: (data: { sessionId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate(`/session/${data.sessionId}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function submit() {
    if (!query.trim()) return;
    if (!selectedWorkflow) { setShowModal(true); return; }
    researchMutation.mutate();
  }

  const steps = selectedWorkflow ? parseSteps(selectedWorkflow.steps) : [];
  const recentSessions = sessions.slice(0, 5);

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Main area */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          {/* Hero */}
          <div className="w-full max-w-2xl space-y-6 animate-fade-in-up">
            <div className="text-center space-y-2">
              <div className="text-4xl select-none">☿</div>
              <h1 className="text-xl font-semibold text-foreground">What do you want to research?</h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Multiple AI models will debate your query over {selectedWorkflow?.iterations ?? 15} rounds and reach a consensus answer.
              </p>
            </div>

            {/* Input box */}
            <div className="border border-border rounded-xl shadow-sm bg-card overflow-hidden focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-foreground/20 transition-all">
              <Textarea
                ref={textareaRef}
                data-testid="input-query"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
                }}
                placeholder="Ask anything… e.g. What are the strongest arguments for and against AGI safety regulation?"
                className="border-0 shadow-none resize-none focus-visible:ring-0 min-h-[80px] text-sm leading-relaxed bg-transparent px-4 pt-4"
                rows={3}
              />

              {/* Bottom bar */}
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                {/* Workflow selector */}
                <button
                  data-testid="btn-select-workflow"
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-accent"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="font-medium">{selectedWorkflow?.name ?? "Select workflow"}</span>
                  {selectedWorkflow && (
                    <span className="text-muted-foreground/60">· {steps.length} model{steps.length !== 1 ? "s" : ""} · {selectedWorkflow.iterations}r</span>
                  )}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>

                {/* Send */}
                <Button
                  data-testid="btn-submit-query"
                  size="sm"
                  onClick={submit}
                  disabled={!query.trim() || researchMutation.isPending}
                  className="rounded-lg h-8 px-3 gap-1.5"
                >
                  {researchMutation.isPending ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Sending
                    </span>
                  ) : (
                    <>Research <ArrowUp className="w-3.5 h-3.5" /></>
                  )}
                </Button>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">⌘+Enter to send</p>

            {/* Recent sessions */}
            {recentSessions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">Recent research</p>
                <div className="grid gap-2">
                  {recentSessions.map(s => (
                    <button
                      key={s.id}
                      data-testid={`recent-session-${s.id}`}
                      onClick={() => navigate(`/session/${s.id}`)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 text-left transition-colors group"
                    >
                      <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground flex-1 truncate">{s.title}</span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        s.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        s.status === "running" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        s.status === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
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

      <WorkflowModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSelect={wf => { setSelectedWorkflow(wf); setShowModal(false); }}
        onCreate={() => { setShowModal(false); navigate("/workflows"); }}
      />
    </Layout>
  );
}
