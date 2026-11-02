import { PANELS } from "@shared/defaults";
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

export const SUGGESTED_PANELS: SuggestedPanel[] = PANELS.map(p => ({
  id: p.id,
  nameKey: ({ quick: "pack_quick", balanced: "pack_balanced", frontier: "pack_frontier", global: "pack_global" } as const)[p.id as "quick"],
  models: p.models,
}));
