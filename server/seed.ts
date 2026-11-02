import { storage } from "./storage";
import { SEED_WORKFLOWS } from "@shared/defaults";
import { SEED_TEXT } from "./seedText";

function textFor(lang: string) {
  return SEED_TEXT[lang] ?? SEED_TEXT[lang.split("-")[0]] ?? SEED_TEXT.en;
}

/** Identifies a ready-made workflow by its models and round count (names are localised, so they cannot be used). */
function signature(rounds: number, modelIds: string[]) { return `${rounds}|${modelIds.join(",")}`; }

/**
 * Makes sure an owner has both ready-made workflows, creating whichever is missing. Safe to call repeatedly.
 * Workflows created before the seed marker existed are recognised by their models and tagged instead of duplicated.
 * Returns the number of workflows created.
 */
export function ensureSeedWorkflows(owner: string | null, lang = "en"): number {
  const mine = storage.listWorkflows(owner ?? undefined);
  const have = new Set<string>();
  for (const w of mine) {
    if (w.seedSlug) { have.add(w.seedSlug); continue; }
    let ids: string[] = [];
    try { ids = (JSON.parse(w.steps) as Array<{ modelId: string }>).map(s => s.modelId); } catch { /* ignore */ }
    const match = SEED_WORKFLOWS.find(s => !have.has(s.slug) && signature(s.rounds, s.models.map(m => m.id)) === signature(w.iterations, ids));
    if (match) { storage.updateWorkflow(w.id, { seedSlug: match.slug } as any); have.add(match.slug); }
  }
  const text = textFor(lang);
  let created = 0;
  for (const w of SEED_WORKFLOWS) {
    if (have.has(w.slug)) continue;
    storage.createWorkflow({
      name: text[w.slug].name,
      description: text[w.slug].desc,
      steps: JSON.stringify(w.models.map(m => ({ modelId: m.id, label: m.label, systemPrompt: m.role }))),
      iterations: w.rounds, temperature: w.temperature, consensusThreshold: w.threshold,
      isDefault: 0, owner, seedSlug: w.slug,
    } as any);
    created++;
  }
  return created;
}

/**
 * Public demo (owner is a visitor id): every new session gets both workflows, whatever happened before.
 * Self-hosted (owner null): the workflows are added once, and never again if the operator deleted them.
 * Returns true when something was created.
 */
export function seedWorkflows(owner: string | null, lang = "en"): boolean {
  if (owner !== null) return ensureSeedWorkflows(owner, lang) > 0;
  const flag = "seeded:shared";
  if (storage.getSetting(flag)) return false;
  storage.setSetting(flag, "1");
  if (storage.listWorkflows().length > 0) return false; // existing self-hosted setup: leave it alone
  return ensureSeedWorkflows(null, lang) > 0;
}
