import type { Express, Request, Response } from "express";
import { apiAuth, cors, startDebateFromInput, findDebate, listWorkflowInfos, quickAnswerForApi, listDebates, type ApiContext } from "./api";
import { debateView, waitForDebate, type DebateView } from "./debates";
import { PANELS, VERSION, LIMITS } from "@shared/defaults";
import { num } from "./config";

/**
 * Minimal Model Context Protocol server over Streamable HTTP (stateless, JSON responses only).
 * Implements initialize, ping, tools/list and tools/call, which is what agent clients need.
 * Authentication is the same as the REST API (see api.ts).
 */

const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface Tool { name: string; description: string; inputSchema: Record<string, unknown> }

const TOOLS: Tool[] = [
  {
    name: "mercury_debate",
    description:
      "Run a multi-model debate on a question and return the panel's final answer, the consensus score (0 to 1, self-reported by the models) and the cost. " +
      "Several AI models research the question independently, challenge each other, vote and then synthesise one answer. Use it for decisions, reviews and questions where a second and third opinion matter. " +
      "It is slower and more expensive than a single model call. If the debate is still running when wait_seconds ends, the result has status \"running\"; call mercury_get_debate with the id.",
    inputSchema: {
      type: "object", required: ["query"], properties: {
        query: { type: "string", description: "The question, decision or text to debate. Include all context the panel needs." },
        workflow: { type: "string", description: "Name or id of a workflow: \"precision\" (three top models, ten rounds, strict) or \"budget\" (three cheap models, four rounds), or a saved workflow. Omit for the quick low-cost panel." },
        models: { type: "array", items: { type: "string" }, description: "OpenRouter model IDs to use instead of the workflow's." },
        roles: { type: "array", items: { type: "string" }, description: "Optional role per model, e.g. \"sceptic\", in the same order as models." },
        rounds: { type: "integer", minimum: 1, maximum: LIMITS.maxRounds },
        temperature: { type: "number", minimum: 0, maximum: 1.5 },
        consensus_threshold: { type: "number", minimum: 0.3, maximum: 1 },
        wait_seconds: { type: "integer", minimum: 0, maximum: 110, description: "How long to wait for the result. Default 55." },
      },
    },
  },
  {
    name: "mercury_get_debate",
    description: "Get the status and result of a debate started earlier. Set wait_seconds to wait for a running debate. include=\"responses\" adds every model's text per round.",
    inputSchema: {
      type: "object", required: ["id"], properties: {
        id: { type: "string" },
        wait_seconds: { type: "integer", minimum: 0, maximum: 110 },
        include: { type: "string", enum: ["none", "rounds", "responses"] },
      },
    },
  },
  {
    name: "mercury_list_debates",
    description: "List your most recent debates with status and final answers.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 } } },
  },
  {
    name: "mercury_quick_answer",
    description: "Get one fast answer from a single low-cost model, with no debate. Use it to check whether a debate is needed.",
    inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string" } } },
  },
  {
    name: "mercury_list_workflows",
    description: "List the available debate workflows and the suggested model panels.",
    inputSchema: { type: "object", properties: {} },
  },
];

function summarise(v: DebateView): string {
  const lines: string[] = [];
  lines.push(`Debate ${v.id}: ${v.status}` + (v.status === "running" ? ` (round ${v.rounds_completed} of ${v.rounds_planned})` : ""));
  if (v.final_answer) {
    lines.push("", v.final_answer);
  }
  if (v.status === "completed") {
    const pct = v.consensus === null ? "not measured" : `${Math.round(v.consensus * 100)}%`;
    lines.push("", `Consensus (self-reported by the models): ${pct}. Rounds: ${v.rounds_completed}. Models: ${v.models.join(", ")}.` + (v.cost_usd !== null ? ` Cost: $${v.cost_usd.toFixed(4)}.` : ""));
  }
  if (v.status === "running") lines.push("", `Still running. Call mercury_get_debate with id "${v.id}" to fetch the result.`);
  if (v.error) lines.push("", v.error);
  return lines.join("\n");
}

const ok = (text: string, structured?: unknown) => ({ content: [{ type: "text", text }], ...(structured ? { structuredContent: structured } : {}) });
const fail = (text: string) => ({ content: [{ type: "text", text }], isError: true });

async function callTool(ctx: ApiContext, name: string, args: any): Promise<unknown> {
  switch (name) {
    case "mercury_debate": {
      const wait = Math.round(num(args?.wait_seconds, 55, 0, 110));
      const r = await startDebateFromInput(ctx, args ?? {}, wait);
      return r.ok ? ok(summarise(r.view), r.view) : fail(r.error);
    }
    case "mercury_get_debate": {
      const s = typeof args?.id === "string" ? findDebate(ctx, args.id) : undefined;
      if (!s) return fail("That debate was not found.");
      const done = await waitForDebate(s.id, Math.round(num(args?.wait_seconds, 0, 0, 110)));
      const include = args?.include === "responses" ? "responses" : args?.include === "none" ? "none" : "rounds";
      const v = debateView(done ?? s, include);
      return ok(summarise(v), v);
    }
    case "mercury_list_debates": {
      const list = listDebates(ctx, Math.round(num(args?.limit, 10, 1, 50)));
      const text = list.length === 0 ? "No debates yet." : list.map(d => `${d.id} [${d.status}] ${d.query.slice(0, 80)}`).join("\n");
      return ok(text, { debates: list });
    }
    case "mercury_quick_answer": {
      const q = typeof args?.query === "string" ? args.query.trim() : "";
      if (!q) return fail("A query is required.");
      const r = await quickAnswerForApi(ctx, q);
      return ok(r.answer, r);
    }
    case "mercury_list_workflows": {
      const workflows = listWorkflowInfos(ctx);
      const text = workflows.map(w => `${w.id}: ${w.name}, ${w.models.length} models, ${w.rounds} rounds. ${w.description}`).join("\n");
      return ok(text, { workflows, panels: PANELS });
    }
    default:
      return fail(`Unknown tool "${name}".`);
  }
}

async function handle(ctx: ApiContext, msg: any): Promise<unknown | null> {
  const id = msg?.id;
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const error = (code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return error(-32600, "Invalid request.");
  if (id === undefined) return null;                                   // notification: no response
  switch (msg.method) {
    case "initialize": {
      const asked = msg.params?.protocolVersion;
      return reply({
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "mercury", title: "Mercury debate organiser", version: VERSION },
        instructions: "Use mercury_debate to have several AI models debate a question through the caller's own OpenRouter key and return one answer with a consensus score.",
      });
    }
    case "ping": return reply({});
    case "tools/list": return reply({ tools: TOOLS });
    case "tools/call": {
      try { return reply(await callTool(ctx, String(msg.params?.name), msg.params?.arguments)); }
      catch (e) { return reply(fail(e instanceof Error ? e.message : String(e))); }
    }
    default: return error(-32601, `Method not found: ${msg.method}`);
  }
}

export function registerMcp(app: Express) {
  app.get("/mcp", cors, (_req, res) => {
    res.status(405).set("Allow", "POST").json({ error: "This MCP endpoint accepts POST requests with JSON-RPC messages." });
  });
  app.delete("/mcp", cors, (_req, res) => res.sendStatus(405));
  app.post("/mcp", cors, apiAuth, async (req: Request, res: Response) => {
    const ctx = (req as any).api as ApiContext;
    const body = req.body;
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map(m => handle(ctx, m)))).filter(r => r !== null);
      return void (out.length ? res.json(out) : res.sendStatus(202));
    }
    const r = await handle(ctx, body);
    if (r === null) return void res.sendStatus(202);
    res.json(r);
  });
}
