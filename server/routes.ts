import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { runOrchestration, fetchOpenRouterModels } from "./orchestrator";
import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Active WebSocket connections per session
const sessionClients = new Map<string, Set<WebSocket>>();

function broadcast(sessionId: string, data: Record<string, unknown>) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function registerRoutes(httpServer: Server, app: Express) {
  // WebSocket setup
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url!, `http://localhost`);
    const sessionId = url.searchParams.get("sessionId");

    if (sessionId) {
      if (!sessionClients.has(sessionId)) sessionClients.set(sessionId, new Set());
      sessionClients.get(sessionId)!.add(ws);

      ws.on("close", () => {
        sessionClients.get(sessionId)?.delete(ws);
      });
    }
  });

  // ─── Settings ──────────────────────────────────────────────
  app.get("/api/settings", (req, res) => {
    const apiKey = storage.getSetting("openrouter_api_key")?.value ?? "";
    res.json({ apiKey: apiKey ? "***configured***" : "" });
  });

  app.post("/api/settings", (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: "apiKey required" });
    storage.setSetting("openrouter_api_key", apiKey);
    res.json({ success: true });
  });

  // ─── Models ────────────────────────────────────────────────
  app.get("/api/models", async (req, res) => {
    const apiKey = storage.getSetting("openrouter_api_key")?.value;
    if (!apiKey) return res.status(401).json({ error: "API key not configured" });

    try {
      const models = await fetchOpenRouterModels(apiKey);
      res.json(models);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Sessions ──────────────────────────────────────────────
  app.get("/api/sessions", (req, res) => {
    res.json(storage.listSessions());
  });

  app.get("/api/sessions/:id", (req, res) => {
    const session = storage.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Not found" });
    res.json(session);
  });

  app.delete("/api/sessions/:id", (req, res) => {
    storage.deleteSession(req.params.id);
    res.json({ success: true });
  });

  // ─── Iterations ───────────────────────────────────────────
  app.get("/api/sessions/:id/iterations", (req, res) => {
    const iters = storage.getIterationsBySession(req.params.id);
    res.json(iters);
  });

  // ─── File Upload ──────────────────────────────────────────
  app.post("/api/upload", upload.array("files", 5), (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const fileInfo = files.map((f) => ({
      name: f.originalname,
      size: f.size,
      path: f.path,
    }));
    res.json({ files: fileInfo });
  });

  // ─── Start Research Session ────────────────────────────────
  app.post("/api/research", async (req, res) => {
    const { query, selectedModels, iterations: iterCount = 15, title } = req.body;

    if (!query || !selectedModels || selectedModels.length === 0) {
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
    });

    res.json({ sessionId: session.id });

    // Run orchestration in background
    setImmediate(async () => {
      try {
        await runOrchestration(
          session.id,
          query,
          selectedModels,
          iterCount,
          apiKey,
          (update) => broadcast(session.id, update)
        );
      } catch (e) {
        storage.updateSession(session.id, { status: "error" });
        broadcast(session.id, { type: "error", message: String(e) });
      }
    });
  });
}
