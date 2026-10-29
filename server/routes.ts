import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { randomUUID, timingSafeEqual } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  runOrchestration, runQuickAnswer, answerQuick, detectQueryComplexity, fetchOpenRouterModels,
} from "./orchestrator";
import { QUICK_MODEL, LIMITS } from "@shared/defaults";

// ─── Deployment mode ─────────────────────────────────────────
// MERCURY_DEMO=1      public demo: every visitor only sees their own data, nothing is saved server-side
//                     except that visitor's sessions, and API keys are never stored.
// MERCURY_PASSWORD=…  optional HTTP Basic password for the whole app (self-hosted, single user).
const DEMO = process.env.MERCURY_DEMO === "1";
const PASSWORD = process.env.MERCURY_PASSWORD ?? "";

const DEMO_LIMITS = { maxModels: 5, maxRounds: 10, inquiriesPerHour: 20 };

// ─── WebSocket fan-out ───────────────────────────────────────
const sessionClients = new Map<string, Set<WebSocket>>();
function broadcast(sessionId: string, data: Record<string, unknown>) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const msg = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

// ─── Small helpers ───────────────────────────────────────────
const COOKIE = "mercury_owner";

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Anonymous visitor id, issued as a cookie. Only used to scope data in demo mode. */
function ownerOf(req: Request, res: Response): string {
  let id = parseCookies(req)[COOKIE];
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = randomUUID();
    res.cookie(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: req.secure || req.headers["x-forwarded-proto"] === "https", maxAge: 365 * 24 * 3600 * 1000 });
  }
  return id;
}

/** Owner filter: undefined (no filtering) outside demo mode. */
function scope(req: Request, res: Response): string | undefined {
  const id = ownerOf(req, res);
  return DEMO ? id : undefined;
}

function canAccess(owner: string | undefined, row: { owner?: string | null } | undefined): boolean {
  return !!row && (owner === undefined || row.owner === owner);
}

/** Resolve the OpenRouter key for a request: per-request header first, then (not in demo) the saved primary key. */
function resolveApiKey(req: Request): string | undefined {
  const header = req.headers["x-api-key"];
  if (header && typeof header === "string" && header.trim()) return header.trim();
  if (DEMO) return undefined;
  const primary = storage.getPrimaryApiKey();
  if (primary) return primary.value;
  return storage.getSetting("openrouter_api_key")?.value || undefined;
}

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

interface DebateConfig { models: string[]; roles: string[]; rounds: number; temperature: number; threshold: number }

/** Validates and clamps debate settings coming from the client. Returns an error message on failure. */
function parseDebateConfig(body: any): DebateConfig | string {
  const rawModels: unknown = body.selectedModels;
  if (!Array.isArray(rawModels) || rawModels.length === 0) return "At least one model must be selected.";
  const models = rawModels.filter((m): m is string => typeof m === "string" && /^[\w.\-]+\/[\w.:\-]+$/.test(m));
  if (models.length === 0) return "The selected models are not valid OpenRouter model IDs.";
  const maxModels = DEMO ? DEMO_LIMITS.maxModels : LIMITS.maxModels;
  if (models.length > maxModels) return `At most ${maxModels} models can be used in one debate.`;
  const roles = Array.isArray(body.roles) ? body.roles.map((r: unknown) => String(r ?? "").slice(0, 500)) : [];
  const maxRounds = DEMO ? DEMO_LIMITS.maxRounds : LIMITS.maxRounds;
  return {
    models, roles,
    rounds: Math.round(num(body.iterations, 8, 1, maxRounds)),
    temperature: num(body.temperature, 0.7, 0, 1.5),
    threshold: num(body.consensusThreshold, 0.7, 0.3, 1),
  };
}

const hits = new Map<string, number[]>();
/** Tiny in-memory rate limiter, used for debate/quick-answer creation in demo mode. */
function rateLimited(key: string): boolean {
  if (!DEMO) return false;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < 3600_000);
  if (recent.length >= DEMO_LIMITS.inquiriesPerHour) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

const pid = (req: Request) => String(req.params.id);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─── Routes ──────────────────────────────────────────────────
export function registerRoutes(httpServer: Server, app: Express) {
  // Optional password protection for self-hosted instances.
  if (PASSWORD) {
    const expected = Buffer.from(PASSWORD);
    const check = (header: string | undefined) => {
      if (!header?.startsWith("Basic ")) return false;
      const given = Buffer.from(Buffer.from(header.slice(6), "base64").toString().split(":").slice(1).join(":"));
      return given.length === expected.length && timingSafeEqual(given, expected);
    };
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path === "/healthz" || check(req.headers.authorization)) return next();
      res.set("WWW-Authenticate", 'Basic realm="Mercury"').status(401).send("Authentication required.");
    });
    httpServer.on("upgrade", (req, socket) => {
      if (!check(req.headers.authorization)) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); }
    });
  }

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws, req) => {
    const sessionId = new URL(req.url!, "http://localhost").searchParams.get("sessionId");
    if (!sessionId) return;
    if (!sessionClients.has(sessionId)) sessionClients.set(sessionId, new Set());
    sessionClients.get(sessionId)!.add(ws);
    ws.on("close", () => {
      const set = sessionClients.get(sessionId);
      set?.delete(ws);
      if (set && set.size === 0) sessionClients.delete(sessionId);
    });
  });

  // ─── Config & onboarding ───────────────────────────────────
  app.get("/api/config", (_req, res) => {
    res.json({
      demo: DEMO,
      limits: DEMO ? DEMO_LIMITS : { maxModels: LIMITS.maxModels, maxRounds: LIMITS.maxRounds },
      quickModel: QUICK_MODEL,
    });
  });

  app.get("/api/onboarding", (_req, res) => {
    if (DEMO) return res.json({ hasApiKey: false });
    const legacyKey = storage.getSetting("openrouter_api_key")?.value ?? "";
    res.json({ hasApiKey: storage.listApiKeys().length > 0 || !!legacyKey });
  });

  // ─── Settings ──────────────────────────────────────────────
  app.get("/api/settings", (_req, res) => {
    const hasKey = !DEMO && !!(storage.getPrimaryApiKey() || storage.getSetting("openrouter_api_key")?.value);
    res.json({ apiKey: hasKey ? "***configured***" : "", theme: storage.getSetting("theme")?.value ?? "light" });
  });

  const themeKey = (req: Request, res: Response) => DEMO ? `theme:${ownerOf(req, res)}` : "theme";
  app.get("/api/settings/theme", (req, res) => {
    res.json({ theme: storage.getSetting(themeKey(req, res))?.value ?? "light" });
  });
  app.post("/api/settings/theme", (req, res) => {
    const { theme } = req.body ?? {};
    if (theme !== "light" && theme !== "dark") return res.status(400).json({ error: "The theme must be light or dark." });
    storage.setSetting(themeKey(req, res), theme);
    res.json({ success: true, theme });
  });

  // ─── API key management (disabled in demo mode) ────────────
  const noKeysInDemo = (_req: Request, res: Response, next: NextFunction) => {
    if (DEMO) return res.status(403).json({ error: "The public demo never stores API keys on the server. Your key stays in this browser tab." });
    next();
  };

  app.get("/api/keys", (_req, res) => {
    if (DEMO) return res.json({ keys: [], hasLegacyKey: false });
    const keys = storage.listApiKeys().map(k => ({
      id: k.id, label: k.label, masked: maskKey(k.value), isPrimary: k.isPrimary, createdAt: k.createdAt,
    }));
    const legacy = storage.getSetting("openrouter_api_key")?.value;
    res.json({ keys, hasLegacyKey: !!legacy && keys.length === 0 });
  });

  app.post("/api/keys", noKeysInDemo, (req, res) => {
    const { label, value, isPrimary } = req.body ?? {};
    if (typeof value !== "string" || !value.trim()) return res.status(400).json({ error: "An API key value is required." });
    const k = storage.createApiKey({
      label: (typeof label === "string" && label.trim()) || autoLabel(value),
      value: value.trim(),
      isPrimary: isPrimary ? 1 : 0,
    });
    if (k.isPrimary) storage.setSetting("openrouter_api_key", k.value);
    res.json({ id: k.id, label: k.label, masked: maskKey(k.value), isPrimary: k.isPrimary, createdAt: k.createdAt });
  });

  app.post("/api/keys/:id/primary", noKeysInDemo, (req, res) => {
    if (!storage.getApiKey(pid(req))) return res.status(404).json({ error: "That key was not found." });
    storage.setPrimaryApiKey(pid(req));
    res.json({ success: true });
  });

  app.delete("/api/keys/:id", noKeysInDemo, (req, res) => {
    storage.deleteApiKey(pid(req));
    res.json({ success: true });
  });

  // Migrate the legacy single key (pre-3.5) into the keys table
  app.post("/api/keys/migrate-legacy", noKeysInDemo, (_req, res) => {
    const legacy = storage.getSetting("openrouter_api_key")?.value;
    if (!legacy) return res.status(400).json({ error: "There is no legacy key to migrate." });
    if (storage.listApiKeys().length > 0) return res.json({ skipped: true });
    const k = storage.createApiKey({ label: "Default", value: legacy, isPrimary: 1 });
    res.json({ id: k.id, label: k.label, masked: maskKey(k.value), isPrimary: k.isPrimary });
  });

  // ─── Models & complexity ───────────────────────────────────
  let modelCache: { at: number; key: string; data: unknown } | null = null;
  app.get("/api/models", async (req, res) => {
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "An OpenRouter API key is required." });
    try {
      if (!modelCache || modelCache.key !== apiKey || Date.now() - modelCache.at > 10 * 60_000) {
        modelCache = { at: Date.now(), key: apiKey, data: await fetchOpenRouterModels(apiKey) };
      }
      res.json(modelCache.data);
    } catch (e) { res.status(502).json({ error: errMsg(e) }); }
  });

  app.post("/api/detect-complexity", async (req, res) => {
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (!query) return res.status(400).json({ error: "A query is required." });
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "An OpenRouter API key is required." });
    res.json({ complexity: await detectQueryComplexity(query, apiKey) });
  });

  // ─── Workflows ─────────────────────────────────────────────
  app.get("/api/workflows", (req, res) => res.json(storage.listWorkflows(scope(req, res))));

  app.get("/api/workflows/:id", (req, res) => {
    const wf = storage.getWorkflow(pid(req));
    if (!canAccess(scope(req, res), wf)) return res.status(404).json({ error: "That workflow was not found." });
    res.json(wf);
  });

  app.post("/api/workflows", (req, res) => {
    const { name, description, steps, iterations: iters, temperature, consensusThreshold, isDefault } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "A workflow name is required." });
    const wf = storage.createWorkflow({
      name: name.trim().slice(0, 120),
      description: String(description ?? "").slice(0, 500),
      steps: typeof steps === "string" ? steps : JSON.stringify(steps ?? []),
      iterations: Math.round(num(iters, 8, 1, LIMITS.maxRounds)),
      temperature: num(temperature, 0.7, 0, 1.5),
      consensusThreshold: num(consensusThreshold, 0.7, 0.3, 1),
      isDefault: isDefault ? 1 : 0,
      owner: ownerOf(req, res),
    });
    res.json(wf);
  });

  app.put("/api/workflows/:id", (req, res) => {
    const existing = storage.getWorkflow(pid(req));
    if (!canAccess(scope(req, res), existing)) return res.status(404).json({ error: "That workflow was not found." });
    const { name, description, steps, iterations: iters, temperature, consensusThreshold, isDefault } = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = String(name).slice(0, 120);
    if (description !== undefined) patch.description = String(description).slice(0, 500);
    if (steps !== undefined) patch.steps = typeof steps === "string" ? steps : JSON.stringify(steps);
    if (iters !== undefined) patch.iterations = Math.round(num(iters, 8, 1, LIMITS.maxRounds));
    if (temperature !== undefined) patch.temperature = num(temperature, 0.7, 0, 1.5);
    if (consensusThreshold !== undefined) patch.consensusThreshold = num(consensusThreshold, 0.7, 0.3, 1);
    if (isDefault !== undefined) patch.isDefault = isDefault ? 1 : 0;
    res.json(storage.updateWorkflow(pid(req), patch as any));
  });

  app.delete("/api/workflows/:id", (req, res) => {
    if (canAccess(scope(req, res), storage.getWorkflow(pid(req)))) storage.deleteWorkflow(pid(req));
    res.json({ success: true });
  });

  // ─── Sessions ──────────────────────────────────────────────
  /** Loads a session the caller is allowed to see (children inherit their parent's owner). */
  const loadSession = (req: Request, res: Response) => {
    const s = storage.getSession(pid(req));
    return canAccess(scope(req, res), s) ? s : undefined;
  };

  app.get("/api/sessions", (req, res) => res.json(storage.listSessions(scope(req, res))));

  app.get("/api/sessions/:id", (req, res) => {
    const s = loadSession(req, res);
    if (!s) return res.status(404).json({ error: "That session was not found." });
    res.json(s);
  });

  app.delete("/api/sessions", (req, res) => { storage.deleteAllSessions(scope(req, res)); res.json({ success: true }); });
  app.delete("/api/sessions/:id", (req, res) => {
    if (loadSession(req, res)) storage.deleteSession(pid(req));
    res.json({ success: true });
  });

  app.get("/api/sessions/:id/iterations", (req, res) => {
    if (!loadSession(req, res)) return res.status(404).json({ error: "That session was not found." });
    res.json(storage.getIterationsBySession(pid(req)));
  });

  app.patch("/api/sessions/:id/title", (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) return res.status(400).json({ error: "A title is required." });
    if (!loadSession(req, res)) return res.status(404).json({ error: "That session was not found." });
    res.json(storage.updateSessionTitle(pid(req), title.slice(0, 200)));
  });

  app.patch("/api/sessions/:id/pin", (req, res) => {
    if (!loadSession(req, res)) return res.status(404).json({ error: "That session was not found." });
    res.json(storage.setPinned(pid(req), !!req.body?.pinned));
  });

  // Launch a debate as a CHILD session. The parent is never mutated; the debate appends below it.
  app.post("/api/sessions/:id/debate", (req, res) => {
    const parent = loadSession(req, res);
    if (!parent) return res.status(404).json({ error: "That session was not found." });
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "An OpenRouter API key is required." });
    const cfg = parseDebateConfig(req.body ?? {});
    if (typeof cfg === "string") return res.status(400).json({ error: cfg });
    if (rateLimited(ownerOf(req, res))) return res.status(429).json({ error: "The demo limit of 20 inquiries per hour was reached. Please try again later." });

    const queryOverride = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    const debateQuery = (queryOverride || parent.query).slice(0, LIMITS.maxQueryChars);

    // Only one debate at a time per thread
    let existing: Array<{ sessionId: string }> = [];
    try { existing = JSON.parse(parent.debates ?? "[]"); } catch { /* ignore */ }
    if (existing.some(d => storage.getSession(d.sessionId)?.status === "running")) {
      return res.status(409).json({ error: "A debate is already running. Please wait for it to finish before launching another." });
    }

    const child = storage.createSession({
      title: parent.title, query: debateQuery, files: "[]",
      selectedModels: JSON.stringify(cfg.models),
      status: "running", currentIteration: 0, totalIterations: cfg.rounds,
      finalAnswer: null, quickAnswer: null, workflowId: req.body?.workflowId ?? null,
      parentId: pid(req), owner: parent.owner ?? null,
    } as any);
    storage.appendDebate(pid(req), child.id, debateQuery);
    broadcast(pid(req), { type: "debate_started", childSessionId: child.id, query: debateQuery });
    res.json({ sessionId: pid(req), childSessionId: child.id });

    void runInBackground(child.id, () => runOrchestration(
      child.id, debateQuery, cfg.models, cfg.rounds, apiKey,
      update => broadcast(child.id, update), cfg.temperature, cfg.threshold, cfg.roles,
    ));
  });

  // Follow-up question: answered by the quick model with the thread as context.
  app.post("/api/sessions/:id/followup", (req, res) => {
    const parent = loadSession(req, res);
    if (!parent) return res.status(404).json({ error: "That session was not found." });
    const query = typeof req.body?.query === "string" ? req.body.query.trim().slice(0, LIMITS.maxQueryChars) : "";
    if (!query) return res.status(400).json({ error: "A query is required." });
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "An OpenRouter API key is required." });
    if (rateLimited(ownerOf(req, res))) return res.status(429).json({ error: "The demo limit of 20 inquiries per hour was reached. Please try again later." });

    res.json({ status: "pending" });

    let previous: Array<{ query: string; answer: string }> = [];
    try { previous = JSON.parse(parent.followUps ?? "[]"); } catch { /* ignore */ }
    const context = [
      `Original question: ${parent.query}`,
      `Answer: ${(parent.finalAnswer ?? parent.quickAnswer ?? "").slice(0, 4000)}`,
      ...previous.slice(-3).map(f => `Follow-up: ${f.query}\nAnswer: ${f.answer.slice(0, 1500)}`),
    ].join("\n\n");

    void (async () => {
      try {
        const { content } = await answerQuick(apiKey, query, context);
        storage.appendFollowUp(pid(req), query, content);
        broadcast(pid(req), { type: "followup_complete", query, answer: content });
      } catch (e) {
        broadcast(pid(req), { type: "followup_error", message: errMsg(e) });
      }
    })();
  });

  // ─── New inquiries ─────────────────────────────────────────
  app.post("/api/quick-answer", (req, res) => {
    const query = typeof req.body?.query === "string" ? req.body.query.trim().slice(0, LIMITS.maxQueryChars) : "";
    if (!query) return res.status(400).json({ error: "A query is required." });
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "An OpenRouter API key is required." });
    if (rateLimited(ownerOf(req, res))) return res.status(429).json({ error: "The demo limit of 20 inquiries per hour was reached. Please try again later." });

    const session = storage.createSession({
      title: String(req.body?.title || query).slice(0, 60), query, files: "[]",
      selectedModels: JSON.stringify([QUICK_MODEL]),
      status: "running", currentIteration: 0, totalIterations: 1,
      finalAnswer: null, quickAnswer: null, workflowId: null, owner: ownerOf(req, res),
    } as any);
    res.json({ sessionId: session.id });

    void runInBackground(session.id, () => runQuickAnswer(session.id, query, apiKey, u => broadcast(session.id, u)));
  });

  app.post("/api/inquire", (req, res) => {
    const query = typeof req.body?.query === "string" ? req.body.query.trim().slice(0, LIMITS.maxQueryChars) : "";
    if (!query) return res.status(400).json({ error: "A query is required." });
    const cfg = parseDebateConfig(req.body ?? {});
    if (typeof cfg === "string") return res.status(400).json({ error: cfg });
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "An OpenRouter API key is required." });
    if (rateLimited(ownerOf(req, res))) return res.status(429).json({ error: "The demo limit of 20 inquiries per hour was reached. Please try again later." });

    const session = storage.createSession({
      title: String(req.body?.title || query).slice(0, 60), query, files: "[]",
      selectedModels: JSON.stringify(cfg.models),
      status: "running", currentIteration: 0, totalIterations: cfg.rounds,
      finalAnswer: null, quickAnswer: null, workflowId: req.body?.workflowId ?? null,
      owner: ownerOf(req, res),
    } as any);
    res.json({ sessionId: session.id });

    void runInBackground(session.id, () => runOrchestration(
      session.id, query, cfg.models, cfg.rounds, apiKey,
      u => broadcast(session.id, u), cfg.temperature, cfg.threshold, cfg.roles,
    ));
  });

  // Sessions left "running" by a crash or restart can never finish; mark them as errored on boot.
  for (const s of storage.listSessions()) {
    for (const id of [s.id, ...safeDebateIds(s.debates)]) {
      const row = storage.getSession(id);
      if (row?.status === "running") storage.updateSession(id, { status: "error" });
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────
async function runInBackground(sessionId: string, job: () => Promise<unknown>) {
  try {
    await job();
  } catch (e) {
    storage.updateSession(sessionId, { status: "error" });
    broadcast(sessionId, { type: "error", message: errMsg(e) });
  }
}

function safeDebateIds(raw: string | null | undefined): string[] {
  try { return (JSON.parse(raw ?? "[]") as Array<{ sessionId: string }>).map(d => d.sessionId); } catch { return []; }
}

function maskKey(value: string): string {
  if (value.length <= 12) return "sk-or-v1-••••••••";
  return value.slice(0, 10) + "••••••••" + value.slice(-4);
}

function autoLabel(value: string): string {
  return "Key " + value.slice(-4).toUpperCase();
}
