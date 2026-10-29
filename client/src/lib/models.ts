import { QUICK_PANEL } from "@shared/defaults";
import type { TranslationKey } from "@/lib/i18n";

/**
 * Suggested debate panels shown in the wizard. All IDs were checked against the
 * live OpenRouter catalogue on 2026-10-29 (see benchmark/verify_models.py).
 * Panels are only suggestions; the wizard drops any ID missing from the user's catalogue.
 */
export interface SuggestedPanel {
  id: string;
  nameKey: TranslationKey;
  models: string[];
}

export const SUGGESTED_PANELS: SuggestedPanel[] = [
  {
    id: "quick",
    nameKey: "pack_quick",
    models: QUICK_PANEL.map(p => p.id),
  },
  {
    id: "balanced",
    nameKey: "pack_balanced",
    models: ["openai/gpt-6.1-terra", "anthropic/claude-sonnet-5.5", "google/gemini-3.8-flash", "x-ai/grok-4.7"],
  },
  {
    id: "frontier",
    nameKey: "pack_frontier",
    models: ["anthropic/claude-opus-5.5", "openai/gpt-6.1-sol", "google/gemini-4-argon", "x-ai/grok-4.7"],
  },
  {
    id: "global",
    nameKey: "pack_global",
    models: [
      "moonshotai/kimi-k3.1-pro",
      "deepseek/deepseek-v4.1-flash-1017",
      "z-ai/glm-5.3-prime",
      "qwen/qwen3.8-max-prime",
      "mistralai/mistral-large-4-0",
    ],
  },
];
