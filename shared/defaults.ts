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

/** Current Mercury version. `npm test` checks that it matches package.json. */
export const VERSION = "3.9.3";

/** Suggested debate panels (shown in the wizard and listed by the API). Model IDs are verified by benchmark/verify_models.py. */
export const PANELS: Array<{ id: string; models: string[] }> = [
  { id: "quick", models: QUICK_PANEL.map(p => p.id) },
  { id: "balanced", models: ["openai/gpt-6.1-terra", "anthropic/claude-sonnet-5.5", "google/gemini-3.8-flash", "x-ai/grok-4.7"] },
  { id: "frontier", models: ["anthropic/claude-opus-5.5", "openai/gpt-6.1-sol", "google/gemini-4-argon", "x-ai/grok-4.7"] },
  { id: "global", models: ["moonshotai/kimi-k3.1-pro", "deepseek/deepseek-v4.1-flash-1017", "z-ai/glm-5.3-prime", "qwen/qwen3.8-max-prime", "mistralai/mistral-large-4-0"] },
];

/**
 * Ready-made workflows. Every visitor of a demo (and every fresh self-hosted instance) gets these two.
 * Display names and descriptions are localised in server/seedText.ts.
 */
export const SEED_WORKFLOWS = [
  {
    slug: "precision",
    models: [
      { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5", role: "Lead analyst: work the problem step by step and state your confidence." },
      { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol", role: "Sceptic: look for errors, hidden assumptions and counterexamples." },
      { id: "google/gemini-4-argon", label: "Gemini 4 Argon", role: "Fact-checker: verify every number, date and claim independently." },
    ],
    rounds: 10, temperature: 0.3, threshold: 0.9,
  },
  {
    slug: "budget",
    models: [
      { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5", role: "" },
      { id: "openai/gpt-6-luna", label: "GPT-6 Luna", role: "" },
      { id: "deepseek/deepseek-v4.1-flash-1017", label: "DeepSeek V4.1 Flash", role: "" },
    ],
    rounds: 4, temperature: 0.3, threshold: 0.7,
  },
] as const;
