import type { Express, Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { answerQuick, fetchOpenRouterModels } from "./orchestrator";
import { DEMO, API_TOKEN, DEMO_LIMITS, limits, rateLimited, parseDebateConfig, num, type DebateConfig } from "./config";
import { startThreadedDebate, debateView, waitForDebate, safeJson, type DebateView } from "./debates";
import { PANELS, SEED_WORKFLOWS, QUICK_MODEL, VERSION, LIMITS } from "@shared/defaults";
import { SEED_TEXT } from "./seedText";

// ─── Authentication ──────────────────────────────────────────
// Self-hosted: the caller proves access with MERCURY_API_TOKEN (Authorization: Bearer ...).
// Public demo: no Mercury token; the caller must bring an OpenRouter key (X-OpenRouter-Key), which
// is only used for that request. Debates are stored under a hash of the key, so only the same key can read them.

export interface ApiContext { owner: string | null; apiKey: string }

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Resolves the caller. Returns an error object (status + message) instead of throwing. */
export function authenticate(req: Request): ApiContext | { status: number; error: string } {
  const header = (name: string) => {
    const v = req.headers[name];
    return typeof v === "string" ? v.trim() : "";
  };
  const orKey = header("x-openrouter-key") || header("x-api-key");
  if (DEMO) {
    if (!orKey) return { status: 401, error: "Send your OpenRouter key in the X-OpenRouter-Key header. The demo never stores it." };
    return { owner: "api:" + createHash("sha256").update(orKey).digest("hex").slice(0, 32), apiKey: orKey };
  }
  if (!API_TOKEN) return { status: 503, error: "The API is disabled. Set MERCURY_API_TOKEN on the server to enable it." };
  const auth = header("authorization");
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token || !safeEqual(token, API_TOKEN)) return { status: 401, error: "Missing or invalid bearer token." };
  const apiKey = orKey || storage.getPrimaryApiKey()?.value || storage.getSetting("openrouter_api_key")?.value || "";
  return { owner: null, apiKey };
}

export function apiAuth(req: Request, res: Response, next: NextFunction) {
  const ctx = authenticate(req);
  if ("error" in ctx) return void res.status(ctx.status).json({ error: ctx.error });
  (req as any).api = ctx;
  next();
}

export function cors(req: Request, res: Response, next: NextFunction) {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-OpenRouter-Key, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  });
  if (req.method === "OPTIONS") return void res.sendStatus(204);
  next();
}

// ─── Shared operations (used by REST and MCP) ────────────────
export interface WorkflowInfo { id: string; name: string; description: string; models: string[]; rounds: number; temperature: number; consensus_threshold: number; builtin?: boolean }

/** Workflows visible to the caller: their own (self-hosted) plus the two built-in ones. */
export function listWorkflowInfos(ctx: ApiContext): WorkflowInfo[] {
  const own = DEMO ? [] : storage.listWorkflows().map(w => ({
    id: w.id, name: w.name, description: w.description,
    models: safeJson<Array<{ modelId: string }>>(w.steps, []).map(s => s.modelId),
    rounds: w.iterations, temperature: w.temperature, consensus_threshold: w.consensusThreshold,
  }));
  const builtin = SEED_WORKFLOWS.map(w => ({
    id: w.slug, name: SEED_TEXT.en[w.slug].name, description: SEED_TEXT.en[w.slug].desc,
    models: w.models.map(m => m.id), rounds: w.rounds, temperature: w.temperature, consensus_threshold: w.threshold, builtin: true,
  }));
  return [...own, ...builtin];
}

export interface DebateInput {
  query?: unknown; workflow?: unknown; models?: unknown; roles?: unknown; rounds?: unknown;
  temperature?: unknown; consensus_threshold?: unknown; title?: unknown;
}

/** Resolves workflow/panel/models into a validated DebateConfig. */
export function resolveDebateConfig(ctx: ApiContext, input: DebateInput): { cfg: DebateConfig; workflowId: string | null } | string {
  let body: any = { ...input };
  let workflowId: string | null = null;
  if (typeof input.workflow === "string" && input.workflow.trim()) {
    const key = input.workflow.trim().toLowerCase();
    const wf = listWorkflowInfos(ctx).find(w => w.id.toLowerCase() === key || w.name.toLowerCase() === key);
    if (!wf) return `Unknown workflow "${input.workflow}". List them with GET /api/v1/workflows.`;
    const seed = SEED_WORKFLOWS.find(s => s.slug === wf.id);
    const stored = wf.builtin ? undefined : storage.getWorkflow(wf.id);
    const roles = seed ? seed.models.map(m => m.role) : safeJson<Array<{ systemPrompt?: string }>>(stored?.steps, []).map(s => s.systemPrompt ?? "");
    body = { models: wf.models, roles, rounds: wf.rounds, temperature: wf.temperature, consensus_threshold: wf.consensus_threshold, ...definedOnly({
      models: input.models, roles: input.roles, rounds: input.rounds, temperature: input.temperature, consensus_threshold: input.consensus_threshold }) };
    workflowId = wf.builtin ? null : wf.id;
  } else if (typeof input.workflow === "undefined" && !input.models) {
    body.models = PANELS[0].models;       // default: the quick, low-cost panel
    body.rounds = body.rounds ?? 4;
    body.temperature = body.temperature ?? 0.3;
  }
  const cfg = parseDebateConfig(body);
  return typeof cfg === "string" ? cfg : { cfg, workflowId };
}

function definedOnly(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
}

export type StartResult = { ok: true; view: DebateView } | { ok: false; status: number; error: string };

const NO_KEY = "No OpenRouter key available. Send the X-OpenRouter-Key header or save a key in Mercury.";

export async function startDebateFromInput(ctx: ApiContext, input: DebateInput, waitSeconds: number): Promise<StartResult> {
  if (!ctx.apiKey) return { ok: false, status: 400, error: NO_KEY };
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return { ok: false, status: 400, error: "A query is required." };
  const resolved = resolveDebateConfig(ctx, input);
  if (typeof resolved === "string") return { ok: false, status: 400, error: resolved };
  if (ctx.owner && rateLimited(ctx.owner)) return { ok: false, status: 429, error: `The demo limit of ${DEMO_LIMITS.inquiriesPerHour} inquiries per hour was reached. Please try again later.` };
  const { child } = startThreadedDebate({
    owner: ctx.owner, query, cfg: resolved.cfg, apiKey: ctx.apiKey,
    title: typeof input.title === "string" ? input.title : undefined, workflowId: resolved.workflowId,
  });
  const done = waitSeconds > 0 ? await waitForDebate(child.id, waitSeconds) : child;
  return { ok: true, view: debateView(done ?? child, "rounds") };
}

export function findDebate(ctx: ApiContext, id: string) {
  const s = storage.getSession(id);
  if (!s || !s.parentId) return undefined;          // only debates (child sessions) are addressable
  if (ctx.owner && s.owner !== ctx.owner) return undefined;
  return s;
}

export function listDebates(ctx: ApiContext, limit = 20) {
  const roots = storage.listSessions(ctx.owner ?? undefined).slice(0, 100);
  const out: Array<ReturnType<typeof debateView>> = [];
  for (const r of roots) {
    for (const d of safeJson<Array<{ sessionId: string }>>(r.debates, [])) {
      const c = storage.getSession(d.sessionId);
      if (c) out.push(debateView(c, "none"));
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

export async function quickAnswerForApi(ctx: ApiContext, query: string) {
  if (!ctx.apiKey) throw new Error(NO_KEY);
  if (ctx.owner && rateLimited(ctx.owner)) throw new Error(`The demo limit of ${DEMO_LIMITS.inquiriesPerHour} inquiries per hour was reached.`);
  const r = await answerQuick(ctx.apiKey, query.slice(0, LIMITS.maxQueryChars));
  return { answer: r.content, model: QUICK_MODEL, cost_usd: r.costUsd };
}

// ─── REST routes ─────────────────────────────────────────────
export function registerApiRoutes(app: Express) {
  app.use(["/api/v1", "/mcp"], cors);

  app.get("/api/v1", (_req, res) => {
    res.json({
      name: "Mercury", version: VERSION, mode: DEMO ? "demo" : "self-hosted",
      docs: "https://github.com/paulfxyz/mercury/blob/master/docs/API.md",
      openapi: "/api/v1/openapi.json", mcp: "/mcp",
      auth: DEMO ? "Send your OpenRouter key in X-OpenRouter-Key." : "Authorization: Bearer <MERCURY_API_TOKEN>; optional X-OpenRouter-Key.",
      limits: limits(),
    });
  });
  app.get("/api/v1/openapi.json", (_req, res) => res.json(openapiDocument()));

  app.use("/api/v1", apiAuth);
  const ctxOf = (req: Request) => (req as any).api as ApiContext;

  app.post("/api/v1/debates", async (req, res) => {
    const wait = Math.round(num(req.body?.wait ?? req.query.wait, 0, 0, 110));
    const r = await startDebateFromInput(ctxOf(req), req.body ?? {}, wait);
    if (!r.ok) return void res.status(r.status).json({ error: r.error });
    res.status(r.view.status === "running" ? 202 : 200).json(r.view);
  });

  app.get("/api/v1/debates", (req, res) => {
    res.json({ debates: listDebates(ctxOf(req), Math.round(num(req.query.limit, 20, 1, 100))) });
  });

  app.get("/api/v1/debates/:id", async (req, res) => {
    const s = findDebate(ctxOf(req), String(req.params.id));
    if (!s) return void res.status(404).json({ error: "That debate was not found." });
    const wait = Math.round(num(req.query.wait, 0, 0, 110));
    const include = req.query.include === "responses" ? "responses" : req.query.include === "none" ? "none" : "rounds";
    const done = wait > 0 ? await waitForDebate(s.id, wait) : s;
    res.json(debateView(done ?? s, include));
  });

  app.post("/api/v1/quick", async (req, res) => {
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (!query) return void res.status(400).json({ error: "A query is required." });
    try { res.json(await quickAnswerForApi(ctxOf(req), query)); }
    catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : String(e) }); }
  });

  app.get("/api/v1/workflows", (req, res) => res.json({ workflows: listWorkflowInfos(ctxOf(req)) }));
  app.get("/api/v1/panels", (_req, res) => res.json({ panels: PANELS }));
  app.get("/api/v1/models", async (req, res) => {
    try {
      const key = ctxOf(req).apiKey;
      if (!key) return void res.status(400).json({ error: NO_KEY });
      res.json({ models: await fetchOpenRouterModels(key) });
    }
    catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : String(e) }); }
  });
}

// ─── OpenAPI description ─────────────────────────────────────
export function openapiDocument() {
  const debateInput = {
    type: "object", required: ["query"], properties: {
      query: { type: "string", description: "The question or decision to debate." },
      workflow: { type: "string", description: "A workflow id or name (see GET /workflows). Built in: precision, budget." },
      models: { type: "array", items: { type: "string" }, description: "OpenRouter model IDs. Overrides the workflow's models. Default: the quick, low-cost panel." },
      roles: { type: "array", items: { type: "string" }, description: "Optional role text per model, same order as models." },
      rounds: { type: "integer", minimum: 1, maximum: LIMITS.maxRounds },
      temperature: { type: "number", minimum: 0, maximum: 1.5 },
      consensus_threshold: { type: "number", minimum: 0.3, maximum: 1 },
      wait: { type: "integer", minimum: 0, maximum: 110, description: "Seconds to wait for the result before returning 202 with the debate id." },
      title: { type: "string" },
    },
  };
  const secured = [{ bearer: [] }, { openrouterKey: [] }];
  return {
    openapi: "3.0.3",
    info: { title: "Mercury API", version: VERSION, description: "Run multi-model debates through your own OpenRouter key. A hosted demo needs only X-OpenRouter-Key; a self-hosted instance also needs its bearer token." },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer", description: "MERCURY_API_TOKEN (self-hosted instances)." },
        openrouterKey: { type: "apiKey", in: "header", name: "X-OpenRouter-Key", description: "Your OpenRouter API key. Used for the request only." },
      },
    },
    paths: {
      "/api/v1/debates": {
        post: { summary: "Start a debate", security: secured, requestBody: { required: true, content: { "application/json": { schema: debateInput } } },
          responses: { "200": { description: "Finished within `wait`." }, "202": { description: "Still running; poll GET /api/v1/debates/{id}." }, "400": { description: "Invalid input." }, "401": { description: "Missing credentials." }, "429": { description: "Demo rate limit." } } },
        get: { summary: "List your recent debates", security: secured, responses: { "200": { description: "OK" } } },
      },
      "/api/v1/debates/{id}": {
        get: { summary: "Get a debate", security: secured,
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "wait", in: "query", schema: { type: "integer", maximum: 110 }, description: "Long-poll for up to this many seconds while the debate runs." },
            { name: "include", in: "query", schema: { type: "string", enum: ["none", "rounds", "responses"] }, description: "rounds (default) adds the round list; responses adds every model's text." },
          ],
          responses: { "200": { description: "OK" }, "404": { description: "Not found." } } },
      },
      "/api/v1/quick": { post: { summary: "One fast answer from the quick model", security: secured, requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["query"], properties: { query: { type: "string" } } } } } }, responses: { "200": { description: "OK" } } } },
      "/api/v1/workflows": { get: { summary: "List workflows", security: secured, responses: { "200": { description: "OK" } } } },
      "/api/v1/panels": { get: { summary: "Suggested model panels", security: secured, responses: { "200": { description: "OK" } } } },
      "/api/v1/models": { get: { summary: "Text models available on OpenRouter", security: secured, responses: { "200": { description: "OK" } } } },
      "/mcp": { post: { summary: "Model Context Protocol endpoint (JSON-RPC 2.0 over HTTP)", security: secured, responses: { "200": { description: "JSON-RPC response" }, "202": { description: "Notification accepted" } } } },
    },
  };
}
