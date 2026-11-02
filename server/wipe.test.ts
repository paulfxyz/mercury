import test from "node:test";
import assert from "node:assert/strict";
import { storage } from "./storage";
import { runOrchestration, RunCancelled } from "./orchestrator";

function seed(owner: string | null) {
  const s = storage.createSession({ title: "t", query: "q", files: "[]", selectedModels: "[]", status: "completed", currentIteration: 1, totalIterations: 1, finalAnswer: "a", quickAnswer: null, workflowId: null, owner } as any);
  const child = storage.createSession({ title: "t", query: "q", files: "[]", selectedModels: "[]", status: "completed", currentIteration: 1, totalIterations: 1, finalAnswer: "a", quickAnswer: null, workflowId: null, parentId: s.id, owner } as any);
  storage.createIteration({ sessionId: child.id, iterationNumber: 1, type: "research", content: "[]", summary: "", consensus: null } as any);
  storage.createWorkflow({ name: "w", description: "", steps: "[]", iterations: 4, temperature: 0.3, consensusThreshold: 0.7, isDefault: 0, owner } as any);
  return s;
}

test("the demo wipe removes only the named owners' data", () => {
  seed("visitor-a"); seed("api:abc"); seed("visitor-b");
  storage.setSetting("theme", "dark");
  const counts = storage.wipeEverything(["visitor-a", "api:abc"]);
  assert.equal(counts.sessions, 4);
  assert.equal(counts.iterations, 2);
  assert.equal(counts.workflows, 2);
  assert.equal(storage.listSessions("visitor-a").length, 0);
  assert.equal(storage.listSessions("api:abc").length, 0);
  assert.equal(storage.listSessions("visitor-b").length, 1);
  assert.equal(storage.listWorkflows("visitor-b").length, 1);
  assert.equal(storage.getSetting("theme")?.value, "dark");
  assert.deepEqual(storage.wipeEverything([]), { sessions: 0, iterations: 0, workflows: 0, apiKeys: 0, settings: 0 });
});

test("the self-hosted wipe erases every table, including saved keys and settings", () => {
  seed(null);
  storage.createApiKey({ label: "k", value: "sk-or-v1-secret", isPrimary: 1 } as any);
  storage.setSetting("openrouter_api_key", "sk-or-v1-legacy");
  const counts = storage.wipeEverything();
  assert.ok(counts.sessions >= 3 && counts.iterations >= 1 && counts.workflows >= 1 && counts.apiKeys === 1 && counts.settings >= 2);
  assert.equal(storage.listSessions().length, 0);
  assert.equal(storage.listWorkflows().length, 0);
  assert.equal(storage.listApiKeys().length, 0);
  assert.equal(storage.getSetting("theme"), undefined);
  assert.equal(storage.getSetting("openrouter_api_key"), undefined);
});

test("a debate whose session was erased stops instead of writing data back", async () => {
  await assert.rejects(runOrchestration("missing-session", "q", ["a/b"], 3, "key", () => {}), RunCancelled);
  assert.equal(storage.getIterationsBySession("missing-session").length, 0);
});

test("demo visitors get both ready-made workflows in every new session, even after a reset", async () => {
  const { ensureSeedWorkflows, seedWorkflows } = await import("./seed");
  const owner = "visitor-seed";
  assert.equal(ensureSeedWorkflows(owner, "fr"), 2);
  assert.equal(ensureSeedWorkflows(owner, "fr"), 0);            // no duplicates on repeat
  const slugs = () => storage.listWorkflows(owner).map(w => w.seedSlug).sort();
  assert.deepEqual(slugs(), ["budget", "precision"]);
  // The visitor deletes one and enters a key again: it comes back.
  storage.deleteWorkflow(storage.listWorkflows(owner).find(w => w.seedSlug === "budget")!.id);
  assert.equal(seedWorkflows(owner, "en"), true);
  assert.deepEqual(slugs(), ["budget", "precision"]);
  // After a full reset they are there again.
  storage.wipeEverything([owner]);
  assert.equal(storage.listWorkflows(owner).length, 0);
  assert.equal(seedWorkflows(owner, "en"), true);
  assert.deepEqual(slugs(), ["budget", "precision"]);
  // Workflows created before the marker existed are recognised, not duplicated.
  const old = storage.listWorkflows(owner)[0];
  storage.updateWorkflow(old.id, { seedSlug: null } as any);
  assert.equal(ensureSeedWorkflows(owner), 0);
  assert.equal(storage.listWorkflows(owner).length, 2);
});
