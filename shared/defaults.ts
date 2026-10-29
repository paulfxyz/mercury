/**
 * Defaults shared by the server and the client, so model IDs live in exactly one place.
 * Every ID below was checked against the live OpenRouter catalogue on 2026-10-29.
 */

/** Cheap, fast model used for quick answers, follow-ups and query classification. */
export const QUICK_MODEL = "anthropic/claude-haiku-5.5";

/** Default three-model panel for the one-click "Quick debate" (low cost, three different vendors). */
export const QUICK_PANEL: Array<{ id: string; label: string }> = [
  { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5" },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna" },
  { id: "deepseek/deepseek-v4.1-flash-1017", label: "DeepSeek V4.1 Flash" },
];

export const QUICK_ROUNDS = 4;
export const QUICK_TEMPERATURE = 0.3;
export const QUICK_THRESHOLD = 0.7;

/** Hard limits applied by the server regardless of what the client sends. */
export const LIMITS = {
  maxModels: 12,
  minRounds: 2,
  maxRounds: 30,
  maxQueryChars: 8000,
} as const;
