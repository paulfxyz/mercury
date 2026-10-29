import { storage } from "./storage";
import { QUICK_MODEL } from "@shared/defaults";

// ─── Types ───────────────────────────────────────────────────

export interface ModelResponse {
  modelId: string;
  modelName: string;
  content: string;
  /** True when the call failed; `content` then holds a human-readable error. */
  failed?: boolean;
  /** Vote/agreement score in [0,1] when the model reported one. */
  agreement?: number;
  /** Vote keyword when the model reported one. */
  vote?: "AGREE" | "PARTIALLY_AGREE" | "DISAGREE";
}

export interface CallResult {
  content: string;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
}

export interface OrchestrationResult {
  finalAnswer: string;
  consensus: number | null;
  costUsd: number;
  rounds: number;
}

type PhaseType = "research" | "debate" | "vote" | "synthesis" | "final";
type Progress = (update: Record<string, unknown>) => void;

const OPENROUTER = "https://openrouter.ai/api/v1";
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;
const MAX_OUTPUT_TOKENS = 8000;

// ─── OpenRouter client ───────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function describeHttpError(status: number, body: string): string {
  try {
    const j = JSON.parse(body);
    const msg = j?.error?.message ?? j?.message;
    if (msg) return `HTTP ${status}: ${String(msg).slice(0, 300)}`;
  } catch { /* not JSON */ }
  return `HTTP ${status}: ${body.slice(0, 300)}`;
}

/**
 * Calls one model through OpenRouter with a timeout and retries on rate limits,
 * 5xx responses, network errors and empty completions.
 */
export async function callModel(
  apiKey: string,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string,
  temperature = 0.7,
  maxTokens = MAX_OUTPUT_TOKENS,
): Promise<CallResult> {
  const body = JSON.stringify({
    model: modelId,
    messages: systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages,
    max_tokens: maxTokens,
    temperature,
    usage: { include: true },
  });

  let lastError = "unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${OPENROUTER}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mercury.sh",
          "X-Title": "Mercury",
        },
        body,
      });
      const text = await res.text();
      if (!res.ok) {
        lastError = describeHttpError(res.status, text);
        const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
        if (!retryable) throw new NonRetryable(lastError);
      } else {
        const data = JSON.parse(text) as {
          choices?: Array<{ message?: { content?: string | null } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
          error?: { message?: string };
        };
        if (data.error) {
          lastError = `Provider error: ${String(data.error.message ?? "unknown").slice(0, 300)}`;
        } else {
          const content = data.choices?.[0]?.message?.content?.trim() ?? "";
          if (content) {
            return {
              content,
              costUsd: data.usage?.cost ?? 0,
              promptTokens: data.usage?.prompt_tokens ?? 0,
              completionTokens: data.usage?.completion_tokens ?? 0,
            };
          }
          lastError = "The model returned an empty response.";
        }
      }
    } catch (e) {
      if (e instanceof NonRetryable) throw new Error(`${modelId}: ${e.message}`);
      lastError = e instanceof Error && e.name === "AbortError"
        ? `Timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`
        : e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 300);
  }
  throw new Error(`${modelId}: ${lastError}`);
}

class NonRetryable extends Error {}

// ─── Model catalogue ─────────────────────────────────────────

/** Fetches the OpenRouter catalogue, keeping only usable text models. */
export async function fetchOpenRouterModels(apiKey: string) {
  const res = await fetch(`${OPENROUTER}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error("Failed to fetch models");
  const data = await res.json() as {
    data: Array<{
      id: string; name: string; description?: string; context_length: number;
      pricing?: { prompt?: string; completion?: string };
      architecture?: { output_modalities?: string[] };
    }>;
  };
  return data.data
    .filter(m => {
      const prompt = parseFloat(m.pricing?.prompt ?? "0");
      const completion = parseFloat(m.pricing?.completion ?? "0");
      if (prompt < 0 || completion < 0) return false;                      // routers with placeholder pricing
      if (m.id.endsWith(":batch")) return false;                           // asynchronous batch variants
      const out = m.architecture?.output_modalities;
      return !out || out.includes("text") && !out.includes("image");      // text-in/text-out only
    })
    .map(m => ({
      id: m.id,
      name: m.name,
      description: m.description?.slice(0, 120) || "",
      contextLength: m.context_length,
      pricingPrompt: m.pricing?.prompt ?? "0",
      pricingCompletion: m.pricing?.completion ?? "0",
    }));
}

// ─── Quick answers and classification ────────────────────────

export async function answerQuick(apiKey: string, query: string, context?: string): Promise<CallResult> {
  const system = "You are a helpful, concise assistant. Answer the question directly and clearly."
    + (context ? `\n\nConversation so far:\n${context}` : "");
  return callModel(apiKey, QUICK_MODEL, [{ role: "user", content: query }], system, 0.3);
}

export async function runQuickAnswer(sessionId: string, query: string, apiKey: string, onProgress: Progress) {
  onProgress({ type: "quick_start", model: QUICK_MODEL });
  try {
    const { content } = await answerQuick(apiKey, query);
    storage.updateSession(sessionId, { status: "completed", quickAnswer: content, finalAnswer: content });
    onProgress({ type: "quick_complete", answer: content });
  } catch (e) {
    storage.updateSession(sessionId, { status: "error" });
    onProgress({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }
}

/** Decides whether a query needs a debate. Falls back to "complex" on any failure. */
export async function detectQueryComplexity(query: string, apiKey: string): Promise<"simple" | "complex"> {
  const simplePatterns = [/^what is /i, /^who is /i, /^when (was|did|is) /i, /^where is /i, /^how (many|much|old|tall|far) /i, /^define /i, /^spell /i];
  if (query.length < 60 && simplePatterns.some(p => p.test(query.trim()))) return "simple";
  try {
    const { content } = await callModel(
      apiKey, QUICK_MODEL,
      [{ role: "user", content: `Classify this query as SIMPLE or COMPLEX. SIMPLE = factual, one-answer, no debate needed. COMPLEX = nuanced, multi-perspective, benefits from debate. Reply with exactly one word: SIMPLE or COMPLEX.\n\nQuery: "${query.slice(0, 2000)}"` }],
      undefined, 0, 20,
    );
    return /\bSIMPLE\b/i.test(content) ? "simple" : "complex";
  } catch {
    return "complex";
  }
}

// ─── Phases ──────────────────────────────────────────────────

const AGREEMENT_FOOTER =
  `\n\nEnd your reply with one final line in exactly this format:\nVOTE: <AGREE|PARTIALLY_AGREE|DISAGREE> | SCORE: <1-10>\n` +
  `(SCORE is how strongly you agree with the panel's emerging answer; 10 means full agreement.)`;

const PHASE_PROMPTS: Record<PhaseType, { label: string; system: string }> = {
  research: {
    label: "Initial Research",
    system: "You are an expert analyst. Work out the answer to the inquiry independently and carefully. State key facts, check any calculations step by step, and flag anything uncertain or any false premise in the question. Be precise.",
  },
  debate: {
    label: "Debate Round",
    system: "You are on an expert panel. Review the other experts' findings below. Point out specific errors or unsupported claims, defend or correct your own position, and say where you now stand. Verify any arithmetic yourself instead of trusting others. Do not agree just to be agreeable." + AGREEMENT_FOOTER,
  },
  vote: {
    label: "Consensus Vote",
    system: "You are evaluating the panel's debate so far. Briefly state what you accept, what you reject, and what remains unresolved, then cast your vote." + AGREEMENT_FOOTER,
  },
  synthesis: {
    label: "Synthesis",
    system: "Synthesize the panel's findings into one coherent position. Keep the claims that survived scrutiny, drop the ones that were refuted, and state clearly any point that is still disputed.",
  },
  final: {
    label: "Final Answer",
    system: "You are delivering the panel's final answer to the original inquiry. Base it on the debate and synthesis, correct anything the panel got wrong, and answer the question that was actually asked. Be direct: lead with the answer, then give the reasoning concisely. Mention real disagreements or uncertainty honestly. Write as if you alone are answering the user: never refer to a panel, experts, rounds or this process.",
  },
};

/**
 * Builds the sequence of phases for a debate of `n` rounds:
 * research, then alternating debate/vote rounds, then synthesis and a final answer.
 */
export function planPhases(n: number): PhaseType[] {
  if (n <= 1) return ["final"];
  if (n === 2) return ["research", "final"];
  if (n === 3) return ["research", "debate", "final"];
  const middle: PhaseType[] = [];
  for (let k = 0; k < n - 3; k++) middle.push(k % 2 === 0 ? "debate" : "vote");
  return ["research", ...middle, "synthesis", "final"];
}

const VOTE_VALUE = { AGREE: 1, PARTIALLY_AGREE: 0.5, DISAGREE: 0 } as const;

/** Extracts the `VOTE: X | SCORE: n` footer. Returns undefined fields when absent. */
export function parseVote(text: string): { vote?: ModelResponse["vote"]; agreement?: number } {
  const voteMatch = Array.from(text.matchAll(/VOTE\s*[:=]\s*\**\s*(PARTIALLY[_ ]AGREE|AGREE|DISAGREE)/gi)).pop();
  const scoreMatch = Array.from(text.matchAll(/SCORE\s*[:=]\s*\**\s*(\d{1,2})(?:\s*\/\s*10)?/gi)).pop();
  const vote = voteMatch ? (voteMatch[1].toUpperCase().replace(" ", "_") as ModelResponse["vote"]) : undefined;
  const score = scoreMatch ? Math.min(10, Math.max(0, parseInt(scoreMatch[1], 10))) / 10 : undefined;
  const agreement = score ?? (vote ? VOTE_VALUE[vote] : undefined);
  return { vote, agreement };
}

function stripVoteFooter(text: string): string {
  return text.replace(/\n*\**VOTE\s*[:=][^\n]*$/i, "").trim();
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + " […]";
}

// ─── Debate orchestration ────────────────────────────────────

export async function runOrchestration(
  sessionId: string,
  query: string,
  modelIds: string[],
  totalIterations: number,
  apiKey: string,
  onProgress: Progress,
  temperature = 0.7,
  consensusThreshold = 0.7,
  roles: string[] = [],
): Promise<OrchestrationResult> {
  let plan = planPhases(totalIterations);
  let total = plan.length;
  let costUsd = 0;
  let lastConsensus: number | null = null;
  const history: Array<{ round: number; label: string; entries: Array<{ name: string; text: string }> }> = [];
  const nameOf = (id: string) => id.split("/").pop() ?? id;
  const failures = new Map<string, number>();

  const contextFor = () => {
    if (history.length === 0) return "";
    const parts = history.slice(-3).map((h, idx, arr) => {
      const isLatest = idx === arr.length - 1;
      const budget = isLatest ? 1800 : 700;
      return `## Round ${h.round}: ${h.label}\n` + h.entries.map(e => `[${e.name}]\n${clip(e.text, budget)}`).join("\n\n");
    });
    return `\n\n--- Panel record so far ---\n${parts.join("\n\n")}`;
  };

  for (let i = 0; i < plan.length; i++) {
    const phaseType = plan[i];
    const phase = PHASE_PROMPTS[phaseType];
    storage.updateSession(sessionId, { totalIterations: total });
    onProgress({ type: "iteration_start", iteration: i + 1, phase: phaseType, phaseLabel: phase.label, totalIterations: total });

    // The final answer is written by one model (first healthy one) so the user gets one coherent text.
    const healthy = modelIds.filter(m => (failures.get(m) ?? 0) < 2);
    const pool = healthy.length > 0 ? healthy : modelIds;
    const speakers = phaseType === "final" ? [pool[0]] : pool;

    const userMsg = `Inquiry:\n${query}${contextFor()}`;

    const run = async (modelId: string): Promise<ModelResponse> => {
      const role = roles[modelIds.indexOf(modelId)]?.trim();
      const system = role ? `${phase.system}\n\nYour assigned perspective: ${role}` : phase.system;
      const candidates = phaseType === "final" ? [modelId, ...pool.filter(m => m !== modelId)] : [modelId];
      let lastErr = "";
      for (const id of candidates) {
        try {
          const temp = phaseType === "synthesis" || phaseType === "final" ? Math.min(temperature, 0.3) : temperature;
          const r = await callModel(apiKey, id, [{ role: "user", content: userMsg }], system, temp);
          costUsd += r.costUsd;
          const parsed = phaseType === "debate" || phaseType === "vote" ? parseVote(r.content) : {};
          return { modelId: id, modelName: nameOf(id), content: stripVoteFooter(r.content), ...parsed };
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          failures.set(id, (failures.get(id) ?? 0) + 1);
        }
      }
      return { modelId, modelName: nameOf(modelId), content: lastErr, failed: true };
    };

    const results = await Promise.all(speakers.map(run));
    const ok = results.filter(r => !r.failed);

    if (ok.length === 0) {
      const reason = results[0]?.content ?? "All models failed.";
      storage.createIteration({
        sessionId, iterationNumber: i + 1, type: phaseType, content: JSON.stringify(results),
        summary: `0/${speakers.length} experts responded.`, consensus: null,
      });
      throw new Error(`Every model failed in round ${i + 1}. ${reason}`);
    }

    // Consensus is the mean self-reported agreement of the models that cast a vote this round.
    const scored = ok.filter(r => typeof r.agreement === "number");
    const consensus = scored.length > 0
      ? scored.reduce((s, r) => s + (r.agreement as number), 0) / scored.length
      : null;
    if (consensus !== null) lastConsensus = consensus;

    const summary = `${ok.length}/${speakers.length} experts responded.`
      + (consensus !== null ? ` Mean agreement ${Math.round(consensus * 100)}%.` : "");

    history.push({ round: i + 1, label: phase.label, entries: ok.map(r => ({ name: r.modelName, text: r.content })) });

    storage.createIteration({
      sessionId, iterationNumber: i + 1, type: phaseType,
      content: JSON.stringify(results), summary, consensus,
    });
    storage.updateSession(sessionId, { currentIteration: i + 1 });
    onProgress({
      type: "iteration_complete", iteration: i + 1, phase: phaseType, phaseLabel: phase.label,
      responses: results, summary, consensus: consensus ?? 0, totalIterations: total,
    });

    // Early exit: once a vote after at least two debate rounds reaches the threshold,
    // skip the remaining debate rounds but still run synthesis and the final answer.
    if (phaseType === "vote" && consensus !== null && consensus >= consensusThreshold && i >= 4) {
      const remainingDebate = plan.slice(i + 1).some(p => p === "debate" || p === "vote");
      if (remainingDebate) {
        plan = [...plan.slice(0, i + 1), "synthesis", "final"];
        total = plan.length;
        storage.updateSession(sessionId, { totalIterations: total });
        onProgress({ type: "early_consensus", iteration: i + 1, consensus, totalIterations: total });
      }
    }
  }

  const finalRound = history[history.length - 1];
  const finalAnswer = finalRound?.entries[0]?.text ?? "";
  storage.updateSession(sessionId, { status: "completed", finalAnswer });
  onProgress({ type: "completed", finalAnswer, consensus: lastConsensus, costUsd });
  return { finalAnswer, consensus: lastConsensus, costUsd, rounds: plan.length };
}
