import { WebSocket } from "ws";
import { storage } from "./storage";
import { runOrchestration } from "./orchestrator";
import type { DebateConfig } from "./config";
import type { Session } from "@shared/schema";
import { LIMITS } from "@shared/defaults";

// ─── Live fan-out to WebSocket clients ───────────────────────
export const sessionClients = new Map<string, Set<WebSocket>>();
export function broadcast(sessionId: string, data: Record<string, unknown>) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const msg = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Runs a job and marks the session as errored (and tells listeners) if it throws. */
export async function runInBackground(sessionId: string, job: () => Promise<unknown>) {
  try {
    await job();
  } catch (e) {
    storage.updateSession(sessionId, { status: "error" });
    broadcast(sessionId, { type: "error", message: errMsg(e) });
  }
}

/**
 * Creates an inquiry (parent session) with one debate under it and starts running it.
 * Used by the HTTP API and the MCP server; the same thread shows up in the web UI of a self-hosted instance.
 */
export function startThreadedDebate(opts: {
  owner: string | null; query: string; cfg: DebateConfig; apiKey: string; title?: string; workflowId?: string | null;
}): { parent: Session; child: Session } {
  const query = opts.query.slice(0, LIMITS.maxQueryChars);
  const parent = storage.createSession({
    title: (opts.title || query).slice(0, 60), query, files: "[]",
    selectedModels: JSON.stringify(opts.cfg.models),
    status: "running", currentIteration: 0, totalIterations: opts.cfg.rounds,
    finalAnswer: null, quickAnswer: null, workflowId: opts.workflowId ?? null, owner: opts.owner,
  } as any);
  const child = storage.createSession({
    title: parent.title, query, files: "[]",
    selectedModels: JSON.stringify(opts.cfg.models),
    status: "running", currentIteration: 0, totalIterations: opts.cfg.rounds,
    finalAnswer: null, quickAnswer: null, workflowId: opts.workflowId ?? null,
    parentId: parent.id, owner: opts.owner,
  } as any);
  storage.appendDebate(parent.id, child.id, query);

  void runInBackground(child.id, async () => {
    try {
      const r = await runOrchestration(
        child.id, query, opts.cfg.models, opts.cfg.rounds, opts.apiKey,
        u => broadcast(child.id, u), opts.cfg.temperature, opts.cfg.threshold, opts.cfg.roles,
      );
      storage.updateSession(parent.id, { status: "completed", finalAnswer: r.finalAnswer, costUsd: r.costUsd });
    } catch (e) {
      storage.updateSession(parent.id, { status: "error" });
      throw e;
    }
  });
  return { parent, child };
}

// ─── Result view shared by REST and MCP ──────────────────────
export interface DebateView {
  id: string; session_id: string | null; status: string; query: string; models: string[];
  rounds_planned: number; rounds_completed: number; consensus: number | null;
  final_answer: string | null; cost_usd: number | null; created_at: number; error?: string;
  rounds?: Array<{ round: number; phase: string; consensus: number | null; responses?: Array<{ model: string; content: string; failed?: boolean }> }>;
}

export function debateView(child: Session, include: "none" | "rounds" | "responses" = "rounds"): DebateView {
  const its = storage.getIterationsBySession(child.id);
  const voted = [...its].reverse().find(i => typeof i.consensus === "number");
  const view: DebateView = {
    id: child.id, session_id: child.parentId ?? null, status: child.status, query: child.query,
    models: safeJson<string[]>(child.selectedModels, []),
    rounds_planned: child.totalIterations, rounds_completed: its.length,
    consensus: voted?.consensus ?? null,
    final_answer: child.finalAnswer ?? null, cost_usd: child.costUsd ?? null, created_at: child.createdAt,
  };
  if (child.status === "error") view.error = "The debate failed. Check that the OpenRouter key is valid and has credit, then try again.";
  if (include !== "none") {
    view.rounds = its.map(i => ({
      round: i.iterationNumber, phase: i.type, consensus: i.consensus ?? null,
      ...(include === "responses" ? {
        responses: safeJson<Array<{ modelId: string; content: string; failed?: boolean }>>(i.content, [])
          .map(r => ({ model: r.modelId, content: r.content, ...(r.failed ? { failed: true } : {}) })),
      } : {}),
    }));
  }
  return view;
}

export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

/** Polls the database until the debate leaves the running state or the time is up. */
export async function waitForDebate(id: string, seconds: number): Promise<Session | undefined> {
  const deadline = Date.now() + Math.max(0, seconds) * 1000;
  let s = storage.getSession(id);
  while (s && s.status === "running" && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000));
    s = storage.getSession(id);
  }
  return s;
}
