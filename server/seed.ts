import { storage } from "./storage";
import { SEED_WORKFLOWS } from "@shared/defaults";
import { SEED_TEXT } from "./seedText";

/**
 * Gives an owner the two ready-made workflows, once. Returns true when something was created.
 * `owner` is the visitor id in demo mode, or null for a self-hosted instance (shared data).
 */
export function seedWorkflows(owner: string | null, lang = "en"): boolean {
  const flag = `seeded:${owner ?? "shared"}`;
  if (storage.getSetting(flag)) return false;
  storage.setSetting(flag, "1");
  if (storage.listWorkflows(owner ?? undefined).length > 0 && owner === null) return false; // existing self-hosted setup: leave it alone
  const text = SEED_TEXT[lang] ?? SEED_TEXT[lang.split("-")[0]] ?? SEED_TEXT.en;
  for (const w of SEED_WORKFLOWS) {
    storage.createWorkflow({
      name: text[w.slug].name,
      description: text[w.slug].desc,
      steps: JSON.stringify(w.models.map(m => ({ modelId: m.id, label: m.label, systemPrompt: m.role }))),
      iterations: w.rounds, temperature: w.temperature, consensusThreshold: w.threshold,
      isDefault: 0, owner,
    });
  }
  return true;
}
