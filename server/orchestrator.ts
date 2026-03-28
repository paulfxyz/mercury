import { storage } from "./storage";
import { randomUUID } from "crypto";

interface ModelResponse {
  modelId: string;
  modelName: string;
  content: string;
  agreementScore?: number;
}

async function callModel(
  apiKey: string,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string,
  temperature = 0.7
): Promise<string> {
  const body: Record<string, unknown> = {
    model: modelId,
    messages: systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages,
    max_tokens: 2000,
    temperature,
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://mercury.sh",
      "X-Title": "Mercury — Deep Research Engine",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenRouter error for ${modelId}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? "(no response)";
}

export async function fetchOpenRouterModels(apiKey: string) {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error("Failed to fetch models");
  const data = await res.json() as {
    data: Array<{ id: string; name: string; description: string; context_length: number; pricing: { prompt: string } }>
  };
  return data.data.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description?.slice(0, 120) || "",
    contextLength: m.context_length,
    pricingPrompt: m.pricing?.prompt ?? "0",
  }));
}

// Quick answer for simple queries (single cheap model, no debate)
export async function runQuickAnswer(
  sessionId: string,
  query: string,
  apiKey: string,
  onProgress: (update: Record<string, unknown>) => void
) {
  const quickModel = "openai/gpt-4o-mini";
  onProgress({ type: "quick_start", model: quickModel });

  try {
    const answer = await callModel(
      apiKey,
      quickModel,
      [{ role: "user", content: query }],
      "You are a helpful, concise assistant. Answer the question directly and clearly.",
      0.3
    );
    storage.updateSession(sessionId, { status: "completed", quickAnswer: answer, finalAnswer: answer });
    onProgress({ type: "quick_complete", answer });
  } catch (e) {
    storage.updateSession(sessionId, { status: "error" });
    onProgress({ type: "error", message: String(e) });
  }
}

// Detect if query is simple (heuristic + LLM classification)
export async function detectQueryComplexity(
  query: string,
  apiKey: string
): Promise<"simple" | "complex"> {
  // Heuristic: very short questions or factual lookups
  const simplePatterns = [
    /^what is /i,
    /^who is /i,
    /^when (was|did|is) /i,
    /^where is /i,
    /^how (many|much|old|tall|far) /i,
    /^define /i,
    /^spell /i,
  ];
  if (query.length < 60 && simplePatterns.some(p => p.test(query.trim()))) {
    return "simple";
  }

  // LLM classification for edge cases
  try {
    const result = await callModel(
      apiKey,
      "openai/gpt-4o-mini",
      [{ role: "user", content: `Classify this query as SIMPLE or COMPLEX. SIMPLE = factual, one-answer, no debate needed. COMPLEX = nuanced, multi-perspective, benefits from debate. Reply with exactly one word: SIMPLE or COMPLEX.\n\nQuery: "${query}"` }],
      undefined,
      0.1
    );
    return result.trim().toUpperCase().includes("SIMPLE") ? "simple" : "complex";
  } catch {
    return "complex"; // default to full debate on error
  }
}

// Full debate orchestration
export async function runOrchestration(
  sessionId: string,
  query: string,
  modelIds: string[],
  totalIterations: number,
  apiKey: string,
  onProgress: (update: Record<string, unknown>) => void,
  temperature = 0.7,
  consensusThreshold = 0.7
) {
  const phases = [
    {
      type: "research",
      label: "Initial Research",
      system: `You are an expert research analyst. Thoroughly analyze the following inquiry. Surface key facts, dimensions, and considerations. Be precise and comprehensive.`,
    },
    {
      type: "debate",
      label: "Debate Round",
      system: `You are participating in an expert panel debate. Review prior findings, challenge assumptions, identify weaknesses, and strengthen valid points with evidence. Be rigorous and direct.`,
    },
    {
      type: "vote",
      label: "Consensus Vote",
      system: `You are evaluating the debate so far. Rate agreement 1-10, state what you agree/disagree with, and vote: AGREE, PARTIALLY_AGREE, or DISAGREE. Be decisive.`,
    },
    {
      type: "synthesis",
      label: "Synthesis",
      system: `You are synthesizing all expert perspectives into a coherent view. Extract the strongest points, resolve contradictions, and produce a refined synthesis representing collective intelligence.`,
    },
    {
      type: "final",
      label: "Final Answer",
      system: `You are delivering the definitive final answer for this inquiry. Based on the full multi-expert debate and synthesis, produce a comprehensive, well-structured response. Use clear headers and sections. This is the authoritative consensus answer.`,
    },
  ];

  let allResponses: string[] = [];

  for (let i = 0; i < totalIterations; i++) {
    // Phase selection
    let phaseIndex: number;
    if (i === 0) phaseIndex = 0;
    else if (i === totalIterations - 1) phaseIndex = 4;
    else if (i === totalIterations - 2) phaseIndex = 3;
    else phaseIndex = 1 + (i % 2); // alternate debate/vote

    const phase = phases[Math.min(phaseIndex, phases.length - 1)];

    onProgress({
      type: "iteration_start",
      iteration: i + 1,
      phase: phase.type,
      phaseLabel: phase.label,
      totalIterations,
    });

    // Model selection: all for first 3 rounds, then rotating subset
    const modelsThisRound = i < 3
      ? modelIds
      : modelIds.slice(0, Math.max(2, Math.ceil(modelIds.length / 2)));

    const contextSummary = allResponses.length > 0
      ? `\n\n--- Prior expert findings ---\n${allResponses.slice(-4).join("\n\n---\n\n")}`
      : "";

    const augmentedQuery = `${query}${contextSummary}`;

    // Call models in parallel
    const settled = await Promise.allSettled(
      modelsThisRound.map(async (modelId) => {
        try {
          const content = await callModel(
            apiKey, modelId,
            [{ role: "user", content: augmentedQuery }],
            phase.system,
            temperature
          );
          return { modelId, modelName: modelId.split("/").pop() ?? modelId, content } as ModelResponse;
        } catch (e) {
          return { modelId, modelName: modelId.split("/").pop() ?? modelId, content: `[Error: ${e instanceof Error ? e.message : String(e)}]` } as ModelResponse;
        }
      })
    );

    const modelResults: ModelResponse[] = settled
      .filter((r): r is PromiseFulfilledResult<ModelResponse> => r.status === "fulfilled")
      .map(r => r.value);

    const successful = modelResults.filter(r => !r.content.startsWith("[Error:"));
    const rawConsensus = successful.length / Math.max(modelsThisRound.length, 1);

    const summary = `${successful.length}/${modelsThisRound.length} experts responded. Phase: ${phase.label}.`;

    if (successful.length > 0) {
      const combined = successful
        .map(r => `[${r.modelName}]: ${r.content.slice(0, 600)}`)
        .join("\n\n");
      allResponses.push(`Round ${i + 1} (${phase.label}):\n${combined}`);
    }

    storage.createIteration({
      sessionId,
      iterationNumber: i + 1,
      type: phase.type,
      content: JSON.stringify(modelResults),
      summary,
      consensus: rawConsensus,
    });

    storage.updateSession(sessionId, { currentIteration: i + 1 });

    onProgress({
      type: "iteration_complete",
      iteration: i + 1,
      phase: phase.type,
      phaseLabel: phase.label,
      responses: modelResults,
      summary,
      consensus: rawConsensus,
    });

    // Early consensus exit
    if (i >= 5 && rawConsensus >= consensusThreshold && phaseIndex >= 2) {
      // Accelerate to synthesis + final
      if (i < totalIterations - 3) {
        // skip ahead by updating remaining
        storage.updateSession(sessionId, { totalIterations: Math.min(totalIterations, i + 3) });
        break;
      }
    }
  }

  // Generate final answer from last successful response
  const finalIters = storage.getIterationsBySession(sessionId);
  const lastIter = finalIters[finalIters.length - 1];
  let finalAnswer = "";
  if (lastIter) {
    try {
      const parsed = JSON.parse(lastIter.content);
      const successful = (parsed as ModelResponse[]).filter(r => !r.content.startsWith("[Error:"));
      finalAnswer = successful[0]?.content ?? "";
    } catch { /* ignore */ }
  }

  storage.updateSession(sessionId, { status: "completed", finalAnswer });
  onProgress({ type: "completed", finalAnswer });
}
