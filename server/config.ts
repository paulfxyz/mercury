import { LIMITS } from "@shared/defaults";

/** MERCURY_DEMO=1: public demo. Per-visitor data, no server-side keys, request limits. */
export const DEMO = process.env.MERCURY_DEMO === "1";
/** MERCURY_PASSWORD: optional HTTP Basic password for the web app. */
export const PASSWORD = process.env.MERCURY_PASSWORD ?? "";
/** MERCURY_API_TOKEN: bearer token that enables /api/v1 and /mcp on a self-hosted instance. */
export const API_TOKEN = process.env.MERCURY_API_TOKEN ?? "";

export const DEMO_LIMITS = { maxModels: 5, maxRounds: 10, inquiriesPerHour: 20 };

export const limits = () => (DEMO
  ? { maxModels: DEMO_LIMITS.maxModels, maxRounds: DEMO_LIMITS.maxRounds }
  : { maxModels: LIMITS.maxModels, maxRounds: LIMITS.maxRounds });

const hits = new Map<string, number[]>();
/** Tiny in-memory rate limiter, only active in demo mode. Returns true when the caller is over the limit. */
export function rateLimited(key: string): boolean {
  if (!DEMO) return false;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < 3600_000);
  if (recent.length >= DEMO_LIMITS.inquiriesPerHour) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export interface DebateConfig { models: string[]; roles: string[]; rounds: number; temperature: number; threshold: number }

/** Validates and clamps debate settings coming from a client. Returns an error message on failure. */
export function parseDebateConfig(body: any): DebateConfig | string {
  const rawModels: unknown = body.selectedModels ?? body.models;
  if (!Array.isArray(rawModels) || rawModels.length === 0) return "At least one model must be selected.";
  const models = rawModels.filter((m): m is string => typeof m === "string" && /^[\w.\-]+\/[\w.:\-]+$/.test(m));
  if (models.length === 0) return "The selected models are not valid OpenRouter model IDs.";
  const { maxModels, maxRounds } = limits();
  if (models.length > maxModels) return `At most ${maxModels} models can be used in one debate.`;
  const roles = Array.isArray(body.roles) ? body.roles.map((r: unknown) => String(r ?? "").slice(0, 500)) : [];
  return {
    models, roles,
    rounds: Math.round(num(body.iterations ?? body.rounds, 8, 1, maxRounds)),
    temperature: num(body.temperature, 0.7, 0, 1.5),
    threshold: num(body.consensusThreshold ?? body.consensus_threshold, 0.7, 0.3, 1),
  };
}
