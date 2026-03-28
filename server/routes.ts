import type { Express } from "express";
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
  app.get("/api/onboarding", (_req, res) => {
    const apiKey = storage.getSetting("openrouter_api_key")?.value ?? "";
    res.json({ hasApiKey: !!apiKey });
  });

  // ─── Settings ───────────────────────────────────────────
  app.get("/api/settings", (_req, res) => {
    const apiKey = storage.getSetting("openrouter_api_key")?.value ?? "";
    const theme = storage.getSetting("theme")?.value ?? "light";
    res.json({ apiKey: apiKey ? "***configured***" : "", theme });
  });

  app.post("/api/settings", (req, res) => {
    const { apiKey } = req.body;
    if (apiKey === undefined) return res.status(400).json({ error: "apiKey required" });
    // Allow empty string to clear/disconnect the key
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

  // ─── Models ─────────────────────────────────────────────
  app.get("/api/models", async (_req, res) => {
    const apiKey = storage.getSetting("openrouter_api_key")?.value;
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });
    try { res.json(await fetchOpenRouterModels(apiKey)); }
    catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ─── Complexity detection ────────────────────────────────
  app.post("/api/detect-complexity", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });
    const apiKey = storage.getSetting("openrouter_api_key")?.value;
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });
    try {
      const complexity = await detectQueryComplexity(query, apiKey);
      res.json({ complexity });
    } catch (e) {
      res.json({ complexity: "complex" }); // safe default
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

  app.post("/api/upload", upload.array("files", 5), (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    res.json({ files: files.map(f => ({ name: f.originalname, size: f.size })) });
  });

  // ─── Quick answer (simple queries) ──────────────────────
  app.post("/api/quick-answer", async (req, res) => {
    const { query, title } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });
    const apiKey = storage.getSetting("openrouter_api_key")?.value;
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });

    const session = storage.createSession({
      title: title || query.slice(0, 60),
      query,
      files: "[]",
      selectedModels: JSON.stringify(["openai/gpt-4o-mini"]),
      status: "running",
      currentIteration: 0,
      totalIterations: 1,
      finalAnswer: null,
      quickAnswer: null,
      workflowId: null,
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
    const apiKey = storage.getSetting("openrouter_api_key")?.value;
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });

    const session = storage.createSession({
      title: title || query.slice(0, 60),
      query,
      files: "[]",
      selectedModels: JSON.stringify(selectedModels),
      status: "running",
      currentIteration: 0,
      totalIterations: iterCount,
      finalAnswer: null,
      quickAnswer: null,
      workflowId: workflowId ?? null,
    });

    res.json({ sessionId: session.id });

    setImmediate(async () => {
      try {
        await runOrchestration(
          session.id, query, selectedModels, iterCount, apiKey,
          (update) => broadcast(session.id, update),
          temperature,
          consensusThreshold
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
