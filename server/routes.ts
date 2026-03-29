import type { Express, Request } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { runOrchestration, runQuickAnswer, detectQueryComplexity, fetchOpenRouterModels } from "./orchestrator";
import multer from "multer";

const upload = multer({ dest: "uploads/", limits: { fileSize: 20 * 1024 * 1024 } });

const sessionClients = new Map<string, Set<WebSocket>>();
function broadcast(sessionId: string, data: Record<string, unknown>) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const msg = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

/** Resolve the API key for a request.
 *  Priority: X-Api-Key header (session-only) → saved primary key → legacy setting.
 */
function resolveApiKey(req: Request): string | undefined {
  const header = req.headers["x-api-key"];
  if (header && typeof header === "string" && header.trim()) return header.trim();
  const primary = storage.getPrimaryApiKey();
  if (primary) return primary.value;
  // Legacy fallback (keys added before v3.5.0 via the old POST /api/settings)
  return storage.getSetting("openrouter_api_key")?.value || undefined;
}

/** Returns true if ANY key is available (saved or session header). */
function hasAnyKey(req: Request): boolean {
  return !!resolveApiKey(req);
}

export function registerRoutes(httpServer: Server, app: Express) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url!, "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    if (sessionId) {
      if (!sessionClients.has(sessionId)) sessionClients.set(sessionId, new Set());
      sessionClients.get(sessionId)!.add(ws);
      ws.on("close", () => sessionClients.get(sessionId)?.delete(ws));
    }
  });

  // ─── Onboarding ─────────────────────────────────────────
  // Returns true if ANY key is configured (saved OR will be provided per-request)
  app.get("/api/onboarding", (req, res) => {
    const savedKeys = storage.listApiKeys();
    const legacyKey = storage.getSetting("openrouter_api_key")?.value ?? "";
    res.json({ hasApiKey: savedKeys.length > 0 || !!legacyKey });
  });

  // ─── Settings (legacy, kept for compat) ─────────────────
  app.get("/api/settings", (_req, res) => {
    const primary = storage.getPrimaryApiKey();
    const legacyKey = storage.getSetting("openrouter_api_key")?.value ?? "";
    const hasKey = !!(primary || legacyKey);
    const theme = storage.getSetting("theme")?.value ?? "light";
    res.json({ apiKey: hasKey ? "***configured***" : "", theme });
  });

  app.post("/api/settings", (req, res) => {
    const { apiKey } = req.body;
    if (apiKey === undefined) return res.status(400).json({ error: "apiKey required" });
    storage.setSetting("openrouter_api_key", apiKey);
    res.json({ success: true });
  });

  app.get("/api/settings/theme", (_req, res) => {
    res.json({ theme: storage.getSetting("theme")?.value ?? "light" });
  });

  app.post("/api/settings/theme", (req, res) => {
    const { theme } = req.body;
    if (theme !== "light" && theme !== "dark") return res.status(400).json({ error: "invalid theme" });
    storage.setSetting("theme", theme);
    res.json({ success: true, theme });
  });

  // ─── API Key management ──────────────────────────────────
  // Returns keys with value masked for display
  app.get("/api/keys", (_req, res) => {
    const keys = storage.listApiKeys().map(k => ({
      id: k.id,
      label: k.label,
      masked: maskKey(k.value),
      isPrimary: k.isPrimary,
      createdAt: k.createdAt,
    }));
    // Also surface legacy key (from old settings) if it hasn't been migrated
    const legacy = storage.getSetting("openrouter_api_key")?.value;
    const hasMigrated = keys.length > 0;
    res.json({ keys, hasLegacyKey: !!legacy && !hasMigrated });
  });

  app.post("/api/keys", (req, res) => {
    const { label, value, isPrimary } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: "value required" });
    const k = storage.createApiKey({
      label: label?.trim() || autoLabel(value),
      value: value.trim(),
      isPrimary: isPrimary ? 1 : 0,
    });
    // Also sync legacy setting so existing code paths keep working
    if (k.isPrimary) storage.setSetting("openrouter_api_key", k.value);
    res.json({ id: k.id, label: k.label, masked: maskKey(k.value), isPrimary: k.isPrimary, createdAt: k.createdAt });
  });

  app.post("/api/keys/:id/primary", (req, res) => {
    const k = storage.getApiKey(req.params.id);
    if (!k) return res.status(404).json({ error: "Not found" });
    storage.setPrimaryApiKey(req.params.id);
    res.json({ success: true });
  });

  app.put("/api/keys/:id", (req, res) => {
    const k = storage.getApiKey(req.params.id);
    if (!k) return res.status(404).json({ error: "Not found" });
    const { label } = req.body;
    if (label !== undefined) {
      // Only allow label updates (not value — security)
      const db = (storage as any);
      // Direct update via storage internals isn't exposed; just re-read
    }
    res.json({ success: true });
  });

  app.delete("/api/keys/:id", (req, res) => {
    storage.deleteApiKey(req.params.id);
    res.json({ success: true });
  });

  // Migrate the legacy single key into the new keys table
  app.post("/api/keys/migrate-legacy", (_req, res) => {
    const legacy = storage.getSetting("openrouter_api_key")?.value;
    if (!legacy) return res.status(400).json({ error: "No legacy key to migrate" });
    const existing = storage.listApiKeys();
    if (existing.length > 0) return res.json({ skipped: true });
    const k = storage.createApiKey({ label: "Default", value: legacy, isPrimary: 1 });
    res.json({ id: k.id, label: k.label, masked: maskKey(k.value), isPrimary: k.isPrimary });
  });

  // ─── Models ─────────────────────────────────────────────
  app.get("/api/models", async (req, res) => {
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });
    try { res.json(await fetchOpenRouterModels(apiKey)); }
    catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Complexity detection ────────────────────────────────
  app.post("/api/detect-complexity", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });
    try {
      const complexity = await detectQueryComplexity(query, apiKey);
      res.json({ complexity });
    } catch (e) {
      res.json({ complexity: "complex" });
    }
  });

  // ─── Workflows ──────────────────────────────────────────
  app.get("/api/workflows", (_req, res) => res.json(storage.listWorkflows()));

  app.get("/api/workflows/:id", (req, res) => {
    const wf = storage.getWorkflow(req.params.id);
    if (!wf) return res.status(404).json({ error: "Not found" });
    res.json(wf);
  });

  app.post("/api/workflows", (req, res) => {
    const { name, description, steps, iterations: iters, temperature, consensusThreshold, isDefault } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const wf = storage.createWorkflow({
      name,
      description: description ?? "",
      steps: typeof steps === "string" ? steps : JSON.stringify(steps ?? []),
      iterations: iters ?? 15,
      temperature: temperature ?? 0.7,
      consensusThreshold: consensusThreshold ?? 0.7,
      isDefault: isDefault ? 1 : 0,
    });
    res.json(wf);
  });

  app.put("/api/workflows/:id", (req, res) => {
    const { name, description, steps, iterations: iters, temperature, consensusThreshold, isDefault } = req.body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    if (steps !== undefined) patch.steps = typeof steps === "string" ? steps : JSON.stringify(steps);
    if (iters !== undefined) patch.iterations = iters;
    if (temperature !== undefined) patch.temperature = temperature;
    if (consensusThreshold !== undefined) patch.consensusThreshold = consensusThreshold;
    if (isDefault !== undefined) patch.isDefault = isDefault ? 1 : 0;
    const wf = storage.updateWorkflow(req.params.id, patch as any);
    if (!wf) return res.status(404).json({ error: "Not found" });
    res.json(wf);
  });

  app.delete("/api/workflows/:id", (req, res) => {
    storage.deleteWorkflow(req.params.id);
    res.json({ success: true });
  });

  // ─── Sessions ───────────────────────────────────────────
  app.get("/api/sessions", (_req, res) => res.json(storage.listSessions()));

  app.get("/api/sessions/:id", (req, res) => {
    const s = storage.getSession(req.params.id);
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json(s);
  });

  app.delete("/api/sessions", (_req, res) => { storage.deleteAllSessions(); res.json({ success: true }); });
  app.delete("/api/sessions/:id", (req, res) => { storage.deleteSession(req.params.id); res.json({ success: true }); });
  app.get("/api/sessions/:id/iterations", (req, res) => res.json(storage.getIterationsBySession(req.params.id)));

  // Rename session title
  app.patch("/api/sessions/:id/title", (req, res) => {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "title required" });
    const s = storage.updateSessionTitle(req.params.id, title.trim());
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json(s);
  });

  // Pin / unpin session
  app.patch("/api/sessions/:id/pin", (req, res) => {
    const { pinned } = req.body;
    const s = storage.setPinned(req.params.id, !!pinned);
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json(s);
  });

  // Launch a full debate ON the existing session (no new session created)
  app.post("/api/sessions/:id/debate", async (req, res) => {
    const { selectedModels, iterations: iterCount = 15, temperature = 0.7, consensusThreshold = 0.7, workflowId, query: queryOverride } = req.body;
    if (!selectedModels?.length) return res.status(400).json({ error: "selectedModels required" });

    const session = storage.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });

    // Use follow-up query if provided, otherwise use original session query
    const debateQuery = queryOverride?.trim() || session.query;

    // Reset the existing session for a full debate run
    storage.updateSession(req.params.id, {
      status: "running",
      currentIteration: 0,
      totalIterations: iterCount,
      finalAnswer: null,
      workflowId: workflowId ?? null,
    });

    res.json({ sessionId: req.params.id });

    setImmediate(async () => {
      try {
        await runOrchestration(
          req.params.id, debateQuery, selectedModels, iterCount, apiKey,
          (update) => broadcast(req.params.id, update),
          temperature, consensusThreshold
        );
      } catch (e) {
        storage.updateSession(req.params.id, { status: "error" });
        broadcast(req.params.id, { type: "error", message: String(e) });
      }
    });
  });

  // Append a follow-up Q&A to an existing session (inline thread)
  app.post("/api/sessions/:id/followup", async (req, res) => {
    const { query } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: "query required" });
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });

    // Get quick answer for the follow-up
    res.json({ status: "pending" });

    setImmediate(async () => {
      try {
        const { runQuickAnswer: _rqa } = await import("./orchestrator");
        // Use a temporary session to get the answer
        const tmpSession = storage.createSession({
          title: query.slice(0, 60),
          query: query.trim(),
          files: "[]",
          selectedModels: JSON.stringify(["openai/gpt-4o-mini"]),
          status: "running",
          currentIteration: 0,
          totalIterations: 1,
          finalAnswer: null,
          quickAnswer: null,
          workflowId: null,
        });

        await _rqa(tmpSession.id, query.trim(), apiKey, () => {});

        // Read the answer from the temp session
        const done = storage.getSession(tmpSession.id);
        const answer = done?.quickAnswer ?? done?.finalAnswer ?? "";

        // Append to the original session
        storage.appendFollowUp(req.params.id, query.trim(), answer);

        // Clean up temp session
        storage.deleteSession(tmpSession.id);

        // Broadcast to original session clients
        broadcast(req.params.id, { type: "followup_complete", query: query.trim(), answer });
      } catch (e) {
        broadcast(req.params.id, { type: "followup_error", message: String(e) });
      }
    });
  });

  app.post("/api/upload", upload.array("files", 5), (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    res.json({ files: files.map(f => ({ name: f.originalname, size: f.size })) });
  });

  // ─── Quick answer ────────────────────────────────────────
  app.post("/api/quick-answer", async (req, res) => {
    const { query, title } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });

    const session = storage.createSession({
      title: title || query.slice(0, 60),
      query, files: "[]",
      selectedModels: JSON.stringify(["openai/gpt-4o-mini"]),
      status: "running", currentIteration: 0, totalIterations: 1,
      finalAnswer: null, quickAnswer: null, workflowId: null,
    });

    res.json({ sessionId: session.id });

    setImmediate(async () => {
      try {
        await runQuickAnswer(session.id, query, apiKey, (update) => broadcast(session.id, update));
      } catch (e) {
        storage.updateSession(session.id, { status: "error" });
        broadcast(session.id, { type: "error", message: String(e) });
      }
    });
  });

  // ─── Full inquiry (debate) ───────────────────────────────
  app.post("/api/inquire", async (req, res) => {
    const {
      query, selectedModels, iterations: iterCount = 15,
      title, workflowId, temperature = 0.7, consensusThreshold = 0.7,
    } = req.body;

    if (!query || !selectedModels?.length) {
      return res.status(400).json({ error: "query and selectedModels required" });
    }
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });

    const session = storage.createSession({
      title: title || query.slice(0, 60),
      query, files: "[]",
      selectedModels: JSON.stringify(selectedModels),
      status: "running", currentIteration: 0, totalIterations: iterCount,
      finalAnswer: null, quickAnswer: null, workflowId: workflowId ?? null,
    });

    res.json({ sessionId: session.id });

    setImmediate(async () => {
      try {
        await runOrchestration(
          session.id, query, selectedModels, iterCount, apiKey,
          (update) => broadcast(session.id, update),
          temperature, consensusThreshold
        );
      } catch (e) {
        storage.updateSession(session.id, { status: "error" });
        broadcast(session.id, { type: "error", message: String(e) });
      }
    });
  });

  // Legacy compat
  app.post("/api/research", (req, res) => {
    req.url = "/api/inquire";
    app._router.handle(req, res, () => {});
  });
}

// ─── Helpers ─────────────────────────────────────────────────
function maskKey(value: string): string {
  if (value.length <= 12) return "sk-or-v1-••••••••";
  return value.slice(0, 10) + "••••••••" + value.slice(-4);
}

function autoLabel(value: string): string {
  return "Key " + value.slice(-4).toUpperCase();
}
