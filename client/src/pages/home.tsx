import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Mic, MicOff, Paperclip, X, Send, ChevronDown, ChevronUp, Sliders, Zap, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import ModelSelector from "@/components/ModelSelector";
import { cn } from "@/lib/utils";

interface ResearchForm {
  query: string;
  selectedModels: string[];
  iterations: number;
  files: File[];
}

export default function HomePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showModelPanel, setShowModelPanel] = useState(false);
  const [showIterOptions, setShowIterOptions] = useState(false);

  const [form, setForm] = useState<ResearchForm>({
    query: "",
    selectedModels: [],
    iterations: 15,
    files: [],
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/research", {
        query: form.query.trim(),
        selectedModels: form.selectedModels,
        iterations: form.iterations,
        title: form.query.slice(0, 60),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate(`/session/${data.sessionId}`);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        // Transcribe placeholder — in production this would call /api/transcribe
        toast({ title: "Recording saved", description: "Voice note attached. Add a text query above too." });
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
    } catch {
      toast({ title: "Mic unavailable", description: "Please allow microphone access.", variant: "destructive" });
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setForm((f) => ({ ...f, files: [...f.files, ...files].slice(0, 5) }));
  }

  function removeFile(index: number) {
    setForm((f) => ({ ...f, files: f.files.filter((_, i) => i !== index) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.query.trim()) {
      toast({ title: "Query required", description: "Enter your research query." });
      return;
    }
    if (form.selectedModels.length === 0) {
      toast({ title: "Select models", description: "Choose at least one model to debate your query." });
      return;
    }
    startMutation.mutate();
  }

  const canSubmit = form.query.trim().length > 0 && form.selectedModels.length > 0 && !startMutation.isPending;

  return (
    <Layout>
      <div className="h-full flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-mono text-primary mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Multi-Model Deep Research Engine
            </div>
            <h1 className="text-4xl font-display font-900 text-foreground tracking-tight mb-3">
              What do you want to
              <span className="mercury-glow-text"> research deeply?</span>
            </h1>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">
              Your query goes through multiple AI models that debate, challenge, and synthesize over 15+ iterations to deliver a consensus answer.
            </p>
          </div>

          {/* Main form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Query input */}
            <div className={cn(
              "relative rounded-xl border bg-card transition-all",
              form.query.length > 0 ? "border-primary/40 mercury-glow" : "border-border"
            )}>
              <textarea
                data-testid="input-query"
                value={form.query}
                onChange={(e) => setForm((f) => ({ ...f, query: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
                }}
                placeholder="e.g. What are the most promising approaches to solving AGI alignment? What are the strongest counterarguments? What would a 10-year roadmap look like?"
                className="w-full bg-transparent p-4 pr-14 text-base text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[120px] max-h-[300px]"
                style={{ height: "auto" }}
                rows={4}
              />

              {/* Attached files preview */}
              {form.files.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  {form.files.map((file, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary text-xs text-foreground border border-border">
                      <Paperclip className="w-3 h-3 text-muted-foreground" />
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {audioBlob && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary">
                    <Mic className="w-3 h-3" />
                    Voice note attached
                    <button type="button" onClick={() => setAudioBlob(null)} className="hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom toolbar */}
              <div className="flex items-center gap-1 px-3 pb-3 border-t border-border/40 pt-2">
                <input ref={fileRef} type="file" multiple accept="*/*" className="hidden" onChange={handleFileChange} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  data-testid="btn-attach"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  title="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  data-testid="btn-record"
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    recording
                      ? "text-red-400 bg-red-500/10 animate-pulse"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  title={recording ? "Stop recording" : "Record voice"}
                >
                  {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <div className="flex-1" />

                <div className="text-xs text-muted-foreground/50 hidden sm:block">
                  ⌘↵ to run
                </div>
              </div>
            </div>

            {/* Model selector panel */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setShowModelPanel(!showModelPanel)}
                data-testid="btn-toggle-models"
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/30 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-muted-foreground" />
                  <span>Models</span>
                  {form.selectedModels.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-xs font-semibold">
                      {form.selectedModels.length} selected
                    </span>
                  )}
                </div>
                {showModelPanel ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showModelPanel && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <div className="pt-3">
                    <ModelSelector
                      selected={form.selectedModels}
                      onChange={(models) => setForm((f) => ({ ...f, selectedModels: models }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Iterations control */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setShowIterOptions(!showIterOptions)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/30 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                  <span>Depth</span>
                  <span className="text-muted-foreground">{form.iterations} iterations</span>
                </div>
                {showIterOptions ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showIterOptions && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <div className="pt-4 space-y-3">
                    <input
                      type="range"
                      min="5"
                      max="25"
                      step="5"
                      value={form.iterations}
                      onChange={(e) => setForm((f) => ({ ...f, iterations: parseInt(e.target.value) }))}
                      className="w-full accent-primary"
                      data-testid="input-iterations"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>5 — Fast</span>
                      <span className="font-semibold text-foreground">{form.iterations} iterations</span>
                      <span>25 — Deep</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      More iterations = richer debate and higher confidence. 15 is the recommended sweet spot.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              data-testid="btn-submit"
              disabled={!canSubmit}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold transition-all",
                canSubmit
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 mercury-glow"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              {startMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Starting research...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Start Deep Research
                </>
              )}
            </button>

            {/* Hint */}
            {form.selectedModels.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-500/80 px-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Select models above to unlock research. Use a quick pack for fast setup.
              </div>
            )}
          </form>
        </div>
      </div>
    </Layout>
  );
}
