import { storage } from "./storage";
import { randomUUID } from "crypto";

interface ModelResponse {
  modelId: string;
  modelName: string;
  content: string;
  reasoning?: string;
  vote?: string;
  agreementScore?: number;
}

interface IterationResult {
  responses: ModelResponse[];
  summary: string;
  consensus: number;
  type: string;
}

// Call OpenRouter API for a single model
async function callModel(
  apiKey: string,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    model: modelId,
    messages: systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages,
    max_tokens: 2000,
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://mercury.sh",
      "X-Title": "Mercury Deep Research",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error for ${modelId}: ${err}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? "(no response)";
}

// Fetch available models from OpenRouter
export async function fetchOpenRouterModels(apiKey: string) {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error("Failed to fetch models");
  const data = await res.json() as { data: Array<{ id: string; name: string; description: string; context_length: number; pricing: { prompt: string } }> };
  return data.data.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description?.slice(0, 120) || "",
    contextLength: m.context_length,
    pricingPrompt: m.pricing?.prompt ?? "0",
  }));
}

// Main orchestration engine
export async function runOrchestration(
  sessionId: string,
  query: string,
  modelIds: string[],
  totalIterations: number,
  apiKey: string,
  onProgress: (update: Record<string, unknown>) => void
) {
  // Phase labels
  const phases = [
    { type: "research", label: "Initial Research", system: `You are a rigorous research assistant. Your task is to thoroughly research and analyze the following query. Provide comprehensive initial findings, identify key dimensions of the problem, and surface any important considerations. Be thorough and precise.` },
    { type: "debate", label: "Debate Round", system: `You are participating in an intellectual debate. Review the query and previous findings from your peers. Identify points of agreement and disagreement. Challenge assumptions, add nuance, provide counter-arguments where warranted, and strengthen valid points. Be constructive and precise.` },
    { type: "vote", label: "Consensus Vote", system: `You are evaluating the accumulated research and debate. Rate your agreement with the current consensus on a scale of 1-10. State your position clearly, what you agree with, what you'd change, and vote: AGREE, PARTIALLY_AGREE, or DISAGREE. Be direct and decisive.` },
    { type: "synthesis", label: "Synthesis", system: `You are synthesizing diverse perspectives into a coherent view. Review all findings and arguments. Extract the strongest points, resolve contradictions, identify where consensus is emerging, and produce a refined synthesis that represents the collective intelligence of all models.` },
    { type: "final", label: "Final Answer", system: `You are delivering a final, authoritative answer. Based on the multi-model debate and synthesis process, produce a comprehensive, well-structured final answer. This should be the definitive response — clear, actionable, and backed by the collective reasoning process. Format it properly with headers and sections as needed.` },
  ];

  let conversationHistory: Array<{ role: string; content: string }> = [
    { role: "user", content: query },
  ];

  let allResponses: string[] = [];

  for (let i = 0; i < totalIterations; i++) {
    // Determine phase
    let phaseIndex: number;
    if (i === 0) phaseIndex = 0; // research
    else if (i < totalIterations - 3) phaseIndex = 1 + (i % 2); // alternate debate/vote
    else if (i === totalIterations - 2) phaseIndex = 3; // synthesis
    else phaseIndex = 4; // final

    const phase = phases[Math.min(phaseIndex, phases.length - 1)];

    onProgress({ type: "iteration_start", iteration: i + 1, phase: phase.label, totalIterations });

    // Select which models to call this iteration (rotate through for efficiency)
    const modelsThisRound = i < 3
      ? modelIds // all models for first few rounds
      : modelIds.slice(0, Math.max(2, Math.ceil(modelIds.length / 2))); // subset later

    const contextSummary = allResponses.length > 0
      ? `\n\n--- Previous findings ---\n${allResponses.slice(-3).join("\n\n---\n\n")}`
      : "";

    const augmentedQuery = `${query}${contextSummary}`;

    // Call all models in parallel
    const modelResults: ModelResponse[] = await Promise.allSettled(
      modelsThisRound.map(async (modelId) => {
        try {
          const content = await callModel(apiKey, modelId, [
            { role: "user", content: augmentedQuery },
          ], phase.system);

          return {
            modelId,
            modelName: modelId.split("/").pop() ?? modelId,
            content,
          } as ModelResponse;
        } catch (e) {
          return {
            modelId,
            modelName: modelId.split("/").pop() ?? modelId,
            content: `Error: ${e instanceof Error ? e.message : String(e)}`,
          } as ModelResponse;
        }
      })
    ).then((results) =>
      results
        .filter((r): r is PromiseFulfilledResult<ModelResponse> => r.status === "fulfilled")
        .map((r) => r.value)
    );

    // Compute consensus score based on response similarity
    const successfulResponses = modelResults.filter((r) => !r.content.startsWith("Error:"));
    const consensusScore = successfulResponses.length / Math.max(modelsThisRound.length, 1);

    // Build summary
    const summary = successfulResponses.length > 0
      ? `${successfulResponses.length}/${modelsThisRound.length} models responded. Phase: ${phase.label}.`
      : "No successful responses this iteration.";

    // Accumulate context
    if (successfulResponses.length > 0) {
      const combinedInsight = successfulResponses
        .map((r) => `[${r.modelName}]: ${r.content.slice(0, 500)}`)
        .join("\n\n");
      allResponses.push(`Iteration ${i + 1} (${phase.label}):\n${combinedInsight}`);
    }

    // Store iteration
    storage.createIteration({
      sessionId,
      iterationNumber: i + 1,
      type: phase.type,
      content: JSON.stringify(modelResults),
      summary,
      consensus: consensusScore,
    });

    // Update session progress
    storage.updateSession(sessionId, { currentIteration: i + 1 });

    onProgress({
      type: "iteration_complete",
      iteration: i + 1,
      phase: phase.label,
      responses: modelResults,
      summary,
      consensus: consensusScore,
    });

    // If it's the final iteration, extract the final answer
    if (i === totalIterations - 1 && successfulResponses.length > 0) {
      const finalAnswer = successfulResponses[0].content;
      storage.updateSession(sessionId, { status: "completed", finalAnswer });
      onProgress({ type: "completed", finalAnswer });
    }
  }
}
